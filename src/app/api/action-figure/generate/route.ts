// ============================================
// GENESIS STUDIO — AI Action Figure: make the commercial
// ============================================
// POST /api/action-figure/generate → { jobId, figureImageUrl }
//
// Four stages, four engines that already work (see lib/action-figure.ts):
// the selfie is edited into a boxed collectible, each special feature is
// filmed from that one still, the announcer reads the features, and the video
// service burns each line onto the shot that speaks it.
//
// Filming happens inside this request because the whole point of the tool is
// that one press produces one video; joining does not, because it takes
// minutes on our own box. So the request returns as soon as the join has been
// accepted and the client polls /api/action-figure/[jobId] for the file —
// the same split Series Studio uses.
//
// Two gates stand in front of all of it, and both are mandatory:
//   consent    the creator states the photograph is theirs to use
//   blocklist  the figure may not be a known public figure
// Neither is sufficient alone. The blocklist reads names, not faces, and the
// checkbox is what covers a photograph uploaded under a made-up one.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { getDb } from "@/lib/db-driver";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { envString } from "@/lib/env";
import { synthesiseSpeech } from "@/lib/edge-tts";
import { runWsModelSync, getWsPrediction, wsStatusOf } from "@/lib/wavespeed-tools";
import { submitWavespeedJob } from "@/lib/wavespeed";
import { uploadAudio, audioStorageKey, r2PublicUrl, videoStorageKey } from "@/lib/storage";
import { toUserFacingProviderError, isOperatorActionable } from "@/lib/user-errors";
import { sendSlackAlert } from "@/lib/alerts";
import { planAllows } from "@/lib/tools-registry";
import {
  MIN_FEATURES,
  SHOT_CREDITS,
  announcerVoice,
  blockedPublicFigure,
  buildFigureImagePrompt,
  buildShotMotionPrompt,
  commercialCredits,
  normaliseFeatures,
  normaliseFigureName,
  shotCount,
  ANNOUNCER_DELIVERY,
  PUBLIC_FIGURE_MESSAGE,
} from "@/lib/action-figure";

export const maxDuration = 300;

/** The same reference-shot editor Series Studio builds its stills with. */
const FIGURE_MODEL = "google/nano-banana-pro/edit";

// Wall-clock budgets.
//
// maxDuration is 300 seconds and the join still has to be started after the
// last shot lands, so the two waiting stages are capped rather than left to
// run until the platform kills the request — which would leave a creator
// charged with nothing to show and no code left running to refund them.
const FIGURE_TIMEOUT_MS = 110_000;
const SHOT_TIMEOUT_MS = 150_000;
const SHOT_POLL_MS = 5_000;

/** Height of the finished advert, matching a Series episode. */
const COMMERCIAL_HEIGHT = 1920;

interface Shot {
  index: number;
  feature: string;
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

    const body = (await req.json().catch(() => ({}))) as {
      selfieUrl?: string;
      figureName?: string;
      features?: string[] | string;
      voiceId?: string;
      consent?: boolean;
    };

    const selfieUrl = String(body.selfieUrl || "");
    if (!/^https:\/\/\S+$/.test(selfieUrl)) {
      return NextResponse.json({ error: "Upload a photo first" }, { status: 400 });
    }

    // Consent is checked here and not only in the page. A checkbox the server
    // never sees is a decoration.
    if (body.consent !== true) {
      return NextResponse.json(
        { error: "Please confirm the photo is yours, or that you have the person's permission." },
        { status: 400 }
      );
    }

    const figureName = normaliseFigureName(body.figureName || "");
    if (!figureName) {
      return NextResponse.json({ error: "Give your figure a name — it goes on the box" }, { status: 400 });
    }

    const features = normaliseFeatures(body.features || []);
    if (features.length < MIN_FEATURES) {
      return NextResponse.json(
        { error: `Write at least ${MIN_FEATURES} special features, one per line` },
        { status: 400 }
      );
    }

    const blocked = blockedPublicFigure(figureName, features.join(" "));
    if (blocked) {
      console.warn(`[ACTION-FIGURE] refused for ${user.email}: blocklist hit on "${blocked}"`);
      return NextResponse.json({ error: PUBLIC_FIGURE_MESSAGE }, { status: 403 });
    }

    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount && !planAllows(user.plan, "creator")) {
      return NextResponse.json(
        { error: "AI Action Figure needs the Creator plan or higher.", upgrade: true },
        { status: 403 }
      );
    }

    // The join runs on the video service, so with no service there is no
    // advert. Checked before anything is charged rather than after four
    // provider calls have been paid for.
    const serviceUrl = envString("SCRAPER_SERVICE_URL");
    const serviceSecret = envString("SCRAPER_SERVICE_SECRET");
    if (!serviceUrl || !serviceSecret) {
      return NextResponse.json(
        { error: "AI Action Figure is temporarily unavailable. Nothing was charged." },
        { status: 503 }
      );
    }

    const shots = shotCount(features.length);
    const credits = commercialCredits(features.length);

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        credits,
        "",
        `AI Action Figure: ${figureName}`
      );
      if (!success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: credits, balance: newBalance },
          { status: 402 }
        );
      }
    }

    const job = await createJob({
      userId: user.id,
      type: "i2v",
      modelId: "wan-2.2",
      prompt: `[action-figure] ${figureName}`,
      inputImageUrl: selfieUrl,
      resolution: "1080p",
      duration: shots * 5,
      fps: 30,
      isDraft: false,
      creditsCost: ownerAccount ? 0 : credits,
      aspectRatio: "portrait",
    });

    // What the creator is actually out of pocket right now. It comes down
    // when a shot is paid back mid-run, so a failure afterwards refunds what
    // is still held rather than the original price a second time.
    let charged = ownerAccount ? 0 : credits;
    const refund = async (reason: string) => {
      if (charged > 0) await refundCredits(user.id, charged, job.id, reason);
    };

    try {
      // ── 1. The selfie becomes a boxed collectible ──
      console.log(`[ACTION-FIGURE] job ${job.id}: drawing the boxed figure`);
      const figure = await runWsModelSync(
        FIGURE_MODEL,
        { prompt: buildFigureImagePrompt(figureName), images: [selfieUrl], output_format: "png" },
        { timeoutMs: FIGURE_TIMEOUT_MS }
      );
      const figureImageUrl = Array.isArray(figure?.outputs) ? String(figure.outputs[0] || "") : "";
      if (!figureImageUrl) throw new Error("the boxed figure came back empty");

      await updateJobStatus(job.id, {
        status: "processing",
        progress: 20,
        thumbnailUrl: figureImageUrl,
        provider: "wavespeed",
        startedAt: new Date().toISOString(),
      });

      // ── 2. One shot per special feature, filmed from that still ──
      const plan: Shot[] = features.slice(0, shots).map((feature, index) => ({
        index,
        feature,
        predictionId: null,
        clipUrl: null,
      }));

      await Promise.all(
        plan.map(async (shot) => {
          try {
            const submitted = await submitWavespeedJob({
              modelId: "wan-2.2",
              type: "i2v",
              prompt: buildShotMotionPrompt(shot.index),
              imageUrl: figureImageUrl,
              duration: 5,
              aspectRatio: "portrait",
            });
            shot.predictionId = submitted.request_id;
          } catch (err) {
            console.error(`[ACTION-FIGURE] job ${job.id}: shot ${shot.index + 1} would not submit:`, err);
          }
        })
      );

      const pending = plan.filter((s) => s.predictionId);
      if (pending.length === 0) throw new Error("no shot could be filmed");

      const done = new Set<number>();
      const startedAt = Date.now();
      while (done.size < pending.length && Date.now() - startedAt < SHOT_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, SHOT_POLL_MS));
        for (const shot of pending) {
          if (done.has(shot.index) || !shot.predictionId) continue;
          try {
            const prediction = await getWsPrediction(shot.predictionId);
            const state = wsStatusOf(prediction);
            if (state === "COMPLETED") {
              shot.clipUrl = prediction.outputs?.[0] || null;
              done.add(shot.index);
            } else if (state === "FAILED") {
              console.error(`[ACTION-FIGURE] job ${job.id}: shot ${shot.index + 1} failed: ${prediction.error || ""}`);
              done.add(shot.index);
            }
          } catch {
            // Transient — the next pass picks it up.
          }
        }
      }

      const filmed = plan.filter((s) => s.clipUrl);
      if (filmed.length === 0) throw new Error("no shot finished in time");

      // A shot that never arrived was never rendered, so it is paid back at
      // the price it was charged — the same partial refund Product Ads does.
      //
      // The row's own cost comes down with it. That number is what the poll
      // endpoint and the job reapers refund from, and leaving it at the full
      // price would pay the missing shots back a second time.
      const missing = shots - filmed.length;
      if (missing > 0) {
        console.warn(`[ACTION-FIGURE] job ${job.id}: ${missing} of ${shots} shots missing, cutting the rest`);
        if (charged > 0) {
          await refundCredits(
            user.id,
            missing * SHOT_CREDITS,
            job.id,
            `AI Action Figure — ${missing} shot(s) did not render — partial refund`
          );
          charged -= missing * SHOT_CREDITS;
          await getDb().from("generation_jobs").update({ credits_cost: charged }).eq("id", job.id);
        }
      }

      await updateJobStatus(job.id, { progress: 70 });

      // ── 3. The announcer reads each feature ──
      const voice = announcerVoice(body.voiceId);
      const voiced = await Promise.all(
        filmed.map(async (shot) => {
          try {
            const audio = await synthesiseSpeech(shot.feature, voice, ANNOUNCER_DELIVERY);
            const buffer = Buffer.from(audio);
            if (buffer.length === 0) throw new Error("empty audio");
            const key = audioStorageKey(user.id, `figure-${job.id}-${shot.index}`);
            await uploadAudio(key, buffer);
            return { shot, audioUrl: r2PublicUrl(key) };
          } catch (err) {
            // A silent shot still carries its burned line, so a lost voice
            // costs the announcer and not the advert.
            console.error(`[ACTION-FIGURE] job ${job.id}: no voice for shot ${shot.index + 1}:`, err);
            return { shot, audioUrl: null };
          }
        })
      );

      // ── 4. Join, and burn each feature onto the shot that speaks it ──
      const videoId = randomUUID();
      const outputKey = videoStorageKey(user.id, `figure-${videoId}`);

      const stitch = await fetch(`${serviceUrl}/stitch-episode`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-scraper-secret": serviceSecret },
        body: JSON.stringify({
          clips: voiced.map(({ shot, audioUrl }) => ({
            url: shot.clipUrl,
            subtitle: shot.feature,
            audioUrl,
          })),
          outputR2Key: outputKey,
          burnSubtitles: true,
          height: COMMERCIAL_HEIGHT,
          watermark: "ivideostudio.ai",
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
        runpodJobId: `af:${stitchBody.jobId}|${videoId}`,
      });

      console.log(`[ACTION-FIGURE] job ${job.id}: ${filmed.length} shots joining as ${videoId}`);

      return NextResponse.json({
        jobId: job.id,
        figureImageUrl,
        shots: filmed.length,
        creditsCost: charged,
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      console.error(`[ACTION-FIGURE] job ${job.id} failed:`, raw);
      await refund("AI Action Figure failed — automatic refund");
      await updateJobStatus(job.id, {
        status: "failed",
        errorMessage: toUserFacingProviderError(raw),
        completedAt: new Date().toISOString(),
      });
      sendSlackAlert({
        level: isOperatorActionable(raw) ? "critical" : "warning",
        title: "AI Action Figure failed",
        message: `User: ${user.email}\nError: ${raw}`,
      }).catch(() => {});
      return NextResponse.json({ error: toUserFacingProviderError(raw) }, { status: 503 });
    }
  } catch (error) {
    console.error("[ACTION-FIGURE] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
