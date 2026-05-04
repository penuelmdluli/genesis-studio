import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY || "" });

// Multi-scene Kling I2V with audio + merge can take 5 min
export const maxDuration = 300;

const KLING_I2V_MODEL = "fal-ai/kling-video/v2.6/pro/image-to-video";

// ─── Genre-Specific Performance Prompts ─────────────────────────────────────

const GENRE_PROMPTS: Record<string, string> = {
  hiphop:
    "Hip-hop artist performing with swagger and confidence, bold hand gestures, rhythmic head nods, intense eye contact with camera, streetwear energy, commanding presence, occasional pointing and fist pump",
  pop:
    "Pop star performing with infectious energy, bright smile, dynamic dance moves, expressive body movement, playful interaction with camera, stadium-level charisma, effortless charm",
  rnb:
    "R&B singer delivering smooth sensual performance, deep eye contact with camera, fluid body movement, touching chest and face expressively, intimate emotion, soulful delivery, slow confident swaying",
  rock:
    "Rock performer with intense raw energy, aggressive head movement, powerful vocal delivery, clenched fists, leaning into camera, veins visible from intensity, rebellious attitude, hair movement",
  afrobeats:
    "Afrobeats artist performing with vibrant rhythmic energy, infectious body rolls, shoulder shrugs, confident smile, Afro-dance influenced movement, celebration energy, cultural pride in every move",
  gospel:
    "Gospel singer delivering powerful spiritual performance, eyes closed in worship, raised hands, emotional tears of joy, whole-body feeling the music, choir-like passion, heavenly expression",
  electronic:
    "Electronic music artist performing with futuristic energy, sharp robotic movements, hands controlling invisible turntables, head bobbing to bass drops, laser-focused intensity, rave energy",
  acoustic:
    "Acoustic performer with intimate genuine emotion, gentle swaying, eyes alternating between closed feeling and direct camera connection, subtle hand movements, raw vulnerability, coffeehouse warmth",
};

// ─── Stage/Background Descriptions ──────────────────────────────────────────

const STAGE_PROMPTS: Record<string, string> = {
  concert:
    "massive concert stage with thousands of fans, dramatic spotlights, fog machines, LED screens showing visuals, epic arena atmosphere",
  studio:
    "professional music studio with moody lighting, microphone on boom arm, soundproof walls, neon accent lights, intimate recording session vibe",
  outdoor:
    "cinematic outdoor location at golden hour, city skyline in background, wind in hair, natural sunlight creating lens flares, urban music video aesthetic",
  "neon-club":
    "dark neon-lit nightclub, vibrant pink and blue neon lights reflecting off surfaces, smoke haze, dance floor energy, underground music scene",
  rooftop:
    "luxury rooftop at night, city lights sparkling below, modern architecture, string lights overhead, moonlit sky, premium music video location",
  abstract:
    "surreal abstract environment with floating geometric shapes, morphing colors, dreamlike particles, otherworldly dimension, artistic visual effects",
};

// ─── Energy Descriptions ────────────────────────────────────────────────────

const ENERGY_PROMPTS: Record<string, string> = {
  low: "slow deliberate movements, meditative calm, restrained emotion building beneath surface, minimal but purposeful gestures",
  medium: "balanced rhythmic movement, confident delivery, natural energy flow matching the beat, engaging performance without excess",
  high: "high-energy explosive movement, full body commitment, jumping, fast gestures, sweat visible, non-stop kinetic performance",
  explosive: "maximum intensity performance, screaming passion, violent head movement, full-body thrashing, crowd-surfing energy, absolutely unhinged commitment",
};

// ─── Shot Types for Multi-Scene Variety ─────────────────────────────────────

const SHOT_TYPES: Array<{ name: string; description: string }> = [
  { name: "extreme close-up", description: "Extreme close-up of face, every emotion visible, lips moving perfectly in sync, sweat and intensity in eyes, shallow depth of field blurring background" },
  { name: "medium shot", description: "Medium shot from waist up, full upper body movement visible, arms and hands gesturing expressively, dynamic body language" },
  { name: "wide shot", description: "Wide cinematic shot showing full body and stage environment, dramatic lighting illuminating the entire scene, epic scale" },
  { name: "low-angle power shot", description: "Low-angle shot looking up at performer, making them look powerful and dominant, dramatic backlighting creating silhouette edges" },
  { name: "side angle", description: "Dynamic side profile angle, capturing jaw movement and body posture, cinematic parallax, depth in frame" },
  { name: "over-shoulder", description: "Over-the-shoulder perspective as if from the crowd, performer commanding attention, stage lights flaring into lens" },
  { name: "dutch angle close-up", description: "Tilted dutch angle close-up, adding tension and edge, face partially in shadow, dramatic and moody framing" },
  { name: "tracking medium", description: "Camera slowly circling around performer in medium shot, revealing different angles, smooth cinematic camera movement" },
];

// ─── Helper: Build scene prompt ─────────────────────────────────────────────

function buildScenePrompt(
  sceneIndex: number,
  totalScenes: number,
  genre: string,
  energy: string,
  stage: string,
  customStage?: string
): string {
  // Determine shot type based on scene index
  let shot;
  if (sceneIndex === 0) {
    shot = SHOT_TYPES[0]; // Always start with close-up
  } else if (sceneIndex === 1) {
    shot = SHOT_TYPES[1]; // Medium shot second
  } else if (sceneIndex === 2) {
    shot = SHOT_TYPES[2]; // Wide shot third
  } else {
    // Remaining scenes cycle through variety shots
    const varietyShots = SHOT_TYPES.slice(3);
    shot = varietyShots[(sceneIndex - 3) % varietyShots.length];
  }

  const genrePerformance = GENRE_PROMPTS[genre] || GENRE_PROMPTS.pop;
  const energyDirection = ENERGY_PROMPTS[energy] || ENERGY_PROMPTS.medium;
  const stageDescription = stage === "custom" && customStage
    ? customStage
    : STAGE_PROMPTS[stage] || STAGE_PROMPTS.concert;

  return [
    `${shot.description}.`,
    `${genrePerformance}.`,
    `${energyDirection}.`,
    `Setting: ${stageDescription}.`,
    `Perfect lip synchronization to music, feeling every beat, body moving in rhythm.`,
    `Cinematic music video quality, professional lighting, shallow depth of field, color graded, 24fps film look.`,
  ].join(" ");
}

// ─── Main Route ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Rate limiting
    const rateCategory = user.plan === "free" ? "feature:free" : "feature:paid";
    const rateCheck = checkRateLimit(user.id, rateCategory);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before trying again.", resetAt: rateCheck.resetAt },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      faceImageUrl,
      musicUrl,
      genre,
      energy,
      scenes,
      aspectRatio,
      stage,
      customStage,
    } = body as {
      faceImageUrl: string;
      musicUrl: string;
      genre: string;
      energy: string;
      scenes: number;
      aspectRatio: string;
      stage: string;
      customStage?: string;
    };

    // Validate required fields
    if (!faceImageUrl) {
      return NextResponse.json({ error: "Face/character image is required" }, { status: 400 });
    }
    if (!musicUrl) {
      return NextResponse.json({ error: "Music audio file is required" }, { status: 400 });
    }
    if (!genre) {
      return NextResponse.json({ error: "Genre is required" }, { status: 400 });
    }
    if (!energy) {
      return NextResponse.json({ error: "Energy level is required" }, { status: 400 });
    }
    if (!scenes || scenes < 2 || scenes > 6) {
      return NextResponse.json({ error: "Scenes must be between 2 and 6" }, { status: 400 });
    }
    if (!aspectRatio) {
      return NextResponse.json({ error: "Aspect ratio is required" }, { status: 400 });
    }
    if (!stage) {
      return NextResponse.json({ error: "Stage/background is required" }, { status: 400 });
    }
    if (stage === "custom" && !customStage) {
      return NextResponse.json({ error: "Custom stage description is required when stage is 'custom'" }, { status: 400 });
    }

    // Plan check: must be creator+, or owner
    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount) {
      const allowedPlans = ["creator", "pro", "studio"];
      if (!allowedPlans.includes(user.plan)) {
        return NextResponse.json(
          { error: "Music Video Creator requires a Creator or higher plan" },
          { status: 403 }
        );
      }
    }

    // Calculate credit cost: 20 credits per scene (premium — Kling with native audio)
    const creditsCost = scenes * 20;

    // Deduct credits
    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        creditsCost,
        "",
        `Music Video: ${scenes} scenes, ${genre}, ${energy} energy`
      );
      if (!success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: creditsCost, balance: newBalance },
          { status: 402 }
        );
      }
    }

    // Check FAL key
    if (!process.env.FAL_KEY) {
      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, "", "Music Video service not configured — automatic refund");
      }
      return NextResponse.json(
        { error: "Music Video service is temporarily unavailable. Credits have been refunded." },
        { status: 503 }
      );
    }

    // Map aspect ratio
    const arMap: Record<string, { fal: string; db: "landscape" | "portrait" | "square" }> = {
      "16:9": { fal: "16:9", db: "landscape" },
      "9:16": { fal: "9:16", db: "portrait" },
      "1:1": { fal: "1:1", db: "square" },
    };
    const ar = arMap[aspectRatio] || arMap["16:9"];

    // Duration per scene: 5s each (Kling native audio works best at 5s segments)
    const durationPerScene = 5;
    const totalDuration = scenes * durationPerScene;

    // Create job record
    const job = await createJob({
      userId: user.id,
      type: "i2v",
      modelId: "kling-2.6",
      prompt: `Music Video: ${genre} | ${energy} energy | ${scenes} scenes | ${stage}`,
      inputImageUrl: faceImageUrl,
      inputVideoUrl: musicUrl,
      resolution: "720p",
      duration: totalDuration,
      fps: 30,
      isDraft: false,
      creditsCost,
      aspectRatio: ar.db,
      audioUrl: musicUrl,
    });

    console.log(`[MUSIC-VIDEO] Job ${job.id} created: ${scenes} scenes, ${genre}, ${energy}, ${stage}`);

    try {
      // ── Step 1: Build scene prompts and submit ALL to Kling in parallel ──
      console.log(`[MUSIC-VIDEO] Building ${scenes} scene prompts and submitting to Kling...`);

      const scenePrompts = Array.from({ length: scenes }, (_, i) =>
        buildScenePrompt(i, scenes, genre, energy, stage, customStage)
      );

      const sceneSubmissions = await Promise.all(
        scenePrompts.map(async (prompt, idx) => {
          try {
            const result = await fal.queue.submit(KLING_I2V_MODEL, {
              input: {
                prompt,
                image_url: faceImageUrl,
                duration: String(durationPerScene),
                aspect_ratio: ar.fal,
                native_audio: true,
              },
            });
            console.log(`[MUSIC-VIDEO] Scene ${idx + 1} submitted: ${result.request_id}`);
            return { idx, requestId: result.request_id, error: null };
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[MUSIC-VIDEO] Scene ${idx + 1} submit failed: ${errMsg}`);
            return { idx, requestId: null, error: errMsg };
          }
        })
      );

      // ── Step 2: Poll all scenes for completion (max 4 min, 10s interval) ──
      console.log("[MUSIC-VIDEO] Polling for scene completion...");

      const sceneResults: Array<{ idx: number; videoUrl: string | null }> = sceneSubmissions.map((s) => ({
        idx: s.idx,
        videoUrl: null,
      }));

      const pendingScenes = sceneSubmissions.filter((s) => s.requestId !== null);
      const completedSet = new Set<number>();

      for (let poll = 0; poll < 24; poll++) {
        // All done?
        if (completedSet.size >= pendingScenes.length) break;

        await new Promise((r) => setTimeout(r, 10000));

        for (const scene of pendingScenes) {
          if (completedSet.has(scene.idx)) continue;
          if (!scene.requestId) continue;

          try {
            const status = await fal.queue.status(KLING_I2V_MODEL, {
              requestId: scene.requestId,
              logs: false,
            });
            const statusStr = status.status as string;

            if (statusStr === "COMPLETED") {
              const result = await fal.queue.result(KLING_I2V_MODEL, {
                requestId: scene.requestId,
              });
              const data = result.data as Record<string, unknown>;
              const videoUrl =
                (data?.video_url as string) ||
                (data?.video as { url?: string })?.url ||
                "";
              sceneResults[scene.idx].videoUrl = videoUrl || null;
              completedSet.add(scene.idx);
              console.log(`[MUSIC-VIDEO] Scene ${scene.idx + 1} COMPLETED (poll ${poll + 1}/24)`);
            } else if (statusStr === "FAILED" || statusStr === "ERROR") {
              completedSet.add(scene.idx);
              console.error(`[MUSIC-VIDEO] Scene ${scene.idx + 1} ${statusStr} (poll ${poll + 1}/24)`);
            }
          } catch (pollErr) {
            console.warn(`[MUSIC-VIDEO] Poll error scene ${scene.idx + 1} (attempt ${poll + 1}):`, pollErr);
          }
        }

        console.log(`[MUSIC-VIDEO] Poll ${poll + 1}/24: ${completedSet.size}/${pendingScenes.length} scenes done`);
      }

      // Collect successful scene videos in order
      const successfulVideos = sceneResults
        .filter((s) => s.videoUrl)
        .sort((a, b) => a.idx - b.idx)
        .map((s) => s.videoUrl as string);

      if (successfulVideos.length === 0) {
        console.error("[MUSIC-VIDEO] All scenes failed — no videos generated");
        if (!ownerAccount) {
          await refundCredits(user.id, creditsCost, "", "Music Video — all scenes failed — automatic refund");
        }
        await updateJobStatus(job.id, { status: "failed" });
        return NextResponse.json(
          { error: "All scenes failed to generate. Credits refunded." },
          { status: 503 }
        );
      }

      const failedCount = scenes - successfulVideos.length;
      if (failedCount > 0) {
        console.warn(`[MUSIC-VIDEO] ${failedCount}/${scenes} scenes failed, continuing with ${successfulVideos.length} successful`);
        // Partial refund for failed scenes
        if (!ownerAccount) {
          const refundAmount = failedCount * 20;
          await refundCredits(user.id, refundAmount, "", `Music Video — ${failedCount} scene(s) failed — partial refund`);
        }
      }

      // ── Step 3: Concatenate all scene videos ──
      let finalVideoUrl: string;

      if (successfulVideos.length === 1) {
        finalVideoUrl = successfulVideos[0];
        console.log("[MUSIC-VIDEO] Single scene — skipping merge");
      } else {
        console.log(`[MUSIC-VIDEO] Merging ${successfulVideos.length} scene videos...`);
        const mergeResult = await fal.subscribe("fal-ai/ffmpeg-api/merge-videos", {
          input: { video_urls: successfulVideos },
          logs: false,
        });
        const mergeData = mergeResult.data as Record<string, unknown>;
        const mergedUrl =
          (mergeData?.video_url as string) ||
          (mergeData?.video as { url?: string })?.url ||
          "";

        if (!mergedUrl) {
          console.error("[MUSIC-VIDEO] Merge failed — using first scene as fallback");
          finalVideoUrl = successfulVideos[0];
        } else {
          finalVideoUrl = mergedUrl;
          console.log(`[MUSIC-VIDEO] Merge complete: ${mergedUrl.slice(0, 80)}...`);
        }
      }

      // ── Step 4: Persist to R2 and update job ──
      console.log("[MUSIC-VIDEO] Persisting final video to R2...");
      const { persistExternalVideo, videoStorageKey, r2PublicUrl } = await import("@/lib/storage");
      const storageKey = videoStorageKey(user.id, `music-video-${Date.now()}`);
      const persistedUrl = await persistExternalVideo(finalVideoUrl, storageKey);
      const outputUrl = persistedUrl || r2PublicUrl(storageKey);

      await updateJobStatus(job.id, {
        status: "completed",
        outputVideoUrl: outputUrl,
      });

      console.log(`[MUSIC-VIDEO] Job ${job.id} COMPLETE: ${outputUrl.slice(0, 80)}...`);

      return NextResponse.json({
        jobId: job.id,
        videoUrl: outputUrl,
        creditsCost,
        scenesGenerated: successfulVideos.length,
        scenesFailed: failedCount,
        totalDuration: successfulVideos.length * durationPerScene,
        genre,
        energy,
        stage,
      });
    } catch (pipelineError) {
      console.error("[MUSIC-VIDEO] Pipeline error:", pipelineError);

      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, "", "Music Video pipeline failed — automatic refund");
      }

      await updateJobStatus(job.id, { status: "failed" });

      return NextResponse.json(
        { error: "Music video generation failed. Credits refunded." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("[MUSIC-VIDEO] API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
