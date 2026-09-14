// ============================================
// GENESIS STUDIO — daily marketing ad loop
// ============================================
// Owner call 2026-09-14: the marketing videos are made once and then reused.
// No new generation for marketing; credit is kept for customers.
//
// Once a day this posts one of the finished ads to SAGA of the NORTH, rotating
// through them, with a different caption each round. Rotating rather than
// posting all of them daily keeps Facebook from reading the page as a
// duplicate-content spammer, which would cut reach for everything it posts.
//
// Costs nothing to run: the videos already sit on the CDN.
//
// Cron: 16:00 UTC (18:00 SAST), retried at 17:00 UTC if the first try failed.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { publishReel } from "@/lib/facebook-reels";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE_KEY = "mzansi_baby_stars"; // SAGA of the NORTH
const CDN = "https://cdn.ivideostudio.ai/marketing/ads";
const LINK = "https://ivideostudio.ai";
const TAGS = "#AI #AIVideo #iVideoStudio #MadeWithAI #SouthAfrica #Mzansi";

/** Rotation order. 2026-09-14 (day 0) was AI Beast Wars. */
const ADS: Array<{ key: string; video: string; captions: string[] }> = [
  {
    key: "beast-wars",
    video: `${CDN}/ai-beast-wars-9x16.mp4`,
    captions: [
      `AI BEAST WARS 🦏⚡🦁\n\nA chrome rhino. A molten iron lion. One collision.\nNo camera. No crew. No studio. Every frame was made with AI from a single prompt.\n\n👉 Create yours free at ${LINK}`,
      `Who wins? 🦏 vs 🦁\n\nThis whole fight was made with AI. No 3D artists, no render farm, just a prompt.\n\nMake your own epic scenes 👉 ${LINK}`,
      `Hollywood VFX used to cost millions. This took one prompt. 🤯\n\nFights, fantasy worlds, drama series, product ads, all made with AI.\n\nStart free 👉 ${LINK}`,
    ],
  },
  {
    key: "action-movie",
    video: `${CDN}/ai-action-movie-9x16.mp4`,
    captions: [
      `AI ACTION MOVIE 🎬🔥\n\nNo actors. No stunt team. No explosions were harmed. 😅\nEvery shot here was made with AI from a text prompt.\n\n👉 Make your own movie scenes free at ${LINK}`,
      `Bike chase. Rooftop jump. Tunnel explosion. 💥\n\nNone of it was filmed. It was all generated with AI.\n\nYour movie idea deserves to be seen 👉 ${LINK}`,
      `Blockbuster footage without a blockbuster budget. 🎥\n\nType the scene, get the shot. That's iVideo Studio.\n\nTry it free 👉 ${LINK}`,
    ],
  },
  {
    key: "cartoon",
    video: `${CDN}/ai-cartoon-9x16.mp4`,
    captions: [
      `AI CARTOON MOVIE ✈️🦦\n\nA brave little meerkat, a grumpy eagle and a whole village cheering.\nStudio-quality animation, made with AI in minutes.\n\n👉 Create your own cartoon free at ${LINK}`,
      `Kids' cartoons, made by AI. 🎨\n\nNo animators, no months of rendering. Just your story.\n\nStart creating 👉 ${LINK}`,
      `Your story, animated like the big studios. 🌍✨\n\nCartoons, music videos, drama series and ads, all with AI.\n\nTry iVideo Studio free 👉 ${LINK}`,
    ],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const SAST_MS = 2 * 60 * 60 * 1000;
const ANCHOR = Date.UTC(2026, 8, 14); // day 0

function sastDay(now: number): { day: string; index: number } {
  const local = now + SAST_MS;
  const day = new Date(local).toISOString().slice(0, 10);
  const index = Math.floor((Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) - ANCHOR) / DAY_MS);
  return { day, index };
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { day, index } = sastDay(Date.now());
  if (index < 0) return NextResponse.json({ skipped: "before loop start" });
  const ad = ADS[index % ADS.length];
  const round = Math.floor(index / ADS.length);
  const caption = `${ad.captions[round % ad.captions.length]}\n\n${TAGS}`;
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  if (dry) return NextResponse.json({ day, ad: ad.key, video: ad.video, caption });

  const db = getDb();
  // The unique day index makes this insert the claim: a second firing fails here.
  const claim = await db.from("ad_loop_posts").insert({ day, ad_key: ad.key, page_key: PAGE_KEY });
  if (claim.error) return NextResponse.json({ skipped: "already posted today", day });

  try {
    const { postId, pageName } = await publishReel({ pageKey: PAGE_KEY, videoUrl: ad.video, caption });
    await db.from("ad_loop_posts").update({ post_id: postId }).eq("day", day);
    return NextResponse.json({ ok: true, day, ad: ad.key, page: pageName, postId });
  } catch (err) {
    // Release the claim so the 17:00 UTC retry can try again.
    await db.from("ad_loop_posts").delete().eq("day", day);
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[AD-LOOP] ${day} ${ad.key} failed: ${message}`);
    return NextResponse.json({ error: message, day, ad: ad.key }, { status: 502 });
  }
}
