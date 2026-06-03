const express = require("express");
const { execFile } = require("child_process");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { randomUUID } = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SECRET = process.env.SCRAPER_SECRET;

// R2 client
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});
const BUCKET = process.env.R2_BUCKET_NAME || "genesis-videos";

// Auth middleware
function auth(req, res, next) {
  const token = req.headers["x-scraper-secret"];
  if (!SECRET || token !== SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Helper: run yt-dlp with args, return parsed JSON
// Automatically injects Facebook cookies when the URL is a facebook.com URL
function ytdlp(args, timeoutMs = 60000) {
  // Inject Facebook cookies for authenticated access if URL looks like Facebook
  const urlArg = args[args.length - 1] || "";
  if (urlArg.includes("facebook.com") && process.env.FB_COOKIES_BASE64) {
    const fs = require("fs");
    const path = require("path");
    const cookiePath = path.join(require("os").tmpdir(), "fb_cookies.txt");
    if (!fs.existsSync(cookiePath)) {
      fs.writeFileSync(cookiePath, Buffer.from(process.env.FB_COOKIES_BASE64, "base64").toString("utf8"));
    }
    args = ["--cookies", cookiePath, ...args];
  }
  return new Promise((resolve, reject) => {
    const proc = execFile("yt-dlp", args, { timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`yt-dlp failed: ${err.message}\nstderr: ${stderr?.slice(0, 500)}`));
      resolve(stdout);
    });
  });
}

// ─── GET /health ───
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "genesis-scraper", timestamp: new Date().toISOString() });
});

// ─── POST /metadata ───
// Returns video metadata without downloading
app.post("/metadata", auth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url required" });

    const stdout = await ytdlp([
      "--dump-json",
      "--skip-download",
      "--no-warnings",
      url,
    ]);

    const data = JSON.parse(stdout.trim());
    res.json({
      id: data.id || "",
      title: data.title || "",
      duration: data.duration || 0,
      viewCount: data.view_count || 0,
      uploadDate: data.upload_date || "",
      thumbnailUrl: data.thumbnail || "",
      url: data.webpage_url || url,
      uploaderHandle: data.uploader_id || data.channel_id || "",
      uploaderName: data.uploader || data.channel || "",
    });
  } catch (err) {
    console.error("[metadata]", err.message);
    res.status(500).json({ error: err.message.slice(0, 300) });
  }
});

// ─── POST /download ───
// Downloads video, uploads to R2, returns R2 key
app.post("/download", auth, async (req, res) => {
  try {
    const { url, targetKey } = req.body;
    if (!url) return res.status(400).json({ error: "url required" });

    const key = targetKey || `mbs-references/${randomUUID().slice(0, 8)}.mp4`;

    // Get metadata first for duration check
    const metaStdout = await ytdlp([
      "--dump-json", "--skip-download", "--no-warnings", url,
    ]);
    const meta = JSON.parse(metaStdout.trim());

    const maxDuration = url.includes("facebook.com") ? 60 : 30;
    if (meta.duration > maxDuration) {
      return res.status(400).json({ error: `Video too long: ${meta.duration}s (max ${maxDuration}s)` });
    }

    // Download to stdout as mp4 (with Facebook cookie support)
    const dlArgs = [
      "-o", "-",
      "-f", "best[ext=mp4]/best",
      "--no-warnings",
    ];
    // Inject Facebook cookies if needed
    if (url.includes("facebook.com") && process.env.FB_COOKIES_BASE64) {
      const fs = require("fs");
      const path = require("path");
      const cookiePath = path.join(require("os").tmpdir(), "fb_cookies.txt");
      if (!fs.existsSync(cookiePath)) {
        fs.writeFileSync(cookiePath, Buffer.from(process.env.FB_COOKIES_BASE64, "base64").toString("utf8"));
      }
      dlArgs.unshift("--cookies", cookiePath);
    }
    dlArgs.push(url);

    const videoBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      const proc = execFile("yt-dlp", dlArgs, { timeout: 120000, maxBuffer: 200 * 1024 * 1024, encoding: "buffer" }, (err, stdout) => {
        if (err) return reject(new Error(`Download failed: ${err.message}`));
        resolve(stdout);
      });
    });

    if (videoBuffer.length < 1000) {
      return res.status(500).json({ error: `Downloaded video too small: ${videoBuffer.length} bytes` });
    }

    // Upload to R2
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: videoBuffer,
      ContentType: "video/mp4",
    }));

    console.log(`[download] ${url} → R2 ${key} (${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB)`);

    res.json({
      r2Key: key,
      durationSec: meta.duration,
      fileSizeBytes: videoBuffer.length,
      thumbnailUrl: meta.thumbnail || "",
    });
  } catch (err) {
    console.error("[download]", err.message);
    res.status(500).json({ error: err.message.slice(0, 300) });
  }
});

// ─── POST /list-creator-posts ───
// Lists recent posts from a creator's profile
app.post("/list-creator-posts", auth, async (req, res) => {
  try {
    const { profileUrl, maxItems = 10 } = req.body;
    if (!profileUrl) return res.status(400).json({ error: "profileUrl required" });

    // For Facebook profiles, try /videos/ then /reels/ to list their content
    let scrapeUrl = profileUrl;
    const isFacebook = profileUrl.includes("facebook.com");
    if (isFacebook && !profileUrl.includes("/videos") && !profileUrl.includes("/reels")) {
      scrapeUrl = profileUrl.replace(/\/+$/, "") + "/videos/";
    }

    let stdout;
    try {
      stdout = await ytdlp([
        "--dump-json",
        "--skip-download",
        "--no-warnings",
        "--flat-playlist",
        "--playlist-end", String(maxItems),
        scrapeUrl,
      ], 90000);
    } catch (firstErr) {
      // For Facebook, fallback to /reels/ if /videos/ fails
      if (isFacebook && scrapeUrl.includes("/videos/")) {
        const reelsUrl = scrapeUrl.replace("/videos/", "/reels/");
        console.log(`[list] Retrying with ${reelsUrl}`);
        stdout = await ytdlp([
          "--dump-json",
          "--skip-download",
          "--no-warnings",
          "--flat-playlist",
          "--playlist-end", String(maxItems),
          reelsUrl,
        ], 90000);
      } else {
        throw firstErr;
      }
    }

    const lines = stdout.trim().split("\n").filter(Boolean);
    const posts = lines.map((line) => {
      try {
        const data = JSON.parse(line);
        return {
          id: data.id || "",
          url: data.url || data.webpage_url || "",
          title: data.title || "",
          duration: data.duration || 0,
          viewCount: data.view_count || 0,
          uploadDate: data.upload_date || "",
          thumbnailUrl: data.thumbnail || "",
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    console.log(`[list] ${profileUrl} → ${posts.length} posts`);
    res.json({ posts });
  } catch (err) {
    console.error("[list]", err.message);
    res.status(500).json({ error: err.message.slice(0, 300), posts: [] });
  }
});

// ─── POST /apply-branding ───
// Downloads video, applies MBS branding overlays via ffmpeg, uploads to R2
app.post("/apply-branding", auth, async (req, res) => {
  try {
    const { inputVideoUrl, outputR2Key, hookText, characterName, ctaText } = req.body;
    if (!inputVideoUrl || !outputR2Key) {
      return res.status(400).json({ error: "inputVideoUrl and outputR2Key required" });
    }

    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    const tmp = os.tmpdir();

    const inputPath = path.join(tmp, `brand-input-${Date.now()}.mp4`);
    const logoPath = path.join(tmp, `logo-${Date.now()}.png`);
    const hookPath = path.join(tmp, `hook-${Date.now()}.png`);
    const ctaPath = path.join(tmp, `cta-${Date.now()}.png`);
    const footerPath = path.join(tmp, `footer-${Date.now()}.png`);
    const outputPath = path.join(tmp, `brand-output-${Date.now()}.mp4`);

    // 1. Download input video
    console.log(`[branding] Downloading ${inputVideoUrl.slice(0, 60)}...`);
    const videoRes = await fetch(inputVideoUrl);
    if (!videoRes.ok) throw new Error(`Download failed: ${videoRes.status}`);
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    fs.writeFileSync(inputPath, videoBuffer);
    console.log(`[branding] Downloaded ${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB`);

    // 2. Generate overlay PNGs using ffmpeg's built-in text rendering
    // MBS Logo (top-right corner watermark)
    const logoSvg = `<svg width="250" height="80" xmlns="http://www.w3.org/2000/svg">
      <text x="125" y="55" font-family="Impact,Arial Black,sans-serif" font-size="48" font-weight="900"
            fill="#FFD700" stroke="#000" stroke-width="4" text-anchor="middle" paint-order="stroke">⭐MBS⭐</text>
    </svg>`;
    const { execSync } = require("child_process");

    // Generate logo PNG
    fs.writeFileSync(logoPath.replace('.png', '.svg'), logoSvg);
    execSync(`ffmpeg -y -i ${logoPath.replace('.png', '.svg')} -vf "scale=250:80" ${logoPath} 2>/dev/null || true`);
    // Fallback: create a simple colored rectangle with text if svg fails
    if (!fs.existsSync(logoPath) || fs.statSync(logoPath).size < 100) {
      execSync(`ffmpeg -y -f lavfi -i "color=c=0x000000@0.0:s=250x80:d=1,format=rgba" -frames:v 1 ${logoPath} 2>/dev/null`);
    }

    // Hook text overlay (top center, big bold)
    const hook = (hookText || `Meet ${characterName || "MBS Star"} 🔥`).replace(/'/g, "'\\''");
    const hookFilter = `drawtext=text='${hook}':fontsize=72:fontcolor=#FFD700:borderw=5:bordercolor=black:x=(w-text_w)/2:y=120:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`;

    // CTA text (bottom, last 2.5 seconds)
    const cta = (ctaText || "Drop ⭐ for RESPECT!").replace(/'/g, "'\\''");

    // 3. Get video duration
    let duration = 10;
    try {
      const probeOut = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${inputPath} 2>/dev/null`).toString().trim();
      duration = parseFloat(probeOut) || 10;
    } catch { /* use default */ }
    console.log(`[branding] Video duration: ${duration.toFixed(1)}s`);

    const ctaStart = Math.max(0, duration - 2.5);

    // Escape text for ffmpeg drawtext (: and ' need escaping)
    function esc(t) { return t.replace(/\\/g, "\\\\\\\\").replace(/:/g, "\\\\:").replace(/'/g, "'\\\\\\\\''"); }

    // Strip emoji for ffmpeg (drawtext can't render them on Alpine)
    function stripEmoji(t) { return t.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{1F900}-\u{1F9FF}]/gu, "").replace(/\s+/g, " ").trim(); }

    const safeHook = esc(stripEmoji(hook));
    const safeCta = esc(stripEmoji(cta));
    const safeName = esc(stripEmoji(characterName || "MBS Star"));

    // 4. Build ffmpeg filter with ASCII-safe text
    const fontOpt = "fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
    const vf = [
      `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black`,
      `drawtext=text='*MBS*':${fontOpt}:fontsize=42:fontcolor=#FFD700:borderw=3:bordercolor=black:x=w-tw-30:y=30`,
      `drawtext=text='${safeHook}':${fontOpt}:fontsize=64:fontcolor=#FFD700:borderw=5:bordercolor=black:x=(w-tw)/2:y=120:enable='between(t,0.3,2.8)'`,
      `drawtext=text='Meet ${safeName}':${fontOpt}:fontsize=48:fontcolor=white:borderw=3:bordercolor=black:x=(w-tw)/2:y=h-280:enable='between(t,1.0,3.5)'`,
      `drawtext=text='${safeCta}':${fontOpt}:fontsize=44:fontcolor=#FF6B2B:borderw=3:bordercolor=black:x=(w-tw)/2:y=h-180:enable='gte(t,${ctaStart})'`,
      `drawtext=text='Mzansi Baby Stars':${fontOpt}:fontsize=28:fontcolor=#FFD700@0.8:borderw=2:bordercolor=black@0.6:x=(w-tw)/2:y=h-50`,
    ].join(",");

    const ffmpegArgs = [
      "-y", "-i", inputPath,
      "-vf", vf,
      "-map", "0:a?",
      "-c:v", "libx264", "-preset", "fast", "-crf", "22",
      "-c:a", "copy",
      "-movflags", "+faststart",
      outputPath,
    ];

    console.log(`[branding] Running ffmpeg...`);
    await new Promise((resolve, reject) => {
      execFile("ffmpeg", ffmpegArgs, { timeout: 120000, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          console.error("[branding] ffmpeg stderr:", stderr?.slice(-500));
          return reject(new Error(`ffmpeg failed: ${err.message}`));
        }
        resolve();
      });
    });

    const brandedBuffer = fs.readFileSync(outputPath);
    console.log(`[branding] Branded video: ${(brandedBuffer.length / 1024 / 1024).toFixed(1)}MB`);

    // 5. Upload to R2
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: outputR2Key,
      Body: brandedBuffer,
      ContentType: "video/mp4",
    }));

    // 6. Cleanup temp files
    [inputPath, logoPath, logoPath.replace('.png', '.svg'), hookPath, ctaPath, footerPath, outputPath]
      .forEach(f => { try { fs.unlinkSync(f); } catch {} });

    const publicUrl = `https://pub-891668ae91a142968457a5383e993020.r2.dev/${outputR2Key}`;
    console.log(`[branding] Done → ${publicUrl}`);

    res.json({ r2Key: outputR2Key, publicUrl, fileSizeBytes: brandedBuffer.length });
  } catch (err) {
    console.error("[branding]", err.message);
    res.status(500).json({ error: err.message.slice(0, 300) });
  }
});

// ─── POST /download-facebook ───
// Downloads a Facebook video using Graph API (no cookies needed)
app.post("/download-facebook", auth, async (req, res) => {
  try {
    const { url, accessToken, targetKey } = req.body;
    if (!url) return res.status(400).json({ error: "url required" });
    if (!accessToken) return res.status(400).json({ error: "accessToken required" });

    const key = targetKey || `mbs-references/${randomUUID().slice(0, 8)}.mp4`;

    // Extract video ID from various FB URL formats
    let videoId = null;
    // facebook.com/reel/123456
    const reelMatch = url.match(/\/reel\/(\d+)/);
    if (reelMatch) videoId = reelMatch[1];
    // facebook.com/watch?v=123456
    const watchMatch = url.match(/[?&]v=(\d+)/);
    if (watchMatch) videoId = watchMatch[1];
    // facebook.com/username/videos/123456
    const vidMatch = url.match(/\/videos\/(\d+)/);
    if (vidMatch) videoId = vidMatch[1];
    // facebook.com/share/v/XXXXX — need to resolve redirect
    if (!videoId && url.includes("/share/")) {
      try {
        const redirectRes = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
        const finalUrl = redirectRes.url;
        const m = finalUrl.match(/\/(?:reel|videos)\/(\d+)/) || finalUrl.match(/[?&]v=(\d+)/);
        if (m) videoId = m[1];
      } catch {}
    }

    if (!videoId) {
      return res.status(400).json({ error: `Could not extract video ID from URL: ${url.slice(0, 100)}` });
    }

    // Get video source URL via Graph API
    const graphUrl = `https://graph.facebook.com/v19.0/${videoId}?fields=source,length,description,title,thumbnails&access_token=${accessToken}`;
    const graphRes = await fetch(graphUrl);
    if (!graphRes.ok) {
      const errText = await graphRes.text();
      return res.status(500).json({ error: `Graph API: ${errText.slice(0, 200)}` });
    }
    const graphData = await graphRes.json();
    const sourceUrl = graphData.source;
    if (!sourceUrl) {
      return res.status(500).json({ error: "No source URL in Graph API response — video may be private" });
    }

    const duration = graphData.length || 0;
    if (duration > 60) {
      return res.status(400).json({ error: `Video too long: ${duration}s (max 60s)` });
    }

    // Download the video binary
    const videoRes = await fetch(sourceUrl);
    if (!videoRes.ok) {
      return res.status(500).json({ error: `Failed to download video: ${videoRes.status}` });
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    if (videoBuffer.length < 1000) {
      return res.status(500).json({ error: `Downloaded video too small: ${videoBuffer.length} bytes` });
    }

    // Upload to R2
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: videoBuffer,
      ContentType: "video/mp4",
    }));

    console.log(`[fb-download] ${videoId} → R2 ${key} (${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB, ${duration}s)`);

    res.json({
      r2Key: key,
      durationSec: duration,
      fileSizeBytes: videoBuffer.length,
      thumbnailUrl: graphData.thumbnails?.data?.[0]?.uri || "",
      title: graphData.title || graphData.description?.slice(0, 100) || "",
    });
  } catch (err) {
    console.error("[fb-download]", err.message);
    res.status(500).json({ error: err.message.slice(0, 300) });
  }
});

// ─── POST /list-facebook-videos ───
// Lists recent videos from a Facebook page/profile using Graph API
// Falls back to yt-dlp if Graph API fails
app.post("/list-facebook-videos", auth, async (req, res) => {
  try {
    const { profileUrl, maxItems = 10, accessToken } = req.body;
    if (!profileUrl) return res.status(400).json({ error: "profileUrl required" });

    const token = accessToken || process.env.FB_ACCESS_TOKEN;
    if (!token) {
      return res.status(400).json({ error: "No FB access token — set FB_ACCESS_TOKEN env var or pass accessToken" });
    }

    // Extract page ID or username from URL
    // Handles: facebook.com/pagename, facebook.com/profile.php?id=123, facebook.com/123456
    let pageId = profileUrl.replace(/https?:\/\/(www\.)?facebook\.com\//, "").replace(/\/.*$/, "").trim();
    if (profileUrl.includes("profile.php")) {
      const m = profileUrl.match(/id=(\d+)/);
      if (m) pageId = m[1];
    }

    // Fetch videos via Graph API
    const graphUrl = `https://graph.facebook.com/v19.0/${pageId}/videos?fields=id,title,description,length,views,permalink_url,thumbnails,created_time&limit=${maxItems}&access_token=${token}`;
    const graphRes = await fetch(graphUrl);

    if (!graphRes.ok) {
      const errText = await graphRes.text();
      console.error(`[fb-graph] API error for ${pageId}: ${graphRes.status} ${errText.slice(0, 200)}`);
      return res.status(500).json({ error: `Graph API: ${errText.slice(0, 200)}`, posts: [] });
    }

    const graphData = await graphRes.json();
    const posts = (graphData.data || []).map((v) => ({
      id: v.id || "",
      url: v.permalink_url ? `https://www.facebook.com${v.permalink_url}` : `https://www.facebook.com/${v.id}`,
      title: v.title || v.description?.slice(0, 100) || "",
      duration: v.length || 0,
      viewCount: v.views || 0,
      uploadDate: v.created_time || "",
      thumbnailUrl: v.thumbnails?.data?.[0]?.uri || "",
    }));

    console.log(`[fb-graph] ${pageId} → ${posts.length} videos`);
    res.json({ posts });
  } catch (err) {
    console.error("[fb-graph]", err.message);
    res.status(500).json({ error: err.message.slice(0, 300), posts: [] });
  }
});

// ─── POST /brand-genesis ───
// Adds Genesis Studio branding to any video:
// 1. "ivideostudio.ai" watermark (top-right, subtle)
// 2. 4-second outro with logo + voiceover "Created with iVideo Studio"
app.post("/brand-genesis", auth, async (req, res) => {
  try {
    const { inputVideoUrl, outputR2Key } = req.body;
    if (!inputVideoUrl || !outputR2Key) {
      return res.status(400).json({ error: "inputVideoUrl and outputR2Key required" });
    }

    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    const { execSync } = require("child_process");
    const tmp = os.tmpdir();

    const inputPath = path.join(tmp, `gs-input-${Date.now()}.mp4`);
    const outroPath = path.join(tmp, `gs-outro-${Date.now()}.mp4`);
    const outputPath = path.join(tmp, `gs-output-${Date.now()}.mp4`);
    const concatPath = path.join(tmp, `gs-concat-${Date.now()}.txt`);

    // 1. Download input video
    console.log(`[brand-genesis] Downloading ${inputVideoUrl.slice(0, 80)}...`);
    const videoRes = await fetch(inputVideoUrl);
    if (!videoRes.ok) throw new Error(`Download failed: ${videoRes.status}`);
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    fs.writeFileSync(inputPath, videoBuffer);

    // 2. Get video dimensions and duration
    let width = 1080, height = 1920, duration = 10;
    try {
      const probe = execSync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -show_entries format=duration -of csv=p=0 ${inputPath} 2>/dev/null`
      ).toString().trim().split("\n");
      const dims = probe[0]?.split(",");
      if (dims && dims.length >= 2) { width = parseInt(dims[0]) || 1080; height = parseInt(dims[1]) || 1920; }
      duration = parseFloat(probe[1]) || 10;
    } catch { /* use defaults */ }
    console.log(`[brand-genesis] Video: ${width}x${height}, ${duration.toFixed(1)}s`);

    // 3. Generate 4-second outro clip with ffmpeg
    const fontOpt = "fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
    const outroFilter = [
      `color=c=#0A0A0F:s=${width}x${height}:d=4`,
      // Gradient glow (simulated with semi-transparent rectangles)
      `drawbox=x=${Math.floor(width*0.2)}:y=${Math.floor(height*0.3)}:w=${Math.floor(width*0.6)}:h=${Math.floor(height*0.1)}:color=0x7c3aed@0.15:t=fill`,
      // "G" logo text (large, centered)
      `drawtext=text='G':${fontOpt}:fontsize=${Math.floor(height*0.08)}:fontcolor=#7c3aed:x=(w-tw)/2:y=h*0.3`,
      // "Genesis Studio" brand name
      `drawtext=text='Genesis Studio':${fontOpt}:fontsize=${Math.floor(height*0.035)}:fontcolor=white:x=(w-tw)/2:y=h*0.42`,
      // "AI Video Creation Platform"
      `drawtext=text='AI Video Creation Platform':${fontOpt}:fontsize=${Math.floor(height*0.02)}:fontcolor=#a78bfa:x=(w-tw)/2:y=h*0.48`,
      // Website URL
      `drawtext=text='ivideostudio.ai':${fontOpt}:fontsize=${Math.floor(height*0.028)}:fontcolor=#06b6d4:x=(w-tw)/2:y=h*0.56`,
      // "Create your own AI videos - 100 free credits"
      `drawtext=text='Create your own AI videos':${fontOpt}:fontsize=${Math.floor(height*0.022)}:fontcolor=#d4d4d8:x=(w-tw)/2:y=h*0.65`,
      `drawtext=text='100 Free Credits - No Credit Card':${fontOpt}:fontsize=${Math.floor(height*0.018)}:fontcolor=#a1a1aa:x=(w-tw)/2:y=h*0.69`,
    ].join(",");

    execSync(
      `ffmpeg -y -f lavfi -i "${outroFilter}" -t 4 -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p ${outroPath} 2>/dev/null`
    );
    console.log(`[brand-genesis] Outro clip generated`);

    // 4. Add watermark to main video + concatenate with outro
    const watermarkFilter = `drawtext=text='ivideostudio.ai':${fontOpt}:fontsize=${Math.floor(Math.min(width,height)*0.025)}:fontcolor=white@0.6:borderw=1:bordercolor=black@0.4:x=w-tw-20:y=20`;

    // First pass: add watermark to input, re-encode to match outro format
    const watermarkedPath = path.join(tmp, `gs-watermarked-${Date.now()}.mp4`);
    execSync(
      `ffmpeg -y -i ${inputPath} -vf "${watermarkFilter}" -c:v libx264 -preset fast -crf 22 -c:a aac -ar 44100 -ac 2 -movflags +faststart ${watermarkedPath} 2>/dev/null`
    );

    // Generate silent audio for outro (to match main video audio stream)
    const outroWithAudioPath = path.join(tmp, `gs-outro-audio-${Date.now()}.mp4`);
    execSync(
      `ffmpeg -y -i ${outroPath} -f lavfi -i anullsrc=r=44100:cl=stereo -c:v copy -c:a aac -shortest ${outroWithAudioPath} 2>/dev/null`
    );

    // Concatenate: watermarked video + outro
    fs.writeFileSync(concatPath, `file '${watermarkedPath}'\nfile '${outroWithAudioPath}'\n`);
    execSync(
      `ffmpeg -y -f concat -safe 0 -i ${concatPath} -c copy -movflags +faststart ${outputPath} 2>/dev/null`
    );

    const brandedBuffer = fs.readFileSync(outputPath);
    console.log(`[brand-genesis] Branded video: ${(brandedBuffer.length / 1024 / 1024).toFixed(1)}MB`);

    // 5. Upload to R2
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: outputR2Key,
      Body: brandedBuffer,
      ContentType: "video/mp4",
    }));

    // 6. Cleanup
    [inputPath, outroPath, outroWithAudioPath, watermarkedPath, outputPath, concatPath]
      .forEach(f => { try { fs.unlinkSync(f); } catch {} });

    console.log(`[brand-genesis] Done → ${outputR2Key}`);
    res.json({ r2Key: outputR2Key, fileSizeBytes: brandedBuffer.length });
  } catch (err) {
    console.error("[brand-genesis]", err.message);
    res.status(500).json({ error: err.message.slice(0, 300) });
  }
});

app.listen(PORT, () => {
  console.log(`genesis-scraper running on port ${PORT}`);
});
