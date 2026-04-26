// Manual assembly script — runs locally with msedge-tts + FFmpeg
// Usage: node scripts/manual-assembly.js <production_id>

// Load .env.local manually
const envContent = require("fs").readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const { createClient } = require("@supabase/supabase-js");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const { execSync } = require("child_process");
const { writeFileSync, readFileSync, existsSync, mkdirSync, statSync } = require("fs");
const { join } = require("path");
const os = require("os");
const crypto = require("crypto");

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

const PROD_ID = process.argv[2] || "34d127b0-82dd-409b-890c-2f9fc54d1194";
const USER_ID = "c1fccbb2-86e9-4d34-ae43-4a7cf4fd4a26";

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download ${r.status}`);
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

function fmt(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60), ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(ms).padStart(3,"0")}`;
}

(async () => {
  const workDir = join(os.tmpdir(), `genesis-asm-${PROD_ID.slice(0,8)}`);
  if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

  const { data: scenes } = await sb.from("production_scenes").select("*").eq("production_id", PROD_ID).eq("status", "completed").order("scene_number");
  console.log(`Scenes: ${scenes.length}`);

  const { data: prod } = await sb.from("productions").select("*").eq("id", PROD_ID).single();
  let plan = prod.plan;
  if (typeof plan === "string") plan = JSON.parse(plan);
  const sceneDefs = plan?.scenes || [];

  // 1. Download
  console.log("Step 1: Downloading scenes...");
  const sceneFiles = [];
  for (const s of scenes) {
    const fp = join(workDir, `scene_${s.scene_number}.mp4`);
    await download(s.output_video_url, fp);
    sceneFiles.push(fp);
    console.log(`  Scene ${s.scene_number}: ${(statSync(fp).size / 1024).toFixed(0)} KB`);
  }

  // 2. Concat
  console.log("Step 2: Concatenating...");
  const listFile = join(workDir, "list.txt");
  writeFileSync(listFile, sceneFiles.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
  const concatOut = join(workDir, "concat.mp4");
  try {
    execSync(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${concatOut}"`, { stdio: "pipe", timeout: 60000 });
  } catch {
    execSync(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c:v libx264 -preset fast -crf 23 -an "${concatOut}"`, { stdio: "pipe", timeout: 120000 });
  }
  console.log(`  Concat: ${(statSync(concatOut).size / 1024 / 1024).toFixed(1)} MB`);

  // 3. Voiceover
  console.log("Step 3: Generating voiceover (msedge-tts)...");
  const voScript = sceneDefs.map(s => s.voiceoverLine).filter(Boolean).join(". ");
  console.log(`  Script: ${voScript.slice(0, 120)}...`);
  const voPath = join(workDir, "voiceover.mp3");
  let hasVoiceover = false;
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata("en-US-GuyNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const ttsDir = join(workDir, "tts");
    if (!existsSync(ttsDir)) mkdirSync(ttsDir);
    const ttsResult = await tts.toFile(ttsDir, voScript);
    tts.close();
    writeFileSync(voPath, readFileSync(ttsResult.audioFilePath));
    hasVoiceover = statSync(voPath).size > 1000;
    console.log(`  Voiceover: ${(statSync(voPath).size / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.warn("  Voiceover failed:", e.message);
  }

  // 4. Mix audio
  console.log("Step 4: Mixing audio...");
  const musicPath = join(process.cwd(), "public", "audio", "cinematic-epic.mp3");
  let currentOut = concatOut;

  if (hasVoiceover && existsSync(musicPath)) {
    const mixedOut = join(workDir, "mixed.mp4");
    try {
      execSync(
        `ffmpeg -y -i "${concatOut}" -i "${voPath}" -i "${musicPath}" ` +
        `-filter_complex "[1:a]volume=1.3,aresample=48000,apad[vo];[2:a]volume=0.35,aresample=48000,aloop=loop=-1:size=2e+09,atrim=duration=300,apad[mu];[vo][mu]amix=inputs=2:duration=first[aout]" ` +
        `-map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest "${mixedOut}"`,
        { stdio: "pipe", timeout: 120000 }
      );
      if (statSync(mixedOut).size > 10000) {
        currentOut = mixedOut;
        console.log("  Mixed: voiceover + music");
      }
    } catch (e) {
      console.warn("  Full mix failed:", e.message?.slice(0, 100));
    }
  }

  if (currentOut === concatOut && hasVoiceover) {
    const voOut = join(workDir, "with_vo.mp4");
    try {
      execSync(
        `ffmpeg -y -i "${concatOut}" -i "${voPath}" -filter_complex "[1:a]volume=1.3,aresample=48000[vo]" -map 0:v -map "[vo]" -c:v copy -c:a aac -b:a 192k -shortest "${voOut}"`,
        { stdio: "pipe", timeout: 60000 }
      );
      if (statSync(voOut).size > 10000) { currentOut = voOut; console.log("  Added voiceover only"); }
    } catch (e) { console.warn("  VO only failed:", e.message?.slice(0, 100)); }
  }

  if (currentOut === concatOut && existsSync(musicPath)) {
    const musOut = join(workDir, "with_music.mp4");
    try {
      execSync(
        `ffmpeg -y -i "${concatOut}" -i "${musicPath}" -filter_complex "[1:a]volume=0.4,aresample=48000,aloop=loop=-1:size=2e+09,atrim=duration=300[mu]" -map 0:v -map "[mu]" -c:v copy -c:a aac -b:a 192k -shortest "${musOut}"`,
        { stdio: "pipe", timeout: 60000 }
      );
      if (statSync(musOut).size > 10000) { currentOut = musOut; console.log("  Added music only"); }
    } catch (e) { console.warn("  Music failed:", e.message?.slice(0, 100)); }
  }

  // 5. Subtitles
  console.log("Step 5: Burning subtitles...");
  let srt = "";
  let t = 0;
  let idx = 1;
  for (const s of sceneDefs) {
    if (s.voiceoverLine?.trim()) {
      const st = t + 0.3, et = t + (s.duration || 8) - 0.3;
      srt += `${idx}\n${fmt(st)} --> ${fmt(et)}\n${s.voiceoverLine.trim()}\n\n`;
      idx++;
    }
    t += s.duration || 8;
  }
  if (srt.trim()) {
    const srtPath = join(workDir, "captions.srt");
    writeFileSync(srtPath, srt);
    const capOut = join(workDir, "captioned.mp4");
    try {
      const srtEsc = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
      execSync(
        `ffmpeg -y -i "${currentOut}" -vf "subtitles='${srtEsc}':force_style='FontName=Arial,FontSize=14,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,BorderStyle=4,Outline=1,Shadow=0,MarginV=25,Alignment=2'" -c:a copy -c:v libx264 -preset fast -crf 23 "${capOut}"`,
        { stdio: "pipe", timeout: 120000 }
      );
      if (statSync(capOut).size > 10000) { currentOut = capOut; console.log("  Subtitles burned"); }
    } catch (e) { console.warn("  Subtitle burn failed:", e.message?.slice(0, 100)); }
  }

  // 6. Upload
  console.log("Step 6: Uploading...");
  const finalBuf = readFileSync(currentOut);
  console.log(`  Final: ${(finalBuf.length / 1024 / 1024).toFixed(1)} MB`);
  const videoId = crypto.randomUUID();
  const r2Key = `videos/${USER_ID}/${videoId}.mp4`;
  await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: r2Key, Body: finalBuf, ContentType: "video/mp4" }));

  const sceneUrlMap = {};
  scenes.forEach(s => { sceneUrlMap[`scene_${s.scene_number}`] = s.output_video_url; });
  sceneUrlMap.final = `/api/videos/${videoId}`;

  await sb.from("productions").update({
    status: "completed", progress: 100, completed_at: new Date().toISOString(),
    output_video_urls: JSON.stringify(sceneUrlMap),
    voiceover_url: "msedge-tts-local",
  }).eq("id", PROD_ID);

  const { data: qItems } = await sb.from("dev_content_queue").select("id,input_data").filter("input_data->>production_id", "eq", PROD_ID);
  if (qItems?.[0]) {
    await sb.from("dev_content_queue").update({ status: "ready", generated_at: new Date().toISOString() }).eq("id", qItems[0].id);
    console.log("Queue item:", qItems[0].id, "-> ready");
    console.log("Topic:", qItems[0].input_data?.topic_title?.slice(0, 80));
  }

  console.log(`\nDONE! Video: ${videoId} | ${(finalBuf.length / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Voiceover: ${hasVoiceover ? "YES" : "NO"} | Music: ${existsSync(musicPath) ? "YES" : "NO"} | Subtitles: ${srt.trim() ? "YES" : "NO"}`);
})();
