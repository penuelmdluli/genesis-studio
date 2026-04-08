/**
 * Local FFmpeg Assembly — Works WITHOUT FAL credits
 *
 * Complete pipeline using locally installed FFmpeg + Edge TTS:
 * 1. Download all scene videos
 * 2. Generate voiceover narration via Edge TTS (free, no API key)
 * 3. Concatenate scene videos
 * 4. Mix voiceover + background music + video
 * 5. Burn captions/subtitles into video
 * 6. Upload final to R2
 *
 * This replaces the FAL-dependent assembly when FAL credits are exhausted.
 * Produces the same output: narrated video with music and captions.
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import {
  getProduction,
  getProductionScenes,
  updateProduction,
} from "./orchestrator";
import { createVideo } from "@/lib/db";
import { uploadVideo, videoStorageKey, verifyR2Upload } from "@/lib/storage";
import { ModelId } from "@/types";

// ---- UTILITIES ----

function findFFmpeg(): string {
  const candidates = [
    "ffmpeg",
    "C:\\Users\\PenuelM\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0-full_build\\bin\\ffmpeg.exe",
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
  ];

  for (const cmd of candidates) {
    try {
      execSync(`"${cmd}" -version`, { stdio: "pipe", timeout: 5000 });
      return cmd;
    } catch {
      // Try next
    }
  }
  throw new Error("FFmpeg not found on system");
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed ${url}: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(destPath, buffer);
}

function cleanupDir(dir: string): void {
  try {
    if (existsSync(dir)) {
      for (const file of readdirSync(dir)) {
        try { unlinkSync(join(dir, file)); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}

// ---- EDGE TTS VOICEOVER ----

/**
 * Generate voiceover using Edge TTS (Microsoft free TTS).
 * Uses the same voice style as the Kokoro TTS the platform normally uses.
 * Edge TTS voices: en-US-GuyNeural (male), en-US-AriaNeural (female)
 */
async function generateVoiceoverLocal(
  script: string,
  outputPath: string,
  voice: string = "en-US-GuyNeural"
): Promise<boolean> {
  try {
    // Edge TTS generates an mp3 file from text
    // Write script to a temp file to avoid shell escaping issues
    const scriptPath = outputPath + ".txt";
    writeFileSync(scriptPath, script, "utf-8");

    // Use --file flag to read text from file (avoids shell escaping nightmares on Windows)
    const cmd = `python -m edge_tts --voice "${voice}" --file "${scriptPath}" --write-media "${outputPath}"`;
    console.log(`[LOCAL ASSEMBLY] Generating voiceover via Edge TTS (${voice})...`);
    execSync(cmd, { stdio: "pipe", timeout: 30000 });

    // Cleanup temp text file
    try { unlinkSync(scriptPath); } catch { /* ignore */ }

    if (existsSync(outputPath) && statSync(outputPath).size > 1000) {
      console.log(`[LOCAL ASSEMBLY] Voiceover generated: ${(statSync(outputPath).size / 1024).toFixed(0)} KB`);
      return true;
    }
    console.warn(`[LOCAL ASSEMBLY] Edge TTS output too small or missing`);
    return false;
  } catch (err) {
    console.error(`[LOCAL ASSEMBLY] Edge TTS failed:`, err instanceof Error ? err.message : err);
    return false;
  }
}

// ---- SRT SUBTITLE GENERATION ----

interface CaptionEntry {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

function generateSRT(
  scenes: Array<{ sceneNumber: number; duration: number; voiceoverLine?: string }>
): { srtContent: string; entries: CaptionEntry[] } {
  const entries: CaptionEntry[] = [];
  let currentTime = 0;

  for (const scene of scenes) {
    if (scene.voiceoverLine?.trim()) {
      const startSec = currentTime + 0.3; // Small delay for natural feel
      const endSec = currentTime + scene.duration - 0.3;

      entries.push({
        index: entries.length + 1,
        startTime: formatSRTTime(startSec),
        endTime: formatSRTTime(endSec),
        text: scene.voiceoverLine.trim(),
      });
    }
    currentTime += scene.duration;
  }

  const srtContent = entries
    .map((e) => `${e.index}\n${e.startTime} --> ${e.endTime}\n${e.text}\n`)
    .join("\n");

  return { srtContent, entries };
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

// ---- MAIN ASSEMBLY ----

export async function localAssembly(productionId: string): Promise<{
  success: boolean;
  videoUrl?: string;
  videoId?: string;
  duration?: number;
  error?: string;
}> {
  const workDir = join(tmpdir(), `genesis-assembly-${productionId.slice(0, 8)}`);

  try {
    const ffmpeg = findFFmpeg();
    console.log(`[LOCAL ASSEMBLY] Using FFmpeg: ${ffmpeg}`);

    // Get production data
    const production = await getProduction(productionId);
    if (!production) throw new Error("Production not found");

    const allScenes = await getProductionScenes(productionId);
    const completedScenes = allScenes
      .filter((s) => s.status === "completed" && s.outputVideoUrl)
      .sort((a, b) => a.sceneNumber - b.sceneNumber);

    if (completedScenes.length === 0) throw new Error("No completed scenes");

    // Get plan for voiceover lines (plan may be stored as JSON string)
    let plan = production.plan;
    if (typeof plan === "string") {
      try { plan = JSON.parse(plan); } catch { plan = null; }
    }
    const sceneDefs = (plan as Record<string, unknown>)?.scenes as Array<{ sceneNumber: number; duration: number; voiceoverLine?: string }> || [];

    console.log(`[LOCAL ASSEMBLY] Assembling ${completedScenes.length} scenes with voiceover + music + captions`);

    // Create work directory
    if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

    await updateProduction(productionId, { status: "assembling", progress: 60 });

    // ═══════════════════════════════════════════════
    // STEP 1: Download all scene videos
    // ═══════════════════════════════════════════════
    console.log(`[LOCAL ASSEMBLY] Step 1/6: Downloading scene videos...`);
    const sceneFiles: string[] = [];
    for (const scene of completedScenes) {
      const filepath = join(workDir, `scene_${scene.sceneNumber}.mp4`);
      await downloadFile(scene.outputVideoUrl!, filepath);
      sceneFiles.push(filepath);
    }
    console.log(`[LOCAL ASSEMBLY] Downloaded ${sceneFiles.length} scenes`);

    // ═══════════════════════════════════════════════
    // STEP 2: Concatenate all scenes
    // ═══════════════════════════════════════════════
    console.log(`[LOCAL ASSEMBLY] Step 2/6: Concatenating scenes...`);
    const concatListPath = join(workDir, "concat_list.txt");
    const concatContent = sceneFiles
      .map((f) => `file '${f.replace(/\\/g, "/")}'`)
      .join("\n");
    writeFileSync(concatListPath, concatContent);

    const concatOutput = join(workDir, "concat.mp4");
    try {
      // Try fast concat with stream copy first
      execSync(
        `"${ffmpeg}" -y -f concat -safe 0 -i "${concatListPath}" -c copy "${concatOutput}"`,
        { stdio: "pipe", timeout: 60000 }
      );
    } catch {
      // If stream copy fails (different codecs), re-encode
      console.log(`[LOCAL ASSEMBLY] Stream copy failed, re-encoding...`);
      execSync(
        `"${ffmpeg}" -y -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -preset fast -crf 23 -an "${concatOutput}"`,
        { stdio: "pipe", timeout: 120000 }
      );
    }

    // Get total duration
    let totalDuration = completedScenes.reduce((sum, s) => sum + (s.duration || 5), 0);
    try {
      const probeCmd = process.platform === "win32"
        ? `"${ffmpeg}" -i "${concatOutput}" 2>&1 | findstr /C:"Duration"`
        : `"${ffmpeg}" -i "${concatOutput}" 2>&1 | grep Duration`;
      const probeOut = execSync(probeCmd, { stdio: "pipe", timeout: 10000, shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh" }).toString();
      const match = probeOut.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (match) {
        totalDuration = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
      }
    } catch { /* use scene sum */ }
    console.log(`[LOCAL ASSEMBLY] Concatenated: ${totalDuration.toFixed(1)}s`);

    await updateProduction(productionId, { progress: 70 });

    // ═══════════════════════════════════════════════
    // STEP 3: Generate voiceover via Edge TTS
    // ═══════════════════════════════════════════════
    console.log(`[LOCAL ASSEMBLY] Step 3/6: Generating voiceover...`);
    const voiceoverPath = join(workDir, "voiceover.mp3");
    const voiceoverScript = sceneDefs
      .map((s: { voiceoverLine?: string }) => s.voiceoverLine)
      .filter(Boolean)
      .join(". ") || production.concept;

    // Map the voice setting to Edge TTS voice
    const edgeVoice = mapToEdgeVoice(production.voiceoverVoice);
    const hasVoiceover = await generateVoiceoverLocal(voiceoverScript, voiceoverPath, edgeVoice);

    if (hasVoiceover) {
      console.log(`[LOCAL ASSEMBLY] Voiceover generated successfully`);
    } else {
      console.warn(`[LOCAL ASSEMBLY] Voiceover generation failed — continuing without narration`);
    }

    // ═══════════════════════════════════════════════
    // STEP 4: Mix voiceover + music + video
    // ═══════════════════════════════════════════════
    console.log(`[LOCAL ASSEMBLY] Step 4/6: Mixing audio...`);
    let currentOutput = concatOutput;
    const musicPath = join(process.cwd(), "public", "audio", "cinematic-epic.mp3");
    const hasMusicFile = existsSync(musicPath);

    if (hasVoiceover && hasMusicFile) {
      // Mix both voiceover (louder) + music (softer)
      const mixedOutput = join(workDir, "mixed.mp4");
      try {
        execSync(
          `"${ffmpeg}" -y -i "${concatOutput}" -i "${voiceoverPath}" -i "${musicPath}" ` +
          `-filter_complex "[1:a]volume=1.3,aresample=48000,apad[vo];[2:a]volume=0.35,aresample=48000,aloop=loop=-1:size=2e+09,atrim=duration=300,apad[mu];[vo][mu]amix=inputs=2:duration=first[aout]" ` +
          `-map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest "${mixedOutput}"`,
          { stdio: "pipe", timeout: 120000 }
        );
        if (existsSync(mixedOutput) && statSync(mixedOutput).size > 10000) {
          currentOutput = mixedOutput;
          console.log(`[LOCAL ASSEMBLY] Voiceover + music mixed`);
        }
      } catch (err) {
        console.warn(`[LOCAL ASSEMBLY] Full mix failed, trying voiceover only:`, err);
      }
    }

    if (currentOutput === concatOutput && hasVoiceover) {
      // Voiceover only (no music or full mix failed)
      const voOutput = join(workDir, "with_vo.mp4");
      try {
        execSync(
          `"${ffmpeg}" -y -i "${concatOutput}" -i "${voiceoverPath}" ` +
          `-filter_complex "[1:a]volume=1.3,aresample=48000[vo]" ` +
          `-map 0:v -map "[vo]" -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest "${voOutput}"`,
          { stdio: "pipe", timeout: 60000 }
        );
        if (existsSync(voOutput) && statSync(voOutput).size > 10000) {
          currentOutput = voOutput;
          console.log(`[LOCAL ASSEMBLY] Voiceover added (no music)`);
        }
      } catch (err) {
        console.warn(`[LOCAL ASSEMBLY] Voiceover mix failed:`, err);
      }
    }

    if (currentOutput === concatOutput && hasMusicFile) {
      // Music only (voiceover failed)
      const musicOutput = join(workDir, "with_music.mp4");
      try {
        execSync(
          `"${ffmpeg}" -y -i "${concatOutput}" -i "${musicPath}" ` +
          `-filter_complex "[1:a]volume=0.35,aresample=48000,aloop=loop=-1:size=2e+09,atrim=duration=300[mu]" ` +
          `-map 0:v -map "[mu]" -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest "${musicOutput}"`,
          { stdio: "pipe", timeout: 60000 }
        );
        if (existsSync(musicOutput) && statSync(musicOutput).size > 10000) {
          currentOutput = musicOutput;
          console.log(`[LOCAL ASSEMBLY] Music added (no voiceover)`);
        }
      } catch (err) {
        console.warn(`[LOCAL ASSEMBLY] Music mix failed:`, err);
      }
    }

    await updateProduction(productionId, { progress: 80 });

    // ═══════════════════════════════════════════════
    // STEP 5: Burn captions/subtitles
    // ═══════════════════════════════════════════════
    console.log(`[LOCAL ASSEMBLY] Step 5/6: Burning captions...`);
    const { srtContent } = generateSRT(
      sceneDefs.map((s: { sceneNumber: number; duration: number; voiceoverLine?: string }, i: number) => ({
        sceneNumber: s.sceneNumber || i + 1,
        duration: s.duration || completedScenes[i]?.duration || 5,
        voiceoverLine: s.voiceoverLine,
      }))
    );

    if (srtContent.trim()) {
      const srtPath = join(workDir, "captions.srt");
      writeFileSync(srtPath, srtContent);

      const captionedOutput = join(workDir, "captioned.mp4");
      try {
        // Burn subtitles with styled text (white text, semi-transparent black box, bottom position)
        const srtPathEscaped = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
        execSync(
          `"${ffmpeg}" -y -i "${currentOutput}" ` +
          `-vf "subtitles='${srtPathEscaped}':force_style='FontName=Arial,FontSize=12,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,BorderStyle=4,Outline=1,Shadow=0,MarginV=25,Alignment=2'" ` +
          `-c:a copy -c:v libx264 -preset fast -crf 23 "${captionedOutput}"`,
          { stdio: "pipe", timeout: 120000 }
        );

        if (existsSync(captionedOutput) && statSync(captionedOutput).size > 10000) {
          currentOutput = captionedOutput;
          console.log(`[LOCAL ASSEMBLY] Captions burned into video`);
        }
      } catch (err) {
        console.warn(`[LOCAL ASSEMBLY] Caption burn failed (non-fatal):`, err);
        // Continue without captions — video + audio is more important
      }
    }

    await updateProduction(productionId, { progress: 90 });

    // ═══════════════════════════════════════════════
    // STEP 6: Upload to R2 + create records
    // ═══════════════════════════════════════════════
    console.log(`[LOCAL ASSEMBLY] Step 6/6: Uploading to R2...`);
    const finalBuffer = readFileSync(currentOutput);
    const fileSize = finalBuffer.length;
    console.log(`[LOCAL ASSEMBLY] Final video: ${(fileSize / 1024 / 1024).toFixed(1)} MB`);

    const videoId = randomUUID();
    const vKey = videoStorageKey(production.userId, videoId);
    const videoApiUrl = `/api/videos/${videoId}`;

    await uploadVideo(vKey, finalBuffer);
    await verifyR2Upload(vKey);
    console.log(`[LOCAL ASSEMBLY] Uploaded to R2: ${vKey}`);

    // Build scene URL map
    const sceneUrlMap: Record<string, string> = {};
    completedScenes.forEach((s) => {
      sceneUrlMap[`scene_${s.sceneNumber}`] = s.outputVideoUrl!;
    });
    sceneUrlMap["final"] = videoApiUrl;

    // Create video record
    try {
      await createVideo({
        id: videoId,
        userId: production.userId,
        title: production.concept.slice(0, 100),
        prompt: production.concept,
        modelId: "wan-2.2" as ModelId,
        url: videoApiUrl,
        thumbnailUrl: "",
        duration: Math.round(totalDuration),
        resolution: "1280x720",
        fps: 24,
        aspectRatio: production.aspectRatio,
        fileSize,
      });
    } catch (dbErr) {
      console.warn(`[LOCAL ASSEMBLY] Video record creation failed:`, dbErr);
    }

    // Save voiceover URL if generated
    if (hasVoiceover) {
      await updateProduction(productionId, { voiceover_url: "local-edge-tts" });
    }

    // Update production
    await updateProduction(productionId, {
      status: "completed",
      output_video_urls: JSON.stringify(sceneUrlMap),
      progress: 100,
      completed_at: new Date().toISOString(),
    });

    console.log(`[LOCAL ASSEMBLY] ✅ Production ${productionId} completed!`);
    console.log(`[LOCAL ASSEMBLY]    Video: ${videoId}`);
    console.log(`[LOCAL ASSEMBLY]    Duration: ${totalDuration.toFixed(1)}s`);
    console.log(`[LOCAL ASSEMBLY]    Voiceover: ${hasVoiceover ? "YES" : "NO"}`);
    console.log(`[LOCAL ASSEMBLY]    Music: ${hasMusicFile ? "YES" : "NO"}`);
    console.log(`[LOCAL ASSEMBLY]    Captions: ${srtContent.trim() ? "YES" : "NO"}`);

    cleanupDir(workDir);

    return {
      success: true,
      videoUrl: videoApiUrl,
      videoId,
      duration: Math.round(totalDuration),
    };
  } catch (err) {
    console.error(`[LOCAL ASSEMBLY] Failed:`, err);
    cleanupDir(workDir);

    await updateProduction(productionId, {
      status: "failed",
      error_message: `Local assembly failed: ${err instanceof Error ? err.message : "Unknown"}`,
      completed_at: new Date().toISOString(),
    }).catch(() => {});

    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Map Genesis Brain voice IDs to Edge TTS voices.
 * Keeps the same voice character the user selected.
 */
function mapToEdgeVoice(voiceId?: string): string {
  const voiceMap: Record<string, string> = {
    // Male voices
    "voice-adam": "en-US-GuyNeural",
    "am_adam": "en-US-GuyNeural",
    "am_michael": "en-US-ChristopherNeural",
    "en-US-GuyNeural": "en-US-GuyNeural",
    "en-US-DavisNeural": "en-US-ChristopherNeural",
    // Female voices
    "voice-aria": "en-US-AriaNeural",
    "af_heart": "en-US-JennyNeural",
    "af_bella": "en-US-AriaNeural",
    "en-US-JennyNeural": "en-US-JennyNeural",
    "en-US-AriaNeural": "en-US-AriaNeural",
    // British
    "bf_emma": "en-GB-SoniaNeural",
    "bf_isabella": "en-GB-LibbyNeural",
    "en-GB-RyanNeural": "en-GB-RyanNeural",
    "en-GB-SoniaNeural": "en-GB-SoniaNeural",
    // South African
    "zu-ZA-ThandoNeural": "en-ZA-LeahNeural",
    "zu-ZA-ThembaNeural": "en-ZA-LukeNeural",
    "af-ZA-WillemNeural": "af-ZA-WillemNeural",
    "af-ZA-AdriNeural": "af-ZA-AdriNeural",
  };

  if (voiceId && voiceMap[voiceId]) {
    return voiceMap[voiceId];
  }

  // Default: professional male narrator
  return "en-US-GuyNeural";
}
