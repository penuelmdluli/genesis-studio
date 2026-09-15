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
// Adds iVideo Studio branding to any video:
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
      // "iVideo Studio" brand name
      `drawtext=text='iVideo Studio':${fontOpt}:fontsize=${Math.floor(height*0.035)}:fontcolor=white:x=(w-tw)/2:y=h*0.42`,
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

// Ported from the standalone genesis-scraper repository, which this
// service does NOT build from. /brand-custom was added there and so
// could never deploy; this copy is the one Render actually builds.
// ─── POST /brand-custom ───
// A paying creator's OWN logo on their OWN video. Takes a logo we host and
// burns it into a corner, optionally with their handle beside it.
//
// Deliberately narrow: the caller supplies a logo URL and a position from a
// fixed set, nothing that reaches a shell unescaped. The overlay is scaled
// relative to the video so it looks the same on a 9:16 reel and a 16:9 cut.
app.post("/brand-custom", auth, async (req, res) => {
  const fs = require("fs");
  const path = require("path");
  const os = require("os");
  const tmp = os.tmpdir();
  const stamp = Date.now();
  const inputPath = path.join(tmp, `bc-in-${stamp}.mp4`);
  const logoPath = path.join(tmp, `bc-logo-${stamp}.png`);
  const outputPath = path.join(tmp, `bc-out-${stamp}.mp4`);
  const cleanup = () => [inputPath, logoPath, outputPath].forEach((f) => { try { fs.unlinkSync(f); } catch {} });

  try {
    const { inputVideoUrl, logoUrl, brandName, position, outputR2Key } = req.body || {};
    if (!inputVideoUrl || !outputR2Key) {
      return res.status(400).json({ error: "inputVideoUrl and outputR2Key required" });
    }
    if (!logoUrl && !brandName) {
      return res.status(400).json({ error: "logoUrl or brandName required" });
    }

    const POSITIONS = {
      "top-left": { x: "W*0.04", y: "H*0.04" },
      "top-right": { x: "W-w-W*0.04", y: "H*0.04" },
      "bottom-left": { x: "W*0.04", y: "H-h-H*0.04" },
      "bottom-right": { x: "W-w-W*0.04", y: "H-h-H*0.04" },
    };
    const pos = POSITIONS[position] || POSITIONS["bottom-right"];

    const videoRes = await fetch(inputVideoUrl);
    if (!videoRes.ok) throw new Error(`could not fetch video (${videoRes.status})`);
    fs.writeFileSync(inputPath, Buffer.from(await videoRes.arrayBuffer()));

    let filter;
    if (logoUrl) {
      const logoRes = await fetch(logoUrl);
      if (!logoRes.ok) throw new Error(`could not fetch logo (${logoRes.status})`);
      fs.writeFileSync(logoPath, Buffer.from(await logoRes.arrayBuffer()));
      // Logo is 12% of the video width, aspect preserved, slightly transparent.
      filter = `[1:v]scale=iw*0.12*main_w/iw:-1[lg];[0:v][lg]overlay=${pos.x}:${pos.y}:format=auto`;
    }

    // A handle, if they set one, sits under the logo (or alone).
    let textFilter = "";
    if (brandName) {
      const safe = String(brandName).slice(0, 60).replace(/[\':%]/g, "");
      if (safe) {
        const ty = position && position.startsWith("top") ? "h*0.04+h*0.10" : "h-h*0.04-h*0.06";
        const tx = position && position.endsWith("left") ? "w*0.04" : "w-text_w-w*0.04";
        textFilter = `drawtext=text='${safe}':fontsize=h*0.028:fontcolor=white@0.92:borderw=2:bordercolor=black@0.6:x=${tx}:y=${ty}:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`;
      }
    }

    const { execFile } = require("child_process");
    const args = logoUrl
      ? ["-y", "-i", inputPath, "-i", logoPath, "-filter_complex", textFilter ? `${filter},${textFilter}` : filter]
      : ["-y", "-i", inputPath, "-vf", textFilter];
    args.push("-c:a", "copy", "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", outputPath);

    await new Promise((resolve, reject) => {
      execFile("ffmpeg", args, { maxBuffer: 1024 * 1024 * 32 }, (err, _out, stderr) => {
        if (err) return reject(new Error(`ffmpeg failed: ${String(stderr || err.message).slice(0, 300)}`));
        resolve();
      });
    });

    const branded = fs.readFileSync(outputPath);
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: outputR2Key,
      Body: branded,
      ContentType: "video/mp4",
    }));
    cleanup();

    console.log(`[brand-custom] Done → ${outputR2Key} (${(branded.length / 1024 / 1024).toFixed(1)}MB)`);
    res.json({ r2Key: outputR2Key, fileSizeBytes: branded.length });
  } catch (err) {
    cleanup();
    console.error("[brand-custom]", err.message);
    res.status(500).json({ error: String(err.message).slice(0, 300) });
  }
});

// ─── POST /stitch-episode ───
// Six clips are not an episode. This joins the shots of one episode into a
// single video the creator can actually watch, download and post, with the
// English subtitle burned onto each shot.
//
// Each shot carries exactly one line, so the subtitle is drawn across that
// whole clip rather than timed from a subtitle file. That removes the entire
// class of drift bugs that comes with building timings by hand.
//
// Clips arrive at slightly different sizes (the lip-sync model returns
// 1080x1916, the motion model 1080x1920), so every clip is normalised to one
// canvas, one frame rate and one audio layout before joining. Concatenating
// mismatched streams is the usual reason a join produces a file that plays
// for five seconds and stops.
// Jobs live here while they run. An episode takes minutes on this hardware —
// far longer than any HTTP request survives, and a synchronous version
// returned 524 after the caller gave up. The work is started, acknowledged,
// and polled.
const stitchJobs = new Map();

function pruneStitchJobs() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of stitchJobs) if (job.at < cutoff) stitchJobs.delete(id);
}

app.get("/stitch-episode/:jobId", auth, (req, res) => {
  const job = stitchJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "unknown job" });
  res.json({ status: job.status, r2Key: job.r2Key || null, fileSizeBytes: job.fileSizeBytes || null, error: job.error || null });
});

app.post("/stitch-episode", auth, async (req, res) => {
  const fs = require("fs");
  const path = require("path");
  const os = require("os");
  const { execFile } = require("child_process");
  const tmp = os.tmpdir();
  const stamp = Date.now();
  const scratch = [];
  const cleanup = () => scratch.forEach((f) => { try { fs.unlinkSync(f); } catch {} });

  const { Readable } = require("stream");
  const streamPipeline = require("util").promisify(require("stream").pipeline);

  const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

  // Height is chosen by the caller, defaulting to 720p.
  //
  // This box has 512MB and once died encoding 1080x1920 — Render reported
  // "Ran out of memory (used over 512MB)" three times. That was before clips
  // streamed to disk and x264 was pinned to one thread, both of which cut the
  // peak substantially, so 1080 may now fit. Making it a parameter means that
  // can be measured rather than guessed, and rolled back in one request if
  // the instance still cannot take it.
  const wanted = Number(req.body?.height) === 1920 ? 1920 : 1280;
  const H = wanted, W = wanted === 1920 ? 1080 : 720, FPS = 30;

  const run = (args, label) =>
    new Promise((resolve, reject) => {
      execFile("ffmpeg", args, { maxBuffer: 1024 * 1024 * 64 }, (err, _o, stderr) => {
        if (err) return reject(new Error(`${label}: ${String(stderr || err.message).slice(-400)}`));
        resolve();
      });
    });

  const probe = (file, streamType) =>
    new Promise((resolve) => {
      execFile(
        "ffprobe",
        ["-v", "error", "-select_streams", streamType, "-show_entries", "stream=codec_type", "-of", "csv=p=0", file],
        (err, out) => resolve(!err && String(out).trim().length > 0)
      );
    });

  // Long lines need breaking by hand: drawtext will happily run a sentence
  // off both edges of the frame.
  const wrap = (text, width) => {
    const words = String(text).replace(/\s+/g, " ").trim().split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      if ((line + " " + word).trim().length > width) {
        if (line) lines.push(line.trim());
        line = word;
      } else {
        line = (line + " " + word).trim();
      }
    }
    if (line) lines.push(line.trim());
    return lines.slice(0, 3).join("\n");
  };

  // Declared out here so a failure can still mark the job, which a
  // block-scoped id could not: the catch runs in a sibling scope.
  let jobId = null;

  try {
    const { clips, outputR2Key, burnSubtitles, watermark, musicUrl, musicVolume } = req.body || {};
    if (!Array.isArray(clips) || clips.length === 0) {
      return res.status(400).json({ error: "clips array required" });
    }
    if (!outputR2Key) return res.status(400).json({ error: "outputR2Key required" });
    if (clips.length > 20) return res.status(400).json({ error: "too many clips (max 20)" });

    pruneStitchJobs();
    jobId = `sj-${stamp}-${Math.random().toString(36).slice(2, 8)}`;
    stitchJobs.set(jobId, { status: "running", at: Date.now() });
    res.status(202).json({ jobId, status: "running", clips: clips.length });

    const normalised = [];

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i] || {};
      if (!clip.url) throw new Error(`clip ${i} has no url`);

      const rawPath = path.join(tmp, `st-raw-${stamp}-${i}.mp4`);
      const normPath = path.join(tmp, `st-norm-${stamp}-${i}.mp4`);
      scratch.push(rawPath, normPath);

      const got = await fetch(clip.url);
      if (!got.ok) throw new Error(`clip ${i} download failed (${got.status})`);
      // Streamed to disk. Reading a clip into a Buffer held the whole file in
      // memory alongside its arrayBuffer copy, on a box with 512MB total.
      await streamPipeline(Readable.fromWeb(got.body), fs.createWriteStream(rawPath));

      let filter = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS}`;

      // Pace. A speaking shot is already the length of its line; a silent one
      // arrives as a flat five seconds, which is an eternity in a format
      // where the whole episode is a minute. Trimming those is free here,
      // because the clip is being re-encoded anyway.
      const silent = !String(clip.subtitle || "").trim();
      const trimTo = clip.holdSeconds || (silent ? 3.2 : 0);

      const subtitle = burnSubtitles === false ? "" : String(clip.subtitle || "").trim();
      if (subtitle) {
        // One drawtext per line, never a newline inside the text.
        //
        // The server's ffmpeg shapes text with HarfBuzz, which turns a newline
        // character into a visible box glyph — every two-line subtitle came
        // out as "three trucks at□" with the second line below. A local build
        // without shaping drew it cleanly, which is why this slipped through.
        // Drawing each line on its own removes the character entirely, so it
        // cannot render on any build.
        const lines = wrap(subtitle, 34).split(String.fromCharCode(10)).filter(Boolean);
        const size = Math.round(W * 0.043);
        const gap = Math.round(size * 1.3);
        const bottom = Math.round(H * 0.09);
        lines.forEach((line, li) => {
          const subPath = path.join(tmp, `st-sub-${stamp}-${i}-${li}.txt`);
          scratch.push(subPath);
          // Written to a file rather than inlined: subtitle text contains
          // apostrophes and colons, which are filter syntax.
          fs.writeFileSync(subPath, line, "utf8");
          const fromBottom = bottom + (lines.length - 1 - li) * gap;
          filter +=
            `,drawtext=textfile='${subPath}':fontfile='${FONT}':fontsize=${size}:fontcolor=white` +
            `:borderw=3:bordercolor=black@0.85` +
            `:x=(w-text_w)/2:y=h-text_h-${fromBottom}`;
        });
      }

      // A shared episode should say where it was made. Drawn in the same pass
      // as the subtitle, so it costs nothing extra, and kept small and high
      // so it never fights the picture or the captions.
      if (watermark) {
        const markPath = path.join(tmp, `st-mark-${stamp}.txt`);
        if (!fs.existsSync(markPath)) fs.writeFileSync(markPath, String(watermark).slice(0, 40), "utf8");
        scratch.push(markPath);
        filter +=
          `,drawtext=textfile='${markPath}':fontfile='${FONT}':fontsize=${Math.round(W * 0.026)}` +
          `:fontcolor=white@0.72:borderw=2:bordercolor=black@0.45` +
          `:x=w-text_w-${Math.round(W * 0.04)}:y=${Math.round(H * 0.035)}`;
      }

      // The video model's own soundtrack is never taken by accident.
      //
      // Left to itself it invents audio, including invented speech (in
      // practice, Chinese) under every shot. So every clip's audio is replaced
      // outright: a speaking shot carries exactly the line it was given, and a
      // silent shot carries silence for the music to sit under. The one
      // deliberate exception is English dialogue, where the model was told
      // the exact line and its own track IS that line: the caller then passes
      // the filmed clip as the audio source below.
      // Usually our synthesised line (mp3). For English dialogue it is the
      // filmed clip itself (mp4): the video model spoke the line, and its
      // track is the speech. The extension follows the source so ffmpeg reads
      // the container it actually is.
      let voicePath = null;
      if (clip.audioUrl) {
        const voiceExt = /\.mp4(\?|$)/i.test(clip.audioUrl) ? "mp4" : "mp3";
        voicePath = path.join(tmp, `st-voice-${stamp}-${i}.${voiceExt}`);
        scratch.push(voicePath);
        const gotVoice = await fetch(clip.audioUrl);
        if (!gotVoice.ok) throw new Error(`clip ${i} voice download failed (${gotVoice.status})`);
        await streamPipeline(Readable.fromWeb(gotVoice.body), fs.createWriteStream(voicePath));
      }

      // The shot's sound effects (engines, footsteps, impacts), made from the
      // finished picture. Mixed under the voice, or carried alone when nobody
      // speaks. A failed download only costs the effects, never the shot.
      let sfxPath = null;
      if (clip.sfxUrl) {
        try {
          const candidate = path.join(tmp, `st-sfx-${stamp}-${i}.mp4`);
          scratch.push(candidate);
          const gotSfx = await fetch(clip.sfxUrl);
          if (!gotSfx.ok) throw new Error(`status ${gotSfx.status}`);
          await streamPipeline(Readable.fromWeb(gotSfx.body), fs.createWriteStream(candidate));
          sfxPath = candidate;
        } catch (err) {
          console.error(`[stitch-episode] clip ${i} sound effects skipped:`, err.message);
        }
      }

      const args = ["-y"];
      if (voicePath && sfxPath) {
        args.push("-i", rawPath, "-i", voicePath, "-i", sfxPath);
        filter += ",tpad=stop_mode=clone:stop_duration=30";
        args.push(
          "-filter_complex",
          `[0:v]${filter}[v];` +
            `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,apad=pad_dur=0.35[vo];` +
            `[2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.42,apad[fx];` +
            `[vo][fx]amix=inputs=2:duration=first:normalize=0[a]`,
          "-map", "[v]", "-map", "[a]",
          "-shortest"
        );
      } else if (sfxPath) {
        if (trimTo) args.push("-t", String(trimTo));
        args.push("-i", rawPath, "-i", sfxPath);
        args.push(
          "-filter_complex",
          `[0:v]${filter}[v];[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.9,apad[a]`,
          "-map", "[v]", "-map", "[a]",
          "-shortest"
        );
      } else if (voicePath) {
        // A line longer than the footage used to be cut off mid-word, which
        // is how a cliffhanger line went missing at the end of an episode.
        // The last frame is held for as long as the line needs instead.
        args.push("-i", rawPath, "-i", voicePath);
        filter += ",tpad=stop_mode=clone:stop_duration=30";
        args.push(
          "-vf", filter,
          // A beat of air after the line, so a short reply does not end the
          // instant the last word does.
          "-af", "apad=pad_dur=0.35",
          "-map", "0:v:0", "-map", "1:a:0",
          "-shortest"
        );
      } else {
        if (trimTo) args.push("-t", String(trimTo));
        args.push("-i", rawPath, "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
        args.push(
          "-vf", filter,
          "-map", "0:v:0", "-map", "1:a:0",
          "-shortest"
        );
      }
      args.push(
        "-threads", "1",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"
      );
      args.push(normPath);

      await run(args, `normalise clip ${i}`);
      try { fs.unlinkSync(rawPath); } catch {}
      normalised.push(normPath);
    }

    const listPath = path.join(tmp, `st-list-${stamp}.txt`);

    scratch.push(listPath);
    fs.writeFileSync(listPath, normalised.map((f) => `file '${f}'`).join("\n"), "utf8");

    const outputPath = path.join(tmp, `st-out-${stamp}.mp4`);
    scratch.push(outputPath);

    // Every part is now identical, so the join is a stream copy — fast, and
    // it does not re-compress what was just encoded.
    await run(
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-movflags", "+faststart", outputPath],
      "join"
    );

    // Score. A micro-drama without music under it reads as a rehearsal, and
    // mixing it here is nearly free: the picture is copied untouched and only
    // the audio is re-encoded, so this adds seconds rather than minutes and
    // barely touches memory.
    let finalPath = outputPath;
    if (musicUrl) {
      try {
        const musicPath = path.join(tmp, `st-music-${stamp}.mp3`);
        const mixedPath = path.join(tmp, `st-mixed-${stamp}.mp4`);
        scratch.push(musicPath, mixedPath);

        const gotMusic = await fetch(musicUrl);
        if (!gotMusic.ok) throw new Error(`music download failed (${gotMusic.status})`);
        await streamPipeline(Readable.fromWeb(gotMusic.body), fs.createWriteStream(musicPath));

        await run(
          [
            "-y",
            "-i", outputPath,
            // Looped so a short bed still covers a long episode; the mix ends
            // with the picture, never after it.
            "-stream_loop", "-1", "-i", musicPath,
            "-filter_complex",
            `[1:a]volume=${Number(musicVolume) > 0 ? Number(musicVolume) : 0.14}[bed];` +
              `[0:a][bed]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`,
            "-map", "0:v", "-map", "[a]",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
            mixedPath,
          ],
          "music mix"
        );
        finalPath = mixedPath;
      } catch (err) {
        // Losing the score is not worth losing the episode.
        console.error("[stitch-episode] music mix skipped:", err.message);
      }
    }

    const bytes = fs.statSync(finalPath).size;
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: outputR2Key,
      Body: fs.createReadStream(finalPath),
      ContentLength: bytes,
      ContentType: "video/mp4",
    }));

    // Normalised parts are only needed until the join; drop them before the
    // upload so peak memory and disk both stay low.
    normalised.forEach((f) => { try { fs.unlinkSync(f); } catch {} });

    cleanup();
    console.log(`[stitch-episode] ${clips.length} clips → ${outputR2Key} (${(bytes / 1024 / 1024).toFixed(1)}MB)`);
    stitchJobs.set(jobId, { status: "done", r2Key: outputR2Key, fileSizeBytes: bytes, at: Date.now() });
  } catch (err) {
    cleanup();
    console.error("[stitch-episode]", err.message);
    // The caller was acknowledged long ago, so the failure is recorded for
    // whoever polls rather than returned.
    if (jobId && stitchJobs.has(jobId)) {
      stitchJobs.set(jobId, { status: "error", error: String(err.message).slice(0, 400), at: Date.now() });
    } else if (!res.headersSent) {
      res.status(500).json({ error: String(err.message).slice(0, 400) });
    }
  }
});


// ─── POST /media-duration ───
// The true length of one or more media files, read by ffprobe on the server.
//
// Per-second tools used to be priced from a length the browser reported —
// and only for video inputs, so an audio-driven tool was billed as a flat
// minute. A three-minute song for a music video cost three minutes and was
// charged for one, and anyone could send a fake short length to pay less.
// Reading the length here, from the file itself, removes both.
app.post("/media-duration", auth, async (req, res) => {
  const { execFile } = require("child_process");
  const urls = Array.isArray(req.body?.urls) ? req.body.urls.slice(0, 6) : [];
  const probe = (url) =>
    new Promise((resolve) => {
      if (typeof url !== "string" || !/^https:\/\//.test(url)) return resolve(0);
      execFile(
        "ffprobe",
        ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", url],
        { timeout: 25000 },
        (err, out) => {
          const n = parseFloat(String(out || "").trim());
          resolve(!err && Number.isFinite(n) ? n : 0);
        }
      );
    });
  const durations = await Promise.all(urls.map(probe));
  res.json({ durations, total: durations.reduce((a, b) => a + b, 0) });
});

app.listen(PORT, () => {
  console.log(`genesis-scraper running on port ${PORT}`);
});
