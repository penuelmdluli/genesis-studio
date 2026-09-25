// ============================================
// GENESIS STUDIO — Lead Videos
// ============================================
// A "lead" is a trending video we spotted somewhere else and want to reuse as
// the motion reference for one of our own videos later — the dancing reels on
// the personal profile are all built this way.
//
// The reason a lead is downloaded when it is *added* rather than when it is
// *used* is that the source rarely survives the wait. Facebook reels get
// deleted, set to friends-only, or simply stop resolving for a logged-out
// fetcher within days, and the whole point of the list is that you paste a
// link the moment you see it and use it in a session a week later. So adding a
// lead copies the mp4 into R2, and everything downstream reads our own copy.
//
// Downloading goes through the Railway scraper (yt-dlp) first because that is
// the only path carrying Facebook cookies — the in-Worker downloader in
// video-downloader.ts can only reach Facebook videos on a page we hold a token
// for, which is never true of somebody else's trending reel. It stays as the
// fallback for TikTok/Instagram/X and for when the scraper is down.

import { getDb } from "@/lib/db-driver";
import { r2PublicUrl } from "@/lib/storage";

export type LeadStatus = "pending" | "fetching" | "ready" | "failed";

export interface LeadVideo {
  id: string;
  sourceUrl: string;
  platform: string;
  title: string | null;
  creatorName: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  durationSec: number;
  viewCount: number;
  status: LeadStatus;
  errorMessage: string | null;
  attempts: number;
  notes: string | null;
  tags: string[];
  starred: boolean;
  timesUsed: number;
  lastUsedAt: string | null;
  createdAt: string;
}

/**
 * Kling rejects a reference video longer than this — after we have already
 * taken the user's credits. The scraper caps Facebook downloads at 60s, which
 * is deliberately looser: a 45s reel is still worth keeping in the list, it
 * just gets flagged so it can be trimmed before it reaches motion control.
 */
export const MAX_LEAD_SECONDS = 30;

/** Stop retrying a lead after this many failed fetches. */
export const MAX_LEAD_ATTEMPTS = 3;

/**
 * Query strings on shared social links are almost entirely tracking, and they
 * differ on every share of the same reel — so two pastes of one video would
 * land as two rows and be downloaded twice. Keep only the params that actually
 * identify a video.
 */
const KEEP_PARAMS = new Set(["v", "story_fbid", "id"]);

export function normalizeSourceUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return trimmed;
  }

  // m./web./mbasic. Facebook hosts serve the same video as www.
  url.hostname = url.hostname.replace(
    /^(m|web|mbasic|mobile)\.facebook\.com$/i,
    "www.facebook.com"
  );

  for (const key of [...url.searchParams.keys()]) {
    if (!KEEP_PARAMS.has(key)) url.searchParams.delete(key);
  }

  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

/**
 * Turn a Facebook share link into the canonical reel/video URL.
 *
 * facebook.com/share/r/<id> is what the Facebook app's share sheet produces,
 * and it is what a person actually pastes. yt-dlp cannot resolve it — every
 * lead added that way failed with "yt-dlp failed" on --dump-json, three
 * attempts each, silently.
 *
 * The link is a plain 302 to /reel/<numeric id>, but Facebook only serves that
 * redirect to crawler user agents: a desktop Chrome UA gets a bare 400, which
 * is why following it the obvious way looked like a dead link. Identifying
 * honestly as a crawler is what makes it work, and it is a public share link
 * either way.
 *
 * Returns the original URL unchanged on any failure — a lead that cannot be
 * resolved should still be saved and retried, never dropped.
 */
export async function resolveShareUrl(url: string): Promise<string> {
  if (!/facebook\.com\/share\//i.test(url)) return url;

  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "facebookexternalhit/1.1" },
    });

    const location = res.headers.get("location");
    if (!location) return url;

    // The redirect carries share-tracking params (s, fs, rdid, share_url).
    // Strip them: they are per-share noise, and keeping them would defeat the
    // dedupe that stops the same reel being downloaded twice.
    const canonical = new URL(location, url);
    canonical.search = "";

    // Only accept a real video permalink. Facebook sends login walls and
    // interstitials through the same header, and storing one of those would
    // replace a retryable link with a permanently broken one.
    if (!/\/(reel|videos|watch)\//i.test(canonical.pathname)) return url;

    console.log(`[Leads] Resolved share link ${url} -> ${canonical.toString()}`);
    return canonical.toString();
  } catch (err) {
    console.warn(`[Leads] Could not resolve share link ${url}:`, err);
    return url;
  }
}

export function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("facebook.com") || u.includes("fb.watch") || u.includes("fb.me")) return "facebook";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("twitter.com") || u.includes("x.com")) return "twitter";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return "direct";
  return "unknown";
}

/**
 * YouTube is the one platform we cannot save: downloading it needs credentials
 * we do not have, and motion control already refuses YouTube URLs at submit
 * time. Accepting one would only create a row that can never turn ready.
 */
export function leadUrlProblem(url: string): string | null {
  if (!url) return "Paste a video link first.";
  if (!/^https?:\/\//i.test(url)) return "That does not look like a link.";
  if (detectPlatform(url) === "youtube") {
    return "YouTube links can't be saved. Facebook, TikTok, Instagram and X all work.";
  }
  return null;
}

interface LeadRow {
  id: string;
  user_id: string;
  source_url: string;
  platform: string;
  title: string | null;
  creator_name: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  duration_sec: number | null;
  view_count: number | null;
  status: LeadStatus;
  error_message: string | null;
  attempts: number | null;
  notes: string | null;
  tags: string | null;
  starred: number | null;
  times_used: number | null;
  last_used_at: string | null;
  created_at: string;
}

export function toLeadVideo(row: LeadRow): LeadVideo {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    platform: row.platform,
    title: row.title,
    creatorName: row.creator_name,
    thumbnailUrl: row.thumbnail_url,
    videoUrl: row.video_url,
    durationSec: row.duration_sec ?? 0,
    viewCount: row.view_count ?? 0,
    status: row.status,
    errorMessage: row.error_message,
    attempts: row.attempts ?? 0,
    notes: row.notes,
    tags: (row.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
    starred: !!row.starred,
    timesUsed: row.times_used ?? 0,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  };
}

export async function listLeads(
  userId: string,
  opts: { includeArchived?: boolean; limit?: number } = {}
): Promise<LeadVideo[]> {
  let q = getDb()
    .from("lead_videos")
    .select("*")
    .eq("user_id", userId);

  if (!opts.includeArchived) q = q.eq("archived", 0);

  const { data } = await q
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);

  return ((data as LeadRow[] | null) || []).map(toLeadVideo);
}

export async function getLead(leadId: string, userId: string): Promise<LeadVideo | null> {
  const { data } = await getDb()
    .from("lead_videos")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ? toLeadVideo(data as LeadRow) : null;
}

/**
 * Save a link to the list.
 *
 * Re-adding a link that is already on the list returns the existing lead
 * instead of erroring — pasting the same reel twice is the normal way this
 * gets used, not a mistake worth a message.
 */
export async function addLead(params: {
  userId: string;
  url: string;
  notes?: string;
  tags?: string[];
}): Promise<{ lead: LeadVideo; alreadyExisted: boolean }> {
  // Resolve before normalising so dedupe compares canonical URLs.
  const sourceUrl = normalizeSourceUrl(await resolveShareUrl(params.url.trim()));
  const db = getDb();

  const { data: existing } = await db
    .from("lead_videos")
    .select("*")
    .eq("user_id", params.userId)
    .eq("source_url", sourceUrl)
    .maybeSingle();

  if (existing) {
    // Pasting an archived lead again means it is wanted back.
    await db
      .from("lead_videos")
      .update({ archived: 0, updated_at: new Date().toISOString() })
      .eq("id", (existing as LeadRow).id);
    return { lead: toLeadVideo(existing as LeadRow), alreadyExisted: true };
  }

  const { data, error } = await db
    .from("lead_videos")
    .insert({
      user_id: params.userId,
      source_url: sourceUrl,
      platform: detectPlatform(sourceUrl),
      status: "pending",
      notes: params.notes || null,
      tags: params.tags?.length ? params.tags.join(",") : null,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || "Could not save that link");
  return { lead: toLeadVideo(data as LeadRow), alreadyExisted: false };
}

interface FetchedLead {
  r2Key: string;
  videoUrl: string;
  durationSec: number;
  fileSizeBytes: number;
  title: string;
  thumbnailUrl: string;
  viewCount: number;
}

/**
 * Download a lead into R2 and fill in its title, thumbnail and duration.
 *
 * Safe to call twice on the same lead — one that is already `ready` comes back
 * untouched, so the page can fire this optimistically right after adding
 * without racing the cron that sweeps up stragglers.
 */
export async function fetchLead(leadId: string, userId: string): Promise<LeadVideo> {
  const db = getDb();
  const lead = await getLead(leadId, userId);
  if (!lead) throw new Error("Lead not found");
  if (lead.status === "ready" && lead.videoUrl) return lead;

  const attempts = lead.attempts + 1;
  const now = () => new Date().toISOString();

  await db.from("lead_videos").update({ status: "fetching", updated_at: now() }).eq("id", leadId);

  try {
    const got = await downloadLead(lead, userId);

    await db
      .from("lead_videos")
      .update({
        status: "ready",
        r2_key: got.r2Key,
        video_url: got.videoUrl,
        duration_sec: got.durationSec,
        file_size_bytes: got.fileSizeBytes,
        title: got.title || lead.title,
        thumbnail_url: got.thumbnailUrl || lead.thumbnailUrl,
        view_count: got.viewCount || lead.viewCount,
        error_message: null,
        attempts,
        updated_at: now(),
      })
      .eq("id", leadId);

    return {
      ...lead,
      status: "ready",
      videoUrl: got.videoUrl,
      durationSec: got.durationSec,
      title: got.title || lead.title,
      thumbnailUrl: got.thumbnailUrl || lead.thumbnailUrl,
      viewCount: got.viewCount || lead.viewCount,
      errorMessage: null,
      attempts,
    };
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    await db
      .from("lead_videos")
      .update({ status: "failed", error_message: message, attempts, updated_at: now() })
      .eq("id", leadId);

    return { ...lead, status: "failed", errorMessage: message, attempts };
  }
}

async function downloadLead(lead: LeadVideo, userId: string): Promise<FetchedLead> {
  const targetKey = `lead-videos/${userId}/${lead.id}.mp4`;

  // Leads saved before share-link resolution existed still hold the /share/
  // form, so resolve here too rather than leaving them permanently broken.
  const sourceUrl = await resolveShareUrl(lead.sourceUrl);
  if (sourceUrl !== lead.sourceUrl) {
    lead = { ...lead, sourceUrl };
  }

  // Metadata is a separate, cheap yt-dlp call and the only source of a title,
  // but a lead is still worth saving without one — a failure here must not
  // sink the download.
  let title = "";
  let thumbnailUrl = "";
  let viewCount = 0;
  try {
    const { fetchVideoMetadata } = await import("@/lib/mbs/scraper");
    const m = await fetchVideoMetadata(lead.sourceUrl);
    title = m.title || "";
    thumbnailUrl = m.thumbnailUrl || "";
    viewCount = m.viewCount || 0;
  } catch (err) {
    console.warn(`[Leads] Metadata unavailable for ${lead.sourceUrl}:`, err);
  }

  // Scraper first — the only path that carries Facebook cookies.
  try {
    const { downloadAndPersist } = await import("@/lib/mbs/scraper");
    const dl = await downloadAndPersist(lead.sourceUrl, targetKey);
    return {
      r2Key: dl.r2Key,
      videoUrl: r2PublicUrl(dl.r2Key),
      durationSec: dl.durationSec,
      fileSizeBytes: dl.fileSizeBytes,
      title,
      thumbnailUrl: thumbnailUrl || dl.thumbnailUrl,
      viewCount,
    };
  } catch (scraperErr) {
    console.warn(`[Leads] Scraper download failed for ${lead.sourceUrl}:`, scraperErr);

    // The in-Worker downloader cannot do Facebook without a page token, and its
    // failure message tells the user to save the file by hand — which is wrong
    // advice here. Surface the scraper's own reason instead.
    if (lead.platform === "facebook") {
      throw scraperErr instanceof Error
        ? scraperErr
        : new Error("Could not download this Facebook video");
    }

    const { downloadVideoFromUrl } = await import("@/lib/video-downloader");
    const dl = await downloadVideoFromUrl(lead.sourceUrl, userId, lead.id);
    return {
      r2Key: dl.r2Key,
      videoUrl: dl.publicUrl,
      durationSec: dl.durationSec,
      fileSizeBytes: dl.fileSizeBytes,
      title,
      thumbnailUrl,
      viewCount,
    };
  }
}

/**
 * Record that a lead was sent to motion control, so the list can show at a
 * glance which trending clips have not been used yet.
 */
export async function markLeadUsed(leadId: string, userId: string): Promise<void> {
  const lead = await getLead(leadId, userId);
  if (!lead) return;
  await getDb()
    .from("lead_videos")
    .update({
      times_used: lead.timesUsed + 1,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
}
