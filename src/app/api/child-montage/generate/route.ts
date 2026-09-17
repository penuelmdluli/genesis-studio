// ============================================
// GENESIS STUDIO — Child montage: make the short film
// ============================================
// POST /api/child-montage/generate → { jobId, childFaceUrl }
//
// The face blend already invented the child and stored their photograph. This
// films three moments from that one photograph — first steps, breakfast,
// bedtime — and joins them into one short film with a score under it.
//
// Filming happens inside this request because one press has to produce one
// film; joining does not, because it takes minutes on our own box. So the
// request returns as soon as the join has been accepted and the client polls
// /api/child-montage/[jobId] for the file — the same split AI Action Figure
// and Series Studio use.
//
// All three scenes or none. A montage missing its middle is a broken output
// rather than a cheaper one, so a scene that does not render fails the whole
// run, refunds every credit, and says to try again. Nothing here ever
// delivers two thirds of a film and keeps the money for it.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, getJob, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { envString } from "@/lib/env";
import { submitWavespeedJob } from "@/lib/wavespeed";
import { getWsPrediction, wsStatusOf } from "@/lib/wavespeed-tools";
import { videoStorageKey } from "@/lib/storage";
import { toUserFacingProviderError, isOperatorActionable } from "@/lib/user-errors";
import { sendSlackAlert } from "@/lib/alerts";
import { generateScore } from "@/lib/series/score";
import { FACE_BLEND_TAG, childFaceUrlOf } from "@/lib/face-blend";
import {
  CLIP_SECONDS,
  MONTAGE_CREDITS,
  MONTAGE_HEIGHT,
  MONTAGE_JOB_PREFIX,
  MONTAGE_MUSIC_GENRE,
  MONTAGE_MUSIC_VOLUME,
  MONTAGE_RETRY_MESSAGE,
  MONTAGE_SCENES,
  MONTAGE_TAG,
  buildSceneMotionPrompt,
} from "@/lib/child-montage";

export const maxDuration = 300;

// Wall-clock budgets.
//
// maxDuration is 300 seconds and the join still has to be started after the
// last scene lands, so the waiting stages are capped rather than left to run
// until the platform kills the request — which would leave a creator charged
// with nothing to show and no code left running to refund them.
const SCENE_TIMEOUT_MS = 150_000;
const SCENE_POLL_MS = 5_000;

/**
 * How long the score gets once the picture is ready.
 *
 * It is started alongside the scenes rather than after them, so by the time
 * the last clip lands it has usually been finished for a minute. This is only
 * the grace for the case where it has not, and running out of it costs the
 * music and not the montage.
 */
const SCORE_GRACE_MS = 30_000;

interface Scene {
  index: number;
  title: string;
  predictionId: string | null;
  clipUrl: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUserByClerkId(clerkId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const rate = checkRateLimit(user.id, user.plan === "free" ? "feature:free" : "feature:paid");
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests — please wait a minute.", resetAt: rate.resetAt },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { blendJobId?: string };
    const blendJobId = String(body.blendJobId || "");
    if (!blendJobId) {
      return NextResponse.json({ error: "Make your child's face first" }, { status: 400 });
    }

    // The anchor comes off the blend job rather than off the request, so a
    // montage can only ever be filmed from a face this account paid to make.
    const blend = await getJob(blendJobId).catch(() => null);
    if (!blend || blend.user_id !== user.id || !(blend.prompt || "").startsWith(FACE_BLEND_TAG)) {
      return NextResponse.json({ error: "Face not found" }, { status: 404 });
    }
    if (blend.status !== "completed") {
      return NextResponse.json({ error: "That face is not finished yet" }, { status: 409 });
    }
    const childFaceUrl = childFaceUrlOf(blend);
    if (!childFaceUrl) {
      return NextResponse.json({ error: "That face is not finished yet" }, { status: 409 });
    }

    // The join runs on the video service, so with no service there is no film.
    // Checked before anything is charged rather than after three video calls
    // have been paid for.
    const serviceUrl = envString("SCRAPER_SERVICE_URL");
    const serviceSecret = envString("SCRAPER_SERVICE_SECRET");
    if (!serviceUrl || !serviceSecret) {
      return NextResponse.json(
        { error: "The montage is temporarily unavailable. Nothing was charged." },
        { status: 503 }
      );
    }

    const ownerAccount = isOwnerClerkId(clerkId);

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        MONTAGE_CREDITS,
        "",
        "Child montage: a day with our child"
      );
      if (!success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: MONTAGE_CREDITS, balance: newBalance },
          { status: 402 }
        );
      }
    }

    let job;
    try {
      job = await createJob({
        userId: user.id,
        type: "i2v",
        modelId: "wan-2.2",
        prompt: `${MONTAGE_TAG} a day with our child`,
        inputImageUrl: childFaceUrl,
        resolution: "1080p",
        duration: MONTAGE_SCENES.length * CLIP_SECONDS,
        fps: 30,
        isDraft: false,
        creditsCost: ownerAccount ? 0 : MONTAGE_CREDITS,
        aspectRatio: "portrait",
      });
    } catch (err) {
      // Charged, and then no row to refund against later. Nothing else would
      // ever resolve this one, so it is paid back here.
      if (!ownerAccount) {
        await refundCredits(user.id, MONTAGE_CREDITS, "", "Montage could not start — automatic refund");
      }
      throw err;
    }

    const charged = ownerAccount ? 0 : MONTAGE_CREDITS;

    try {
      await updateJobStatus(job.id, {
        status: "processing",
        progress: 10,
        provider: "wavespeed",
        thumbnailUrl: childFaceUrl,
        startedAt: new Date().toISOString(),
      });

      // The score is started here and collected after the picture, so the two
      // slowest things in the request run at the same time instead of one
      // after the other. It never throws — a failure returns null and the
      // montage is joined without music.
      const score = generateScore(MONTAGE_MUSIC_GENRE, MONTAGE_SCENES.length * CLIP_SECONDS);

      // ── 1. Three moments, each filmed from the stored face ──
      console.log(`[CHILD-MONTAGE] job ${job.id}: filming ${MONTAGE_SCENES.length} scenes`);
      const plan: Scene[] = MONTAGE_SCENES.map((scene, index) => ({
        index,
        title: scene.title,
        predictionId: null,
        clipUrl: null,
      }));

      await Promise.all(
        plan.map(async (scene) => {
          try {
            const submitted = await submitWavespeedJob({
              modelId: "wan-2.2",
              type: "i2v",
              prompt: buildSceneMotionPrompt(scene.index),
              imageUrl: childFaceUrl,
              duration: CLIP_SECONDS,
              aspectRatio: "portrait",
            });
            scene.predictionId = submitted.request_id;
          } catch (err) {
            console.error(`[CHILD-MONTAGE] job ${job.id}: "${scene.title}" would not submit:`, err);
          }
        })
      );

      const pending = plan.filter((s) => s.predictionId);
      if (pending.length < plan.length) throw new Error("a scene could not be filmed");

      const done = new Set<number>();
      const startedAt = Date.now();
      while (done.size < pending.length && Date.now() - startedAt < SCENE_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, SCENE_POLL_MS));
        for (const scene of pending) {
          if (done.has(scene.index) || !scene.predictionId) continue;
          try {
            const prediction = await getWsPrediction(scene.predictionId);
            const state = wsStatusOf(prediction);
            if (state === "COMPLETED") {
              scene.clipUrl = prediction.outputs?.[0] || null;
              done.add(scene.index);
            } else if (state === "FAILED") {
              console.error(
                `[CHILD-MONTAGE] job ${job.id}: "${scene.title}" failed: ${prediction.error || ""}`
              );
              done.add(scene.index);
            }
          } catch {
            // Transient — the next pass picks it up.
          }
        }
      }

      // All three or none. Unlike an advert, where a missing feature only
      // costs that feature, the montage IS the three moments — two of them is
      // not a shorter film, it is the wrong one.
      if (plan.some((s) => !s.clipUrl)) {
        throw new Error("a scene did not render in time");
      }

      await updateJobStatus(job.id, { progress: 70 });

      // ── 2. The music bed, if it arrived ──
      const musicUrl = await Promise.race([
        score,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SCORE_GRACE_MS)),
      ]);
      if (!musicUrl) console.warn(`[CHILD-MONTAGE] job ${job.id}: joining without music`);

      // ── 3. Join, with each moment's title burned onto the shot it names ──
      const videoId = randomUUID();
      const outputKey = videoStorageKey(user.id, `montage-${videoId}`);

      const stitch = await fetch(`${serviceUrl}/stitch-episode`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-scraper-secret": serviceSecret },
        body: JSON.stringify({
          clips: plan.map((scene) => ({
            url: scene.clipUrl,
            subtitle: scene.title,
            audioUrl: null,
          })),
          outputR2Key: outputKey,
          burnSubtitles: true,
          height: MONTAGE_HEIGHT,
          watermark: "ivideostudio.ai",
          musicUrl,
          musicVolume: MONTAGE_MUSIC_VOLUME,
        }),
      });

      if (!stitch.ok) {
        throw new Error(`join rejected (${stitch.status}): ${(await stitch.text()).slice(0, 200)}`);
      }

      const stitchBody = (await stitch.json()) as { jobId?: string };
      if (!stitchBody.jobId) throw new Error("the video service did not return a job");

      // The stitch job and the video id travel together on the row, so the
      // poll that collects the file knows where it landed without guessing.
      await updateJobStatus(job.id, {
        status: "processing",
        progress: 80,
        runpodJobId: `${MONTAGE_JOB_PREFIX}${stitchBody.jobId}|${videoId}`,
      });

      console.log(`[CHILD-MONTAGE] job ${job.id}: joining as ${videoId}`);

      return NextResponse.json({
        jobId: job.id,
        childFaceUrl,
        scenes: plan.length,
        creditsCost: charged,
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      console.error(`[CHILD-MONTAGE] job ${job.id} failed:`, raw);
      if (charged > 0) {
        await refundCredits(user.id, charged, job.id, "Montage failed — automatic refund");
      }
      // A scene that never arrived is not a provider error a creator can read
      // anything into; the only useful thing to say is that it is free to try
      // again. Everything else keeps the usual provider copy.
      const message = /scene/.test(raw) ? MONTAGE_RETRY_MESSAGE : toUserFacingProviderError(raw);
      await updateJobStatus(job.id, {
        status: "failed",
        errorMessage: message,
        completedAt: new Date().toISOString(),
      });
      sendSlackAlert({
        level: isOperatorActionable(raw) ? "critical" : "warning",
        title: "Child montage failed",
        message: `User: ${user.email}\nError: ${raw}`,
      }).catch(() => {});
      return NextResponse.json({ error: message, retry: true }, { status: 503 });
    }
  } catch (error) {
    console.error("[CHILD-MONTAGE] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
