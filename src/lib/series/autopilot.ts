// ============================================
// SERIES STUDIO — the marketing autopilot
// ============================================
// Runs a drama series as an advert for the product that makes it. Twice a day
// it writes the next short episode, films it, voices it, joins it with the
// iVideo Studio end card, and posts it to a page — so the page always has a
// new episode, and every episode is an ad.
//
// A full episode takes around fifteen minutes of provider time, far longer
// than any single scheduled run is allowed, so this is a state machine: each
// tick moves ONE episode ONE step forward and returns. Nothing is held in
// memory between ticks; the database is the only record of where things are.
//
// Money guards, because this spends real money unattended:
//   - no new episode starts below the campaign's minimum provider balance;
//   - one episode at a time — a new slot never starts while one is in flight;
//   - a missed slot is dropped, not caught up, so an outage cannot fire a
//     backlog of episodes the moment things recover.

import { randomUUID } from "crypto";
import { getDb } from "@/lib/db-driver";
import { envString } from "@/lib/env";
import { writeEpisode, guessGender, type Shot } from "@/lib/series/writer";
import { ensureCast } from "@/lib/series/cast";
import { submitShot, type RenderContext } from "@/lib/series/render";
import { refreshShots, SHOT_SELECT, type ShotRow } from "@/lib/series/progress";
import { retryFailedShots, MAX_SHOT_ATTEMPTS } from "@/lib/series/retry";
import { startAssembly, collectAssembly, isAssembled } from "@/lib/series/assemble";
import { publishReel } from "@/lib/facebook-reels";
import { notifyOwner } from "@/lib/owner-notify";

export const END_CARD_URL = "https://cdn.ivideostudio.ai/marketing/series-studio/endcard.mp4";

/** A slot that passed longer ago than this is skipped rather than caught up. */
const SLOT_WINDOW_MIN = 180;

/** A post claim older than this is treated as a crashed attempt and retried. */
const POST_CLAIM_TTL_MS = 15 * 60 * 1000;

export interface Campaign {
  id: string;
  series_id: string;
  page_key: string;
  enabled: number;
  slots: string;
  shot_count: number;
  min_balance: number;
  last_slot: string | null;
}

export interface TickResult {
  campaign: string;
  action: string;
  detail?: unknown;
}

function sqlNow(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

/**
 * The most recent posting slot that has already passed today, in South
 * African time, if it passed recently enough to still be worth running.
 */
export function dueSlot(slots: string, now = new Date()): string | null {
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const date = sast.toISOString().slice(0, 10);
  const minutesNow = sast.getUTCHours() * 60 + sast.getUTCMinutes();

  let best: string | null = null;
  let bestMinutes = -1;
  for (const raw of slots.split(",")) {
    const slot = raw.trim();
    const match = /^(\d{1,2}):(\d{2})$/.exec(slot);
    if (!match) continue;
    const minutes = Number(match[1]) * 60 + Number(match[2]);
    const passed = minutesNow - minutes;
    if (passed >= 0 && passed <= SLOT_WINDOW_MIN && minutes > bestMinutes) {
      best = `${date}T${slot.padStart(5, "0")}`;
      bestMinutes = minutes;
    }
  }
  return best;
}

async function providerBalance(): Promise<number | null> {
  const key = envString("WAVESPEED_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://api.wavespeed.ai/api/v3/balance", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { balance?: number } };
    return Number(json.data?.balance ?? 0);
  } catch {
    return null;
  }
}

function captionFor(seriesTitle: string, episodeNumber: number, title: string, synopsis: string): string {
  const tag = `#${seriesTitle.replace(/[^A-Za-z0-9]/g, "")}`;
  return [
    `${seriesTitle} | Episode ${episodeNumber}: ${title}`,
    "",
    synopsis,
    "",
    "Every scene, every voice and every line of this drama was made with AI on iVideo Studio.",
    "Make your own drama series in English, isiZulu or Afrikaans. Start free at ivideostudio.ai",
    "",
    `${tag} #ShortDrama #Mzansi #SouthAfrica #AI`,
  ].join("\n");
}

/** Moves one campaign one step forward. */
export async function tickCampaign(campaign: Campaign): Promise<TickResult> {
  const db = getDb();
  const done = (action: string, detail?: unknown): TickResult => ({ campaign: campaign.id, action, detail });

  const { data: series } = await db.from("series").select("*").eq("id", campaign.series_id).maybeSingle();
  if (!series) return done("series-missing");

  const { data: latestRows } = await db
    .from("series_episodes")
    .select("*")
    .eq("series_id", campaign.series_id)
    .order("episode_number", { ascending: false })
    .limit(1);
  const latest = (latestRows || [])[0] as Record<string, unknown> | undefined;

  const ctx: RenderContext = {
    language: String(series.language || "en-ZA"),
    characterDescription: series.character_description || null,
    characterName: series.character_name || null,
    aspectRatio: "9:16",
  };

  // ── An episode is in flight: move it forward and stop. ──────────────────
  if (latest && !latest.posted_at && latest.status !== "abandoned") {
    const episodeId = String(latest.id);
    let shots: Shot[] = [];
    try {
      shots = (JSON.parse(String(latest.script || "{}")) as { shots?: Shot[] }).shots || [];
    } catch {
      await db.from("series_episodes").update({ status: "abandoned" }).eq("id", episodeId);
      return done("abandoned-unreadable-script", { episodeId });
    }

    const { data: rows } = await db
      .from("series_shots")
      .select(SHOT_SELECT)
      .eq("episode_id", episodeId)
      .order("shot_index", { ascending: true })
      .limit(20);
    const shotRows = (rows || []) as ShotRow[];

    // Written but never filmed.
    if (shotRows.length === 0) {
      await ensureCast(campaign.series_id, shots, ctx.language, guessGender);
      let submitted = 0;
      for (let index = 0; index < shots.length; index++) {
        const shot = shots[index];
        const rowId = `${episodeId}:${index}`;
        const { error: claimError } = await db.from("series_shots").insert({
          id: rowId,
          episode_id: episodeId,
          user_id: series.user_id,
          shot_index: index,
          kind: shot.kind,
          speaker: shot.speaker,
          dialogue: shot.dialogue,
          subtitle: shot.subtitle,
          action: shot.action,
          emotion: shot.emotion,
          status: "retrying",
          stage: "render",
          attempts: 1,
          updated_at: sqlNow(),
        });
        // Someone else already claimed this scene — never film it twice.
        if (claimError) continue;
        try {
          const r = await submitShot(shot, ctx, series.user_id, `${episodeId}-${index}-${Date.now()}`, campaign.series_id);
          await db
            .from("series_shots")
            .update({
              status: "processing",
              image_url: r.imageUrl,
              audio_url: r.audioUrl,
              provider_ref: `ws:${r.providerRef}`,
              updated_at: sqlNow(),
            })
            .eq("id", rowId);
          submitted++;
        } catch (err) {
          await db
            .from("series_shots")
            .update({ status: "failed", raw_error: String(err).slice(0, 400), updated_at: sqlNow() })
            .eq("id", rowId);
        }
      }
      await db.from("series_episodes").update({ status: "rendering" }).eq("id", episodeId);
      return done("filming-started", { episodeId, submitted, of: shots.length });
    }

    await refreshShots(db, shotRows);
    if (shotRows.some((r) => r.status === "failed")) {
      await retryFailedShots(episodeId, campaign.series_id, series.user_id, shots, series);
    }

    const { data: fresh } = await db
      .from("series_shots")
      .select("status, attempts")
      .eq("episode_id", episodeId)
      .limit(20);
    const states = (fresh || []) as Array<{ status: string; attempts: number | null }>;
    const finished = states.filter((s) => s.status === "completed").length;
    const deadFailures = states.filter((s) => s.status === "failed" && (s.attempts || 1) >= MAX_SHOT_ATTEMPTS).length;
    const moving = states.length - finished - deadFailures;

    if (moving > 0) return done("filming", { episodeId, finished, of: states.length });

    // Everything has landed. Too little to make an episode: give up on it
    // rather than hold the whole campaign behind one bad script.
    if (finished < 2) {
      await db.from("series_episodes").update({ status: "abandoned" }).eq("id", episodeId);
      return done("abandoned-too-few-shots", { episodeId, finished });
    }

    if (latest.status !== "completed") {
      await db.from("series_episodes").update({ status: "completed" }).eq("id", episodeId);
    }

    if (!latest.video_id) {
      if (latest.assembly_job) {
        const r = await collectAssembly(
          episodeId,
          series.user_id,
          String(latest.assembly_job),
          String(latest.title || `Episode ${latest.episode_number}`),
          series.title,
          finished
        );
        return done(isAssembled(r) ? "joined" : "joining", r);
      }
      const r = await startAssembly(
        episodeId,
        series.user_id,
        true,
        undefined,
        "ivideostudio.ai",
        series.genre || null,
        [{ url: END_CARD_URL }]
      );
      return done("joining-started", r);
    }

    // Joined — post it, once.
    const claim = String(latest.fb_post_id || "");
    if (claim.startsWith("posting:")) {
      const at = Number(claim.slice(8));
      if (Date.now() - at < POST_CLAIM_TTL_MS) return done("posting-in-progress", { episodeId });
    }
    await db.from("series_episodes").update({ fb_post_id: `posting:${Date.now()}` }).eq("id", episodeId);

    const { data: video } = await db.from("videos").select("id").eq("id", latest.video_id).maybeSingle();
    if (!video) {
      await db.from("series_episodes").update({ fb_post_id: null, video_id: null }).eq("id", episodeId);
      return done("video-missing-rejoining", { episodeId });
    }

    const publicUrl = `${(envString("R2_PUBLIC_URL") || "https://cdn.ivideostudio.ai").replace(/\/$/, "")}/videos/${series.user_id}/episode-${latest.video_id}.mp4`;

    try {
      const posted = await publishReel({
        pageKey: campaign.page_key,
        videoUrl: publicUrl,
        caption: captionFor(
          series.title,
          Number(latest.episode_number),
          String(latest.title || ""),
          String(latest.synopsis || "")
        ),
      });
      await db
        .from("series_episodes")
        .update({ posted_at: sqlNow(), fb_post_id: posted.postId })
        .eq("id", episodeId);
      return done("posted", { episodeId, page: posted.pageName, postId: posted.postId });
    } catch (err) {
      // Release the claim so the next tick can try again.
      await db.from("series_episodes").update({ fb_post_id: null }).eq("id", episodeId);
      return done("post-failed", { episodeId, error: String(err).slice(0, 300) });
    }
  }

  // ── Nothing in flight: is a slot due? ───────────────────────────────────
  const slot = dueSlot(campaign.slots);
  if (!slot || slot === campaign.last_slot) return done("idle");

  const balance = await providerBalance();
  if (balance === null || balance < campaign.min_balance) {
    // Claim the slot so this does not email on every tick for three hours.
    await db.from("marketing_campaigns").update({ last_slot: slot }).eq("id", campaign.id);
    await notifyOwner({
      severity: "warning",
      subject: `Series autopilot skipped a post — balance $${balance?.toFixed(2) ?? "unknown"}`,
      title: "An episode was not made",
      body: `<p>The ${slot.slice(11)} episode of <strong>${series.title}</strong> was skipped because the video balance is below the $${campaign.min_balance} safety floor.</p><p>Top up and the next slot will run as normal.</p>`,
      details: [
        ["Balance", `$${balance?.toFixed(2) ?? "unknown"}`],
        ["Floor", `$${campaign.min_balance}`],
        ["Slot", slot],
      ],
      ctaLabel: "Top up WaveSpeed",
      ctaHref: "https://wavespeed.ai/dashboard/billing",
    }).catch(() => false);
    return done("skipped-low-balance", { slot, balance });
  }

  // Claim the slot before the expensive part, so a second tick cannot start
  // the same slot while this one is writing.
  await db.from("marketing_campaigns").update({ last_slot: slot }).eq("id", campaign.id);

  const episodeNumber = (series.episode_count || 0) + 1;
  const draft = await writeEpisode(
    {
      title: series.title,
      language: String(series.language || "en-ZA"),
      genre: series.genre,
      logline: series.logline,
      characterName: series.character_name,
      characterDescription: series.character_description,
      storySoFar: series.story_so_far,
      episodeNumber,
    },
    campaign.shot_count
  );

  const episodeId = randomUUID();
  const { error } = await db.from("series_episodes").insert({
    id: episodeId,
    series_id: campaign.series_id,
    user_id: series.user_id,
    episode_number: episodeNumber,
    title: draft.title,
    synopsis: draft.synopsis,
    script: JSON.stringify({ shots: draft.shots, cliffhanger: draft.cliffhanger }),
    status: "written",
  });
  if (error) return done("write-save-failed", { error });

  await db
    .from("series")
    .update({ story_so_far: draft.storySoFar, episode_count: episodeNumber, updated_at: sqlNow() })
    .eq("id", campaign.series_id);

  return done("written", { slot, episodeId, episodeNumber, title: draft.title, balance });
}

/** Runs every enabled campaign once. */
export async function tickAllCampaigns(): Promise<TickResult[]> {
  const db = getDb();
  const { data } = await db.from("marketing_campaigns").select("*").eq("enabled", 1).limit(20);
  const results: TickResult[] = [];
  for (const c of (data || []) as Campaign[]) {
    try {
      results.push(await tickCampaign(c));
    } catch (err) {
      results.push({ campaign: c.id, action: "error", detail: String(err).slice(0, 300) });
    }
  }
  return results;
}
