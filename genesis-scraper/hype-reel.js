// ============================================
// HYPE REELS — the edited, voiced, crowd-backed Genesis News format
// ============================================
//
// /genesis-reel/render cuts a random window from each clip and captions it
// from the clip's title. That made reels nobody watched. This is the format
// the owner signed off on (Soweto Derby Screamers, 2026-11-19), split so the
// part that needs judgement happens outside this service:
//
//   POST /hype/prepare  download WHOLE clips into WORK_DIR and draw timestamped
//                       frame sheets. The caller (the Next.js side, which has
//                       the `claude` CLI) reads the sheets from the same folder
//                       on the host and decides what each second shows.
//   POST /hype/render   take that edit — beats, shots, labels, captions and a
//                       commentary line per beat — and produce the reel:
//                       hype layout, the commentary (synthesised LOCALLY on
//                       the host and dropped into WORK_DIR) with echo, the
//                       footage's own crowd sound ducked under it, loudness
//                       at -11 LUFS, uploaded to R2. No paid audio APIs.
//   GET  /hype/job/:id  progress / result for either.
//
// WORK_DIR must be a volume shared with the host: docker run -v <host>:/work.

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { PutObjectCommand } = require("@aws-sdk/client-s3");

const WORK = process.env.WORK_DIR || "/work";
const W = 1080;
const H = 1920;
const FPS = 30;

// Anton is the condensed poster face the format is built on (Impact on the
// owner's PC); the Dockerfile fetches it. DejaVu Bold for the small print.
const firstExisting = (list) => list.find((f) => fs.existsSync(f)) || null;
const FONT_HYPE = firstExisting([
  "/usr/share/fonts/anton/Anton-Regular.ttf",
  "/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
]);
const FONT_SMALL = firstExisting([
  "/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]);
// Anton capitals average ~0.50em wide, DejaVu Bold ~0.74em.
const HYPE_EM = FONT_HYPE && FONT_HYPE.includes("Anton") ? 0.5 : 0.74;

const jobs = new Map();
const newJob = (kind) => {
  for (const [id, j] of jobs) if (j.at < Date.now() - 6 * 3600e3) jobs.delete(id);
  const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const job = { id, kind, at: Date.now(), status: "running", step: "starting" };
  jobs.set(id, job);
  return job;
};

function run(bin, args, label, timeoutMs = 0, cwd) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, cwd }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`${label}: ${String(stderr || err.message).trim().split("\n").slice(-3).join(" | ").slice(0, 400)}`));
      resolve(String(stdout));
    });
  });
}
const probe = (file, entries) =>
  run("ffprobe", ["-v", "error", "-show_entries", entries, "-of", "json", file], "ffprobe").then(JSON.parse);
const durationOf = async (file) => parseFloat((await probe(file, "format=duration")).format?.duration) || 0;

// ─── /hype/prepare ─────────────────────────────────────────

const srcPath = (id) => path.join(WORK, "src", `${id}.mp4`);

async function prepareClip(clip) {
  fs.mkdirSync(path.join(WORK, "src"), { recursive: true });
  fs.mkdirSync(path.join(WORK, "sheets"), { recursive: true });
  const file = srcPath(clip.id);
  if (!fs.existsSync(file) || fs.statSync(file).size < 100000) {
    await run(
      "yt-dlp",
      ["--no-warnings", "--no-playlist", "-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
        "--merge-output-format", "mp4", "-o", file, clip.url],
      `download ${clip.id}`,
      15 * 60 * 1000
    );
  }
  const info = await probe(file, "format=duration:stream=width,height,codec_type");
  const v = (info.streams || []).find((s) => s.codec_type === "video") || {};
  const durationSec = parseFloat(info.format?.duration) || 0;
  const hasAudio = (info.streams || []).some((s) => s.codec_type === "audio");

  // One frame every 2s, 30 to a sheet = a minute of footage per image, each
  // stamped with its second so the edit can point at exact moments.
  // The stamp is plain `t`: fps=1/2 keeps each frame's source timestamp. It
  // used to read t*2, which doubled every label, so every automated edit on
  // 2026-11-19 cut twice as far into its clips as it meant to (bench shots
  // for goals, outro cards, shots "past the end").
  //
  // Sheets are cached: a clip already on disk keeps the sheets drawn for it
  // (the marker records the sheet version, so pre-fix t*2 sheets are redrawn).
  // 288px tiles make a 1440px sheet — under the size Claude would shrink an
  // image to anyway, so nothing it sees is lost and it reads them faster.
  const marker = path.join(WORK, "sheets", `${clip.id}.v3`);
  const cached = fs.existsSync(marker) && fs.statSync(marker).mtimeMs >= fs.statSync(file).mtimeMs;
  if (!cached) {
    for (const old of fs.readdirSync(path.join(WORK, "sheets"))) {
      if (old.startsWith(`${clip.id}-`) || old.startsWith(`${clip.id}.v`)) fs.unlinkSync(path.join(WORK, "sheets", old));
    }
    const font = FONT_SMALL ? `fontfile='${FONT_SMALL}':` : "";
    await run(
      "ffmpeg",
      ["-v", "error", "-y", "-threads", "0", "-i", file, "-vf",
        `fps=1/2,scale=288:-2,drawtext=${font}text='%{eif\\:t\\:d}s':x=5:y=5:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.75,tile=5x6`,
        path.join(WORK, "sheets", `${clip.id}-%02d.png`)],
      `sheets ${clip.id}`,
      10 * 60 * 1000
    );
    fs.writeFileSync(marker, new Date().toISOString());
  }
  const sheets = fs.readdirSync(path.join(WORK, "sheets"))
    .filter((f) => f.startsWith(`${clip.id}-`) && f.endsWith(".png"))
    .sort()
    .map((f) => `sheets/${f}`);
  return { ...clip, durationSec, width: v.width || 0, height: v.height || 0, hasAudio, sheets };
}

// ─── /hype/render ──────────────────────────────────────────

const fit = (text, max, em) => Math.min(max, Math.floor((W * 0.92) / (Math.max(1, String(text).length) * em)));

// Framing: inside the clip's overlay-free area (clip.crop, measured on the
// host by scripts/genesis_overlay.py), at most 72% of the width. Mirrors
// framing() in src/lib/genesis-news/hype.ts — keep them the same.
function framing(c) {
  const b = c || { x: 0.04, y: 0.07, w: 0.92, h: 0.86 };
  const w = Math.min(b.w, 0.72);
  return { x: b.x + (b.w - w) / 2, y: b.y, w, h: b.h };
}

function shotFilter({ id, dir, beat, shot, flash, hold, mode, title, tag, credit, crop }) {
  const tf = (name, body) => {
    const p = path.join(dir, `t_${id}_${name}.txt`);
    fs.writeFileSync(p, String(body || ""), "utf8");
    return p;
  };
  const hype = FONT_HYPE ? `fontfile='${FONT_HYPE}'` : "font='DejaVu Sans'";
  const small = FONT_SMALL ? `fontfile='${FONT_SMALL}'` : "font='DejaVu Sans'";
  const labelMax = mode === "hook" ? 96 : 112;
  const lines = [
    `drawbox=x=0:y=60:w=${W}:h=230:color=black@0.6:t=fill`,
    `drawtext=${small}:textfile='${tf("tag", tag)}':fontsize=34:fontcolor=0xFFC83D:x=(w-tw)/2:y=82`,
    `drawtext=${hype}:textfile='${tf("title", title)}':fontsize=${fit(title, 92, HYPE_EM)}:fontcolor=white:borderw=3:bordercolor=black:x=(w-tw)/2:y=128`,
    `drawtext=${hype}:textfile='${tf("label", beat.label)}':fontsize=${fit(beat.label, labelMax, HYPE_EM)}:fontcolor=0xFFC83D:borderw=5:bordercolor=black:x=(w-tw)/2:y=360`,
  ];
  if (shot.cap1) lines.push(`drawtext=${hype}:textfile='${tf("c1", shot.cap1)}':fontsize=${fit(shot.cap1, 74, HYPE_EM)}:fontcolor=white:borderw=5:bordercolor=black:x=(w-tw)/2:y=1370`);
  if (shot.cap2) lines.push(`drawtext=${hype}:textfile='${tf("c2", shot.cap2)}':fontsize=${fit(shot.cap2, 74, HYPE_EM)}:fontcolor=0xFFC83D:borderw=5:bordercolor=black:x=(w-tw)/2:y=1465`);
  lines.push(`drawtext=${small}:textfile='${tf("cred", credit)}':fontsize=30:fontcolor=white@0.8:borderw=2:bordercolor=black@0.5:x=(w-tw)/2:y=1800`);

  // The clip's clean area, as large as the 1080x780 box allows, over a
  // blurred copy of itself.
  const f = framing(crop);
  return (
    `[0:v]crop=iw*${f.w.toFixed(3)}:ih*${f.h.toFixed(3)}:iw*${f.x.toFixed(3)}:ih*${f.y.toFixed(3)},split[a][b];` +
    `[b]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},scale=108:192,gblur=sigma=2,scale=${W}:${H},eq=brightness=-0.18:saturation=1.3[bg];` +
    `[a]scale=${W}:780:force_original_aspect_ratio=decrease,eq=contrast=1.08:saturation=1.18,unsharp=5:5:0.6[fg];` +
    `[bg][fg]overlay=(W-w)/2:560+(780-h)/2,fps=${FPS},setsar=1` +
    (hold > 0 ? `,tpad=stop_mode=clone:stop_duration=${hold.toFixed(2)}` : "") +
    (mode === "end" ? `,drawbox=x=0:y=0:w=iw:h=ih:color=black@0.55:t=fill` : "") +
    `,${lines.join(",")}` +
    (flash ? `,fade=in:st=0:d=0.18:color=white` : "") +
    `,format=yuv420p[v]`
  );
}

async function renderHype(job, { plan, clips }) {
  const dir = path.join(WORK, "jobs", job.id);
  fs.mkdirSync(dir, { recursive: true });
  const byId = new Map(clips.map((c) => [c.id, c]));

  // 1. Commentary is synthesised on the host (local Kokoro / edge-tts — no
  //    paid API) and arrives as files in the shared WORK_DIR. Its length
  //    decides how long each beat holds.
  job.step = "voice";
  const voiceFiles = await Promise.all(
    plan.beats.map(async (beat) => {
      if (!beat.voiceFile) return null;
      const f = path.join(WORK, beat.voiceFile);
      if (!fs.existsSync(f)) throw new Error(`voice file missing: ${beat.voiceFile}`);
      return { file: f, dur: await durationOf(f) };
    })
  );

  // 2. Cut every shot. Flow rules (owner, 2026-11-19: "there is a pause
  //    between the clips… the music plays and stops"):
  //    - a beat whose footage runs >1s past its line is trimmed, so the next
  //      beat starts ~0.4s after the narrator finishes — no dead air;
  //    - a beat whose line outruns its footage keeps PLAYING the source
  //      (the last shot runs on) and only freezes if the clip has ended;
  //    - the picture and the sound are cut separately: video pieces are
  //      video-only, the footage sound is cut as PCM and joined
  //      sample-exact with 10ms edges, so the crowd/music flows straight
  //      across every cut. (Per-piece AAC + 50-80ms fades made the bed drop
  //      out at every cut — AAC priming adds a gap to every joined piece.)
  job.step = "cutting";
  const pieces = [];
  const beds = [];
  const beatStarts = [];
  let t = 0;
  for (let b = 0; b < plan.beats.length; b++) {
    const beat = plan.beats[b];
    beatStarts.push(t);
    const shots = beat.shots.map((x) => ({ ...x }));
    const footage = shots.reduce((s, x) => s + x.dur, 0);
    const need = voiceFiles[b] ? voiceFiles[b].dur + 0.4 : footage;
    // Tighten: trim from the last shot backwards, never below 1.2s a shot.
    let excess = footage - need;
    if (excess > 1.0) {
      for (let s = shots.length - 1; s >= 0 && excess > 0.05; s--) {
        const cut = Math.min(excess, Math.max(0, shots[s].dur - 1.2));
        shots[s].dur -= cut;
        excess -= cut;
      }
    }
    // Run on: extend the last shot from the source before ever freezing.
    let extra = Math.max(0, need - shots.reduce((s, x) => s + x.dur, 0));
    const last = shots[shots.length - 1];
    const lastClip = byId.get(last.clip);
    const room = Math.max(0, (Number(lastClip.durationSec) || 0) - (last.start + last.dur) - 0.2);
    const runOn = Math.min(extra, room);
    last.dur += runOn;
    extra = Math.min(extra - runOn, 4);

    for (let s = 0; s < shots.length; s++) {
      const shot = shots[s];
      const clip = byId.get(shot.clip);
      const hold = s === shots.length - 1 ? extra : 0;
      const id = `${String(b).padStart(2, "0")}_${s}`;
      const out = path.join(dir, `p_${id}.mp4`);
      const fc = shotFilter({
        id, dir, beat, shot, hold, crop: clip.crop,
        flash: s === 0 && beat.mode !== "hook",
        mode: beat.mode,
        title: plan.title,
        tag: plan.tag || "GENESIS NEWS",
        credit: `© ${clip.creator} · ${clip.license || "CC BY 3.0"}`.slice(0, 60),
      });
      const fcFile = path.join(dir, `f_${id}.txt`);
      fs.writeFileSync(fcFile, fc);
      await run("ffmpeg", ["-v", "error", "-y", "-ss", String(shot.start), "-t", shot.dur.toFixed(3), "-i", srcPath(clip.id),
        "-filter_complex_script", fcFile, "-map", "[v]", "-an", "-t", (shot.dur + hold).toFixed(3),
        "-threads", "0", "-c:v", "libx264", "-preset", "medium", "-crf", "18", out], `cut ${id}`, 5 * 60 * 1000);
      pieces.push(out);
      // The sound for exactly this piece's length, as PCM.
      const len = await durationOf(out);
      const wav = path.join(dir, `a_${id}.wav`);
      if (clip.hasAudio === false) {
        await run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000", "-t", len.toFixed(3), "-c:a", "pcm_s16le", wav], `bed ${id}`);
      } else {
        await run("ffmpeg", ["-v", "error", "-y", "-ss", String(shot.start), "-t", shot.dur.toFixed(3), "-i", srcPath(clip.id), "-vn",
          "-af", `aformat=sample_rates=48000:channel_layouts=stereo,afade=in:d=0.01,afade=out:st=${Math.max(0, shot.dur - 0.01).toFixed(3)}:d=0.01,apad`,
          "-t", len.toFixed(3), "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", wav], `bed ${id}`);
      }
      beds.push(wav);
      t += len;
    }
  }
  const listFile = path.join(dir, "list.txt");
  fs.writeFileSync(listFile, pieces.map((p) => `file '${p}'`).join("\n"));
  const cut = path.join(dir, "cut.mp4");
  await run("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", cut], "concat");
  const bedList = path.join(dir, "beds.txt");
  fs.writeFileSync(bedList, beds.map((p) => `file '${p}'`).join("\n"));
  const bed = path.join(dir, "bed.wav");
  await run("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", bedList, "-c", "copy", bed], "bed concat");
  const total = await durationOf(cut);

  // 3. Mix: commentator compressed, brightened, a short stadium slap-back;
  //    the footage's own crowd ducks under him; the lot normalised LOUD
  //    (-11 LUFS, limited at -1 dBTP) — the owner wants it to jump out of the
  //    feed, not sit at the -14 everyone else does.
  job.step = "mix";
  // Input 0: the picture. Input 1: the continuous footage sound. 2..: voices.
  const inputs = ["-i", cut, "-i", bed];
  const vo = [];
  voiceFiles.forEach((v, b) => {
    if (!v) return;
    inputs.push("-i", v.file);
    vo.push({ idx: vo.length + 2, at: Math.round(beatStarts[b] * 1000) + 60 });
  });
  const crowdGain = Number(plan.crowdGain) > 0 ? Number(plan.crowdGain) : 0.9;
  const parts = vo.map((v, k) => `[${v.idx}:a]aresample=48000,adelay=${v.at}:all=1[v${k}]`);
  const voiceChain =
    `${vo.map((_, k) => `[v${k}]`).join("")}amix=inputs=${vo.length}:normalize=0:duration=longest,aformat=sample_rates=48000:channel_layouts=stereo,` +
    `highpass=f=90,equalizer=f=3200:t=q:w=1.2:g=4,equalizer=f=180:t=q:w=1:g=2,` +
    `acompressor=threshold=-22dB:ratio=4:attack=5:release=90:makeup=6dB,aecho=0.85:0.55:55|110:0.22|0.10,volume=2.0`;
  const tail = `apad,atrim=0:${total.toFixed(3)},loudnorm=I=-11:TP=-1:LRA=8,alimiter=limit=0.89:level=false[aout]`;
  const graph = vo.length
    ? [...parts,
        `${voiceChain},asplit=2[voice][key]`,
        `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=60,volume=${crowdGain}[crowd]`,
        // Gentler duck with a slow release: the bed dips under the voice
        // and glides back, instead of pumping in and out between lines.
        `[crowd][key]sidechaincompress=threshold=0.04:ratio=3:attack=25:release=700:makeup=1[duck]`,
        `[voice][duck]amix=inputs=2:normalize=0:duration=longest,${tail}`].join(";")
    : `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,${tail}`;
  const mixFile = path.join(dir, "mix.txt");
  fs.writeFileSync(mixFile, graph);
  const final = path.join(dir, "final.mp4");
  await run("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex_script", mixFile, "-map", "0:v", "-map", "[aout]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", total.toFixed(3), "-movflags", "+faststart", final], "mix", 5 * 60 * 1000);

  job.step = "upload";
  const bytes = fs.statSync(final).size;
  return { final, bytes, duration: await durationOf(final) };
}

module.exports = function registerHype(app, auth, r2, BUCKET) {
  app.get("/hype/job/:id", auth, (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: "unknown job" });
    const { id, kind, status, step, error, result } = job;
    res.json({ id, kind, status, step, error, result });
  });

  app.post("/hype/prepare", auth, (req, res) => {
    const clips = (req.body?.clips || []).filter((c) => c && c.id && c.url).slice(0, 6);
    if (!clips.length) return res.status(400).json({ error: "clips required" });
    const job = newJob("prep");
    res.status(202).json({ jobId: job.id });
    (async () => {
      const ready = [];
      const failed = [];
      // All clips at once: downloads wait on the network, sheets on the CPU,
      // so in parallel they overlap instead of queueing.
      job.step = `clips ${clips.map((c) => c.id).join(",")}`;
      await Promise.all(clips.map(async (c) => {
        try {
          if (Number(c.durationSec) > 15 * 60) throw new Error("longer than 15 minutes");
          ready.push(await prepareClip(c));
        } catch (err) {
          // Takedowns, region blocks, age gates: normal on borrowed footage.
          failed.push({ id: c.id, error: String(err.message).slice(0, 200) });
        }
      }));
      ready.sort((a, b) => clips.findIndex((c) => c.id === a.id) - clips.findIndex((c) => c.id === b.id));
      job.result = { ready, failed, workDir: WORK };
      job.status = ready.length ? "done" : "error";
      if (!ready.length) job.error = `no clip could be downloaded: ${failed.map((f) => f.error).join(" / ").slice(0, 300)}`;
    })().catch((err) => { job.status = "error"; job.error = err.message; });
  });

  app.post("/hype/render", auth, (req, res) => {
    const { plan, clips, outputR2Key } = req.body || {};
    if (!outputR2Key) return res.status(400).json({ error: "outputR2Key required" });
    if (!plan?.beats?.length) return res.status(400).json({ error: "plan.beats required" });
    const byId = new Map((clips || []).map((c) => [c.id, c]));
    for (const beat of plan.beats) {
      if (!beat.shots?.length) return res.status(400).json({ error: `beat "${beat.label}" has no shots` });
      for (const s of beat.shots) {
        const c = byId.get(s.clip);
        if (!c || !c.creator) return res.status(400).json({ error: `shot uses unknown clip ${s.clip}` });
        if (!fs.existsSync(srcPath(s.clip))) return res.status(400).json({ error: `clip ${s.clip} not prepared` });
        s.start = Math.max(0, Number(s.start) || 0);
        s.dur = Math.min(Math.max(Number(s.dur) || 2, 0.8), 8);
      }
    }
    const job = newJob("render");
    res.status(202).json({ jobId: job.id });
    renderHype(job, { plan, clips })
      .then(async (r) => {
        await r2.send(new PutObjectCommand({
          Bucket: BUCKET, Key: outputR2Key, Body: fs.createReadStream(r.final), ContentLength: r.bytes, ContentType: "video/mp4",
        }));
        const used = [...new Set(plan.beats.flatMap((b) => b.shots.map((s) => s.clip)))].map((id) => byId.get(id));
        job.result = {
          r2Key: outputR2Key, duration: r.duration, bytes: r.bytes,
          credits: used.map((c) => ({ id: c.id, title: c.title, creator: c.creator, license: c.license || "CC BY 3.0" })),
        };
        job.status = "done";
        job.step = "done";
        console.log(`[hype] ${job.id} → ${outputR2Key} (${(r.bytes / 1048576).toFixed(1)}MB, ${r.duration.toFixed(1)}s)`);
        fs.rmSync(path.join(WORK, "jobs", job.id), { recursive: true, force: true });
      })
      .catch((err) => {
        console.error("[hype] render failed:", err.message);
        job.status = "error";
        job.error = String(err.message).slice(0, 500);
      });
  });
};
