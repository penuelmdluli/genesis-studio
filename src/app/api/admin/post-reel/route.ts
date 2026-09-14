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
import { FACEBOOK_PAGES, publishReel } from "@/lib/facebook-reels";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GRAPH = "https://graph.facebook.com/v19.0";

// Posting itself lives in @/lib/facebook-reels, shared with the series
// autopilot, so a fix to one is a fix to both.
const PAGES = Object.fromEntries(
  Object.entries(FACEBOOK_PAGES).map(([k, v]) => [k, { pageId: v.pageId, tokenEnv: v.tokenEnv, name: v.label }])
);

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

  // Confirms what Facebook actually did with a post. A reel sent as
  // "scheduled" can publish at once instead, which would quietly undo a
  // staggered campaign — so it is checked, not assumed.
  if (Array.isArray((body as { statusOf?: unknown }).statusOf)) {
    const items = (body as { statusOf: Array<{ pageKey: string; videoId: string }> }).statusOf;
    const results = await Promise.all(
      items.map(async ({ pageKey, videoId }) => {
        const pg = PAGES[pageKey];
        const token = pg ? process.env[pg.tokenEnv] : undefined;
        if (!token) return { pageKey, videoId, error: "no token" };
        // The finish phase returns a post id, which Facebook will not read as
        // a video. Listing the page's own reels gives the real state.
        const res = await fetch(
          `${GRAPH}/me/video_reels?fields=id,description,status,created_time,permalink_url&limit=5&access_token=${encodeURIComponent(token)}`
        );
        const json = (await res.json()) as { data?: Array<Record<string, unknown>>; error?: unknown };
        return { pageKey, videoId, reels: json.data || [], error: json.error };
      })
    );
    return NextResponse.json({ results });
  }

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
    const now = Math.floor(Date.now() / 1000);
    const at = Number(body.scheduledAt) || 0;
    if (at && (at < now + 600 || at > now + 29 * 24 * 3600)) {
      return NextResponse.json({ error: "scheduledAt must be 10 minutes to 29 days ahead" }, { status: 400 });
    }
    const posted = await publishReel({
      pageKey: body.pageKey!,
      videoUrl: body.videoUrl,
      caption: body.caption || "",
      scheduledAt: at || undefined,
    });
    return NextResponse.json({
      ok: true,
      page: posted.pageName,
      postId: posted.postId,
      scheduledFor: at ? new Date(at * 1000).toISOString() : null,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, page: page.name, error: String(err).slice(0, 400) }, { status: 502 });
  }
}
