// ============================================
// GENESIS STUDIO — publishing reels to our own Facebook pages
// ============================================
// One implementation, shared by the owner's manual ad route and the series
// autopilot, so a fix to one is a fix to both.
//
// Page names are never trusted from this table. Pages get renamed — the key
// "mzansi_baby_stars" now belongs to a page called SAGA of the NORTH — so the
// real name and id are always read back from the token.

const GRAPH = "https://graph.facebook.com/v19.0";

export const FACEBOOK_PAGES: Record<string, { pageId: string; tokenEnv: string; label: string }> = {
  tech_news: { pageId: "100919755007786", tokenEnv: "FB_PAGE_TOKEN_tech_news", label: "Tech Pulse Africa" },
  ai_money: { pageId: "107465491085378", tokenEnv: "FB_PAGE_TOKEN_ai_money", label: "Smart Money AI" },
  motivation: { pageId: "102206758210905", tokenEnv: "FB_PAGE_TOKEN_motivation", label: "Mzansi Careers" },
  health_wellness: { pageId: "106788301081578", tokenEnv: "FB_PAGE_TOKEN_health_wellness", label: "Herbal Organic Life" },
  mzansi_baby_stars: { pageId: "112465853843545", tokenEnv: "FB_PAGE_TOKEN_mzansi_baby_stars", label: "SAGA of the NORTH" },
  limitless_you: { pageId: "104120995511039", tokenEnv: "FB_PAGE_TOKEN_limitless_you", label: "Africa 2050" },
  penuel: { pageId: "", tokenEnv: "FB_PAGE_TOKEN_penuel", label: "Penuel" },
};

export function pageToken(pageKey: string): string | null {
  const page = FACEBOOK_PAGES[pageKey];
  return page ? process.env[page.tokenEnv] || null : null;
}

/** The page a token actually belongs to, read from Facebook. */
export async function whoIs(token: string): Promise<{ id?: string; name?: string; followers?: number; error?: string }> {
  const res = await fetch(
    `${GRAPH}/me?fields=id,name,followers_count,fan_count&access_token=${encodeURIComponent(token)}`
  );
  const json = (await res.json()) as {
    id?: string;
    name?: string;
    followers_count?: number;
    fan_count?: number;
    error?: { message?: string };
  };
  if (!res.ok || json.error) return { error: json.error?.message || `HTTP ${res.status}` };
  return { id: json.id, name: json.name, followers: json.followers_count ?? json.fan_count };
}

/**
 * Uploads and publishes (or schedules) one reel. Returns the post id.
 * `scheduledAt` is unix seconds; Facebook wants 10 minutes to 29 days ahead.
 */
export async function publishReel(opts: {
  pageKey: string;
  videoUrl: string;
  caption: string;
  scheduledAt?: number;
}): Promise<{ postId: string; pageName: string }> {
  const token = pageToken(opts.pageKey);
  if (!token) throw new Error(`no token for ${opts.pageKey}`);

  const me = await whoIs(token);
  if (me.error || !me.id) throw new Error(`page token rejected: ${me.error || "no page id"}`);

  const video = await fetch(opts.videoUrl);
  if (!video.ok) throw new Error(`could not fetch the video (${video.status})`);
  const bytes = await video.arrayBuffer();

  const init = await fetch(`${GRAPH}/${me.id}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upload_phase: "start", access_token: token }),
  });
  if (!init.ok) throw new Error(`start failed: ${init.status} ${(await init.text()).slice(0, 200)}`);
  const { video_id } = (await init.json()) as { video_id?: string };
  if (!video_id) throw new Error("start returned no video id");

  const upload = await fetch(`https://rupload.facebook.com/video-upload/v19.0/${video_id}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      offset: "0",
      file_size: String(bytes.byteLength),
      "Content-Type": "application/octet-stream",
    },
    body: new Blob([bytes], { type: "video/mp4" }),
  });
  if (!upload.ok) throw new Error(`upload failed: ${upload.status} ${(await upload.text()).slice(0, 200)}`);

  const finish = await fetch(`${GRAPH}/${me.id}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_phase: "finish",
      video_id,
      access_token: token,
      description: opts.caption.slice(0, 2000),
      // Scheduled on Facebook itself, so a staggered campaign publishes on
      // its own days without anything of ours having to be awake to send it.
      ...(opts.scheduledAt
        ? { video_state: "SCHEDULED", scheduled_publish_time: opts.scheduledAt }
        : { video_state: "PUBLISHED" }),
    }),
  });
  if (!finish.ok) throw new Error(`publish failed: ${finish.status} ${(await finish.text()).slice(0, 200)}`);
  const done = (await finish.json()) as { id?: string; post_id?: string };
  return { postId: done.post_id || done.id || video_id, pageName: me.name || opts.pageKey };
}
