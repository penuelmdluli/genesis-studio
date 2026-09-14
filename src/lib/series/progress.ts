// ============================================
// SERIES STUDIO — advancing a shot through its stages
// ============================================
// A shot is filmed, then (if somebody speaks) lip-synced onto that moving
// footage, then finished at a uniform size. This moves each one to its next
// stage and is safe to call repeatedly.
//
// It lives here rather than inside the episode route so the same logic can be
// exercised without a signed-in browser — the first version could only be
// advanced by a person loading a page, which made it impossible to verify.

import { getDb } from "@/lib/db-driver";
import { getWsPrediction } from "@/lib/wavespeed-tools";
import { submitUpscale, submitLipsync, submitFoley } from "@/lib/series/render";

export interface ShotRow {
  id: string;
  shot_index: number;
  status: string;
  /** "render" while filming, "lipsync" during speech, "upscale", then "foley" for sound. */
  stage: string | null;
  kind: string | null;
  audio_url: string | null;
  provider_ref: string | null;
  clip_url: string | null;
  raw_clip_url: string | null;
  action?: string | null;
  sfx_url?: string | null;
  created_at: string;
}

export const SHOT_SELECT =
  "id, shot_index, status, stage, kind, action, audio_url, clip_url, raw_clip_url, sfx_url, image_url, provider_ref, error, created_at";

/**
 * A shot that has been rendering for longer than this is not coming back.
 * Generous on purpose: the reaper once killed a render somebody had paid
 * for, and a stuck row costs nothing while a lost episode costs trust.
 */
const SHOT_TIMEOUT_MS = 45 * 60 * 1000;

/**
 * Brings still-running shots up to date. This happens on read rather than on
 * a timer because the page is already asking — a separate poller would be a
 * second thing to keep alive for no extra information.
 */
export async function refreshShots(
  db: ReturnType<typeof getDb>,
  rows: ShotRow[]
): Promise<void> {
  const pending = rows.filter((r) => r.status === "processing" && r.provider_ref?.startsWith("ws:"));
  if (pending.length === 0) return;

  await Promise.allSettled(
    pending.map(async (row) => {
      const ref = row.provider_ref!.slice(3);
      try {
        const prediction = await getWsPrediction(ref);

        const now = new Date().toISOString().slice(0, 19).replace("T", " ");

        if (prediction.status === "completed") {
          const url = prediction.outputs?.[0];
          if (!url) throw new Error("finished with no video");

          // The sound pass has finished: the shot is done. Checked first, so
          // its output is never mistaken for a picture to upscale.
          if (row.stage === "foley") {
            row.status = "completed";
            row.sfx_url = url;
            await db
              .from("series_shots")
              .update({ status: "completed", stage: "done", sfx_url: url, updated_at: now })
              .eq("id", row.id);
            return;
          }


          // The shot has been filmed. A speaking shot now gets the voice
          // matched onto the moving footage — this is the step that replaced
          // animating a still photograph, and it is why the scenes move.
          if (row.stage === "render" && row.kind === "dialogue" && row.audio_url) {
            try {
              const lipsyncRef = await submitLipsync(url, row.audio_url);
              row.stage = "lipsync";
              await db
                .from("series_shots")
                .update({ stage: "lipsync", clip_url: url, provider_ref: `ws:${lipsyncRef}`, updated_at: now })
                .eq("id", row.id);
              return;
            } catch (err) {
              // Rather lose the speech than the shot: a silent moving scene
              // still cuts into the episode.
              console.error(`[SERIES] lipsync could not start for shot ${row.shot_index}:`, err);
            }
          }

          // The scene exists. Now make it match the rest of the episode.
          if (row.stage !== "upscale") {
            try {
              const upscaleRef = await submitUpscale(url);
              row.stage = "upscale";
              row.raw_clip_url = url;
              await db
                .from("series_shots")
                .update({
                  stage: "upscale",
                  raw_clip_url: url,
                  clip_url: url,
                  provider_ref: `ws:${upscaleRef}`,
                  updated_at: now,
                })
                .eq("id", row.id);
              return;
            } catch (err) {
              // A finishing pass that will not start is not worth losing a
              // paid scene over — keep what we have and call it done.
              console.error(`[SERIES] upscale could not start for shot ${row.shot_index}:`, err);
            }
          }

          // Sound. The finished clip is listened to by a foley model that
          // makes the engines, footsteps, wind and impacts that belong to the
          // picture. Its output is only ever used as an audio track: the clip
          // the creator sees stays the upscaled one.
          try {
            const foleyRef = await submitFoley(url, row.action || "");
            row.stage = "foley";
            row.clip_url = url;
            await db
              .from("series_shots")
              .update({ stage: "foley", clip_url: url, provider_ref: `ws:${foleyRef}`, updated_at: now })
              .eq("id", row.id);
            return;
          } catch (err) {
            // A shot without sound effects still cuts into the episode.
            console.error(`[SERIES] foley could not start for shot ${row.shot_index}:`, err);
          }

          row.status = "completed";
          row.clip_url = url;
          await db
            .from("series_shots")
            .update({ status: "completed", stage: "done", clip_url: url, updated_at: now })
            .eq("id", row.id);
          return;
        }

        if (prediction.status === "failed") {
          // Same rule: if only the finishing pass failed, the creator still
          // gets the scene they paid for.
          // Losing only the sound pass keeps the finished picture.
          if (row.stage === "foley" && row.clip_url) {
            row.status = "completed";
            await db
              .from("series_shots")
              .update({ status: "completed", stage: "done", updated_at: now })
              .eq("id", row.id);
            return;
          }
          if (row.stage === "upscale" && row.raw_clip_url) {
            row.status = "completed";
            row.clip_url = row.raw_clip_url;
            await db
              .from("series_shots")
              .update({ status: "completed", stage: "done", clip_url: row.raw_clip_url, updated_at: now })
              .eq("id", row.id);
            return;
          }
          row.status = "failed";
          await db
            .from("series_shots")
            .update({ status: "failed", error: (prediction.error || "This scene could not be made").slice(0, 300) })
            .eq("id", row.id);
          return;
        }

        // Still working — unless it has been working far too long.
        const startedAt = Date.parse((row.created_at || "").replace(" ", "T") + "Z");
        if (Number.isFinite(startedAt) && Date.now() - startedAt > SHOT_TIMEOUT_MS) {
          row.status = "failed";
          await db
            .from("series_shots")
            .update({ status: "failed", error: "This scene timed out" })
            .eq("id", row.id);
        }
      } catch (err) {
        // A provider hiccup must not mark a paid shot as failed.
        console.error(`[SERIES] poll failed for shot ${row.shot_index}:`, err);
      }
    })
  );
}

