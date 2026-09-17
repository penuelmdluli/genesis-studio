// ============================================
// GENESIS STUDIO — Face blend: invent the child
// ============================================
// POST /api/face-blend → { jobId, childFaceUrl }
//
// Two uploaded photographs in, one invented child's face out, stored against a
// job row that every later generation step reads its anchor from. Nothing
// downstream exists yet; this runs first on purpose, because a pipeline that
// films scene one before the child has a face has nothing to keep the child
// looking like itself in scene two.
//
// One gate stands in front of it and it is mandatory: the uploader states that
// both people in the photographs consented. Two faces are being used here and
// only one of them belongs to whoever is at the keyboard, so the checkbox is
// checked on this side of the wire as well as in the page — see the consent
// block below.
//
// The blended face is copied into our own storage before the job is marked
// done. The provider's URL expires; the anchor has to still resolve when the
// video steps run, which may be much later.

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { runWsModelSync } from "@/lib/wavespeed-tools";
import { uploadToR2, inputImageStorageKey, verifyR2Upload, r2PublicUrl } from "@/lib/storage";
import { toUserFacingProviderError, isOperatorActionable } from "@/lib/user-errors";
import { sendSlackAlert } from "@/lib/alerts";
import { BLEND_CREDITS, FACE_BLEND_TAG, buildChildFacePrompt } from "@/lib/face-blend";

export const maxDuration = 180;

/**
 * The same reference-shot editor Series Studio and AI Action Figure draw their
 * stills with. It takes more than one reference image, which is what makes it
 * the face-blend model here: two photographs and one prompt, rather than a
 * separate blending pass we would have to run ourselves.
 */
const BLEND_MODEL = "google/nano-banana-pro/edit";

/** Long enough for one edit, short enough to answer inside maxDuration. */
const BLEND_TIMEOUT_MS = 110_000;

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
      photoAUrl?: string;
      photoBUrl?: string;
      consent?: boolean;
    };

    const photoAUrl = String(body.photoAUrl || "");
    const photoBUrl = String(body.photoBUrl || "");
    if (!/^https:\/\/\S+$/.test(photoAUrl) || !/^https:\/\/\S+$/.test(photoBUrl)) {
      return NextResponse.json({ error: "Upload a photo of each partner first" }, { status: 400 });
    }
    // One photograph used twice is not a blend, and the model would happily
    // charge us to hand back the same face.
    if (photoAUrl === photoBUrl) {
      return NextResponse.json({ error: "Upload two different photos — one of each person" }, { status: 400 });
    }

    // Checked here and not only in the page. A checkbox the server never sees
    // is a decoration, and this one is the only record that the second person
    // in these photographs agreed to any of it.
    if (body.consent !== true) {
      return NextResponse.json(
        { error: "Please confirm both people consent to their photos being used." },
        { status: 400 }
      );
    }

    const ownerAccount = isOwnerClerkId(clerkId);

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(user.id, BLEND_CREDITS, "", "Face blend: child reference face");
      if (!success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: BLEND_CREDITS, balance: newBalance },
          { status: 402 }
        );
      }
    }

    // The row is an i2v job on the i2v workhorse because of what it is for:
    // the face it carries is what the later steps film from. Only partner A's
    // photograph goes on the row — there is one input column, and the two
    // originals are not what anything downstream reads.
    let job;
    try {
      job = await createJob({
        userId: user.id,
        type: "i2v",
        modelId: "wan-2.2",
        prompt: `${FACE_BLEND_TAG} invented child reference face`,
        inputImageUrl: photoAUrl,
        resolution: "1080p",
        duration: 0,
        fps: 30,
        isDraft: false,
        creditsCost: ownerAccount ? 0 : BLEND_CREDITS,
        aspectRatio: "portrait",
      });
    } catch (err) {
      // Charged, and then no row to refund against later. Nothing else would
      // ever resolve this one, so it is paid back here.
      if (!ownerAccount) {
        await refundCredits(user.id, BLEND_CREDITS, "", "Face blend could not start — automatic refund");
      }
      throw err;
    }

    try {
      await updateJobStatus(job.id, {
        status: "processing",
        progress: 10,
        provider: "wavespeed",
        startedAt: new Date().toISOString(),
      });

      console.log(`[FACE-BLEND] job ${job.id}: blending two photos into one child`);
      const blend = await runWsModelSync(
        BLEND_MODEL,
        { prompt: buildChildFacePrompt(), images: [photoAUrl, photoBUrl], output_format: "png" },
        { timeoutMs: BLEND_TIMEOUT_MS }
      );
      const providerUrl = Array.isArray(blend?.outputs) ? String(blend.outputs[0] || "") : "";
      if (!providerUrl) throw new Error("the blended face came back empty");

      // Onto our own storage before the job is called done, and filed as an
      // input image rather than a thumbnail — an input is what it is, since
      // every later step feeds it back into a model.
      const stored = await fetch(providerUrl);
      if (!stored.ok) throw new Error(`the blended face could not be fetched (${stored.status})`);
      const buffer = Buffer.from(await stored.arrayBuffer());
      if (buffer.length === 0) throw new Error("the blended face downloaded empty");

      const key = inputImageStorageKey(user.id, `child-face-${job.id}.png`);
      await uploadToR2(key, buffer, "image/png");
      // Read back before the job says the anchor exists. Everything after this
      // step trusts that url without checking it again.
      await verifyR2Upload(key);
      const childFaceUrl = r2PublicUrl(key);

      // Stored against the job, and the job is finished: this step renders no
      // video, so leaving it processing would only hand it to the reaper to
      // fail and refund half an hour later.
      await updateJobStatus(job.id, {
        status: "completed",
        progress: 100,
        thumbnailUrl: childFaceUrl,
        completedAt: new Date().toISOString(),
      });

      console.log(`[FACE-BLEND] job ${job.id}: child face stored at ${key}`);

      return NextResponse.json({ jobId: job.id, childFaceUrl, creditsCost: ownerAccount ? 0 : BLEND_CREDITS });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      console.error(`[FACE-BLEND] job ${job.id} failed:`, raw);
      if (!ownerAccount) {
        await refundCredits(user.id, BLEND_CREDITS, job.id, "Face blend failed — automatic refund");
      }
      await updateJobStatus(job.id, {
        status: "failed",
        errorMessage: toUserFacingProviderError(raw),
        completedAt: new Date().toISOString(),
      });
      sendSlackAlert({
        level: isOperatorActionable(raw) ? "critical" : "warning",
        title: "Face blend failed",
        message: `User: ${user.email}\nError: ${raw}`,
      }).catch(() => {});
      return NextResponse.json({ error: toUserFacingProviderError(raw) }, { status: 503 });
    }
  } catch (error) {
    console.error("[FACE-BLEND] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
