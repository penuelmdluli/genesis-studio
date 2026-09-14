// ============================================
// GENESIS STUDIO — publish our own marketing reels to our own pages
// ============================================
// POST /api/admin/post-reel   (cron secret only)
//
//   { check: true }                          → each page's name, followers and
//                                              whether its token still works.
//                                              Posts nothing.
//   { pageKey, videoUrl, caption }           → publishes one reel.
//
// The development posting route is blocked in production on purpose, and it
// should stay that way. This is the narrow version the operator needs to put
// iVideo Studio's own ads on iVideo Studio's own pages: one page per call, a
// check mode so pages are chosen on real follower counts before anything goes
// public, and the same three-step reel upload the dev route already proved.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GRAPH = "https://graph.facebook.com/v19.0";

const PAGES: Record<string, { pageId: string; tokenEnv: string; name: string }> = {
  tech_news: { pageId: "100919755007786", tokenEnv: "FB_PAGE_TOKEN_tech_news", name: "Tech Pulse Africa" },
  ai_money: { pageId: "107465491085378", tokenEnv: "FB_PAGE_TOKEN_ai_money", name: "AI Revolution" },
  motivation: { pageId: "102206758210905", tokenEnv: "FB_PAGE_TOKEN_motivation", name: "Afrika Toons" },
  health_wellness: { pageId: "106788301081578", tokenEnv: "FB_PAGE_TOKEN_health_wellness", name: "World News Animated" },
  mzansi_baby_stars: { pageId: "112465853843545", tokenEnv: "FB_PAGE_TOKEN_mzansi_baby_stars", name: "Mzansi Baby Stars" },
  limitless_you: { pageId: "104120995511039", tokenEnv: "FB_PAGE_TOKEN_limitless_you", name: "Africa 2050" },
  penuel: { pageId: "", tokenEnv: "FB_PAGE_TOKEN_penuel", name: "Penuel" },
};

async function postReel(
  videoUrl: string,
  pageId: string,
  token: string,
  caption: string,
  scheduledAt?: number
) {
  const video = await fetch(videoUrl);
  if (!video.ok) throw new Error(`could not fetch the video (${video.status})`);
  const bytes = await video.arrayBuffer();

  const init = await fetch(`${GRAPH}/${pageId}/video_reels`, {
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

  const finish = await fetch(`${GRAPH}/${pageId}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      upload_phase: "finish",
      video_id,
      access_token: token,
      description: caption,
      // Scheduled on Facebook itself, so a staggered campaign publishes on
      // its own days without anybody — or any machine of ours — having to be
      // awake to send it.
      ...(scheduledAt
        ? { video_state: "SCHEDULED", scheduled_publish_time: scheduledAt }
        : { video_state: "PUBLISHED" }),
    }),
  });
  if (!finish.ok) throw new Error(`publish failed: ${finish.status} ${(await finish.text()).slice(0, 200)}`);
  const done = (await finish.json()) as { id?: string; post_id?: string };
  return done.post_id || done.id || video_id;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    check?: boolean;
    pageKey?: string;
    videoUrl?: string;
    caption?: string;
    /** Unix seconds. Facebook requires 10 minutes to 29 days ahead. */
    scheduledAt?: number;
  };

  if (body.check) {
    const pages = await Promise.all(
      Object.entries(PAGES).map(async ([key, page]) => {
        const token = process.env[page.tokenEnv];
        if (!token) return { key, name: page.name, ok: false, detail: "no token" };
        try {
          // A token for the page itself, so "me" is the page.
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
          if (!res.ok || json.error) {
            return { key, name: page.name, ok: false, detail: json.error?.message || `HTTP ${res.status}` };
          }
          return {
            key,
            name: json.name || page.name,
            pageId: json.id,
            ok: true,
            followers: json.followers_count ?? json.fan_count ?? null,
          };
        } catch (err) {
          return { key, name: page.name, ok: false, detail: String(err) };
        }
      })
    );
    return NextResponse.json({ pages });
  }

  const page = body.pageKey ? PAGES[body.pageKey] : undefined;
  if (!page) return NextResponse.json({ error: "unknown pageKey" }, { status: 400 });
  if (!body.videoUrl?.startsWith("https://")) {
    return NextResponse.json({ error: "videoUrl must be an https URL" }, { status: 400 });
  }
  const token = process.env[page.tokenEnv];
  if (!token) return NextResponse.json({ error: `no token for ${body.pageKey}` }, { status: 400 });

  try {
    // The page id is read from the token rather than trusted from the table,
    // so a stale id cannot send an ad to the wrong page.
    const me = (await (await fetch(`${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(token)}`)).json()) as {
      id?: string;
      name?: string;
    };
    const pageId = me.id || page.pageId;
    const now = Math.floor(Date.now() / 1000);
    const at = Number(body.scheduledAt) || 0;
    if (at && (at < now + 600 || at > now + 29 * 24 * 3600)) {
      return NextResponse.json({ error: "scheduledAt must be 10 minutes to 29 days ahead" }, { status: 400 });
    }
    const postId = await postReel(body.videoUrl, pageId, token, (body.caption || "").slice(0, 2000), at || undefined);
    return NextResponse.json({
      ok: true,
      page: me.name || page.name,
      postId,
      scheduledFor: at ? new Date(at * 1000).toISOString() : null,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, page: page.name, error: String(err).slice(0, 400) }, { status: 502 });
  }
}
