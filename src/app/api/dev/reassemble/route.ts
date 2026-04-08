/**
 * Dev Reassemble API — Trigger local FFmpeg assembly for a production
 *
 * POST /api/dev/reassemble
 * Body: { productionId: string }
 * Auth: CRON_SECRET
 *
 * Uses local FFmpeg + Edge TTS to assemble videos without FAL credits.
 */

import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { getProduction, getProductionScenes, updateProduction } from "@/lib/genesis-brain/orchestrator";
import { createVideo } from "@/lib/db";
import { uploadVideo, videoStorageKey, verifyR2Upload } from "@/lib/storage";
import { ModelId } from "@/types";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs: string[] = [];
  const log = (msg: string) => { console.log(msg); logs.push(msg); };

  try {
    const body = await req.json();
    const { productionId } = body;
    if (!productionId) {
      return NextResponse.json({ error: "productionId required" }, { status: 400 });
    }

    const workDir = join(tmpdir(), `genesis-reassemble-${Date.now()}`);
    mkdirSync(workDir, { recursive: true });
    log(`[REASSEMBLE] Work dir: ${workDir}`);

    // Get production
    const production = await getProduction(productionId);
    if (!production) throw new Error("Production not found");

    // Parse plan
    let plan = production.plan;
    if (typeof plan === "string") {
      plan = JSON.parse(plan);
      log(`[REASSEMBLE] Parsed plan from string — ${(plan as Record<string, unknown>).scenes ? ((plan as Record<string, unknown>).scenes as unknown[]).length : 0} scenes`);
    }
    const sceneDefs = ((plan as Record<string, unknown>)?.scenes || []) as Array<{ sceneNumber: number; duration: number; voiceoverLine?: string }>;
    log(`[REASSEMBLE] Scene defs: ${sceneDefs.length}, voiceover lines: ${sceneDefs.filter(s => s.voiceoverLine).length}`);

    // Get completed scenes
    const allScenes = await getProductionScenes(productionId);
    const completedScenes = allScenes
      .filter(s => s.status === "completed" && s.outputVideoUrl)
      .sort((a, b) => a.sceneNumber - b.sceneNumber);
    log(`[REASSEMBLE] Completed scenes: ${completedScenes.length}`);

    // Step 1: Download scenes
    const sceneFiles: string[] = [];
    for (const scene of completedScenes) {
      const filepath = join(workDir, `scene_${scene.sceneNumber}.mp4`);
      const res = await fetch(scene.outputVideoUrl!);
      writeFileSync(filepath, Buffer.from(await res.arrayBuffer()));
      sceneFiles.push(filepath);
    }
    log(`[REASSEMBLE] Downloaded ${sceneFiles.length} scenes`);

    // Step 2: Concat
    const concatList = join(workDir, "list.txt");
    writeFileSync(concatList, sceneFiles.map(f => `file '${f.split("\\").join("/")}'`).join("\n"));
    const concatOut = join(workDir, "concat.mp4");
    execSync(`ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${concatOut}"`, { stdio: "pipe", timeout: 60000 });
    const concatSize = statSync(concatOut).size;
    log(`[REASSEMBLE] Concat: ${concatSize} bytes`);

    // Step 3: Generate voiceover
    const voScript = sceneDefs.map(s => s.voiceoverLine).filter(Boolean).join(". ") || production.concept;
    log(`[REASSEMBLE] Voiceover script: "${voScript.slice(0, 100)}..."`);
    const voScriptFile = join(workDir, "vo_script.txt");
    const voFile = join(workDir, "vo.mp3");
    writeFileSync(voScriptFile, voScript);

    let hasVo = false;
    try {
      execSync(`python -m edge_tts --voice "en-US-GuyNeural" --file "${voScriptFile}" --write-media "${voFile}"`, { stdio: "pipe", timeout: 30000 });
      hasVo = existsSync(voFile) && statSync(voFile).size > 1000;
      log(`[REASSEMBLE] Edge TTS: ${hasVo ? statSync(voFile).size + " bytes OK" : "FAILED"}`);
    } catch (e) {
      log(`[REASSEMBLE] Edge TTS error: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Step 4: Mix audio
    let finalOut = concatOut;
    const musicPath = join(process.cwd(), "public", "audio", "cinematic-epic.mp3");
    const hasMusic = existsSync(musicPath);
    log(`[REASSEMBLE] Music file: ${hasMusic ? "exists" : "NOT FOUND"} at ${musicPath}`);

    if (hasVo && hasMusic) {
      const mixOut = join(workDir, "mixed.mp4");
      try {
        // VO at strong volume, music at audible background level (0.35), stereo 48kHz output
        // Use duration=first so audio matches the video length (input 0), not the shortest audio
        const mixCmd = `ffmpeg -y -i "${concatOut}" -i "${voFile}" -i "${musicPath}" -filter_complex "[1:a]volume=1.3,aresample=48000,apad[vo];[2:a]volume=0.35,aresample=48000,aloop=loop=-1:size=2e+09,atrim=duration=300,apad[mu];[vo][mu]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest "${mixOut}"`;
        execSync(mixCmd, { stdio: "pipe", timeout: 120000 });
        if (existsSync(mixOut) && statSync(mixOut).size > 10000) {
          finalOut = mixOut;
          log(`[REASSEMBLE] Mixed: ${statSync(mixOut).size} bytes (audio added: ${statSync(mixOut).size - concatSize})`);
        }
      } catch (e) {
        log(`[REASSEMBLE] Mix FAILED: ${e instanceof Error ? e.message : String(e)}`);
        const stderr = (e as { stderr?: Buffer })?.stderr?.toString().slice(-300) || "";
        log(`[REASSEMBLE] FFmpeg stderr: ${stderr}`);
      }
    } else if (hasVo) {
      const voOut = join(workDir, "withvo.mp4");
      try {
        execSync(`ffmpeg -y -i "${concatOut}" -i "${voFile}" -filter_complex "[1:a]volume=1.3,aresample=48000[vo]" -map 0:v -map "[vo]" -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest "${voOut}"`, { stdio: "pipe", timeout: 60000 });
        if (existsSync(voOut) && statSync(voOut).size > 10000) {
          finalOut = voOut;
          log(`[REASSEMBLE] VO only: ${statSync(voOut).size} bytes`);
        }
      } catch (e) {
        log(`[REASSEMBLE] VO mix FAILED: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Step 5: Captions
    if (finalOut !== concatOut && sceneDefs.length > 0) {
      const srtLines: string[] = [];
      let t = 0;
      sceneDefs.forEach((s, i) => {
        if (s.voiceoverLine) {
          const start = t + 0.3;
          const end = t + (s.duration || 5) - 0.3;
          const fmtTime = (sec: number) => {
            const h = Math.floor(sec/3600); const m = Math.floor((sec%3600)/60);
            const ss = Math.floor(sec%60); const ms = Math.round((sec%1)*1000);
            return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
          };
          srtLines.push(`${i+1}\n${fmtTime(start)} --> ${fmtTime(end)}\n${s.voiceoverLine}\n`);
        }
        t += s.duration || 5;
      });

      if (srtLines.length > 0) {
        const srtFile = join(workDir, "captions.srt");
        writeFileSync(srtFile, srtLines.join("\n"));
        const capOut = join(workDir, "captioned.mp4");
        const srtEsc = srtFile.split("\\").join("/").replace(/:/g, "\\:");
        try {
          execSync(`ffmpeg -y -i "${finalOut}" -vf "subtitles='${srtEsc}':force_style='FontName=Arial,FontSize=12,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,BorderStyle=4,Outline=1,Shadow=0,MarginV=25,Alignment=2'" -c:a copy -c:v libx264 -preset fast -crf 23 "${capOut}"`, { stdio: "pipe", timeout: 120000 });
          if (existsSync(capOut) && statSync(capOut).size > 10000) {
            finalOut = capOut;
            log(`[REASSEMBLE] Captions burned: ${statSync(capOut).size} bytes`);
          }
        } catch (e) {
          log(`[REASSEMBLE] Caption burn FAILED: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    log(`[REASSEMBLE] Final: ${statSync(finalOut).size} bytes`);

    // Step 6: Upload to R2
    const finalBuffer = readFileSync(finalOut);
    const videoId = randomUUID();
    const vKey = videoStorageKey(production.userId, videoId);
    await uploadVideo(vKey, finalBuffer);
    await verifyR2Upload(vKey);
    log(`[REASSEMBLE] Uploaded to R2: ${vKey}`);

    // Get duration
    let totalDuration = completedScenes.reduce((sum, s) => sum + (s.duration || 5), 0);
    try {
      const probe = execSync(`ffmpeg -i "${finalOut}" 2>&1`, { stdio: "pipe", timeout: 5000, shell: "cmd.exe" }).toString();
      const m = probe.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (m) totalDuration = parseInt(m[1])*3600 + parseInt(m[2])*60 + parseFloat(m[3]);
    } catch { /* use scene sum */ }

    // Create video record + update production
    const videoApiUrl = `/api/videos/${videoId}`;
    try {
      await createVideo({ id: videoId, userId: production.userId, title: production.concept.slice(0, 100), prompt: production.concept, modelId: "wan-2.2" as ModelId, url: videoApiUrl, thumbnailUrl: "", duration: Math.round(totalDuration), resolution: "1280x720", fps: 24, aspectRatio: production.aspectRatio, fileSize: finalBuffer.length });
    } catch (e) { log(`[REASSEMBLE] Video record error: ${e}`); }

    const sceneUrlMap: Record<string, string> = {};
    completedScenes.forEach(s => { sceneUrlMap[`scene_${s.sceneNumber}`] = s.outputVideoUrl!; });
    sceneUrlMap["final"] = videoApiUrl;
    await updateProduction(productionId, { status: "completed", output_video_urls: JSON.stringify(sceneUrlMap), progress: 100, completed_at: new Date().toISOString() });

    // Cleanup
    try { readdirSync(workDir).forEach(f => { try { unlinkSync(join(workDir, f)); } catch {} }); } catch {}

    return NextResponse.json({
      success: true, productionId, videoUrl: videoApiUrl, videoId,
      duration: Math.round(totalDuration), fileSize: finalBuffer.length, logs
    });
  } catch (error) {
    log(`[REASSEMBLE] FATAL: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal error", logs }, { status: 500 });
  }
}
