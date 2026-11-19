import { NextRequest, NextResponse } from "next/server";
import { requireOwnerOrNotFound } from "@/lib/owner-only";
import { makeGenesisNewsReel, publishGenesisNewsReel, type ReelCopy } from "@/lib/genesis-news-reel";

// Rendering takes a few minutes (find + download + edit).
export const maxDuration = 900;

/**
 * POST /api/admin/genesis-news-reel — owner only
 * { story, summary?, clips?, secondsPerClip?, musicUrl?, copy?, publish?: boolean, scheduledAt?: unix seconds }
 *
 * Default is a draft: returns the reel URL + caption for review.
 * Re-post a reviewed draft without re-rendering: { videoUrl, caption, publish: true }.
 */
export async function POST(req: NextRequest) {
  const owner = await requireOwnerOrNotFound();
  if (owner instanceof NextResponse) return owner;

  const body = (await req.json().catch(() => ({}))) as {
    story?: string;
    summary?: string;
    clips?: number;
    secondsPerClip?: number;
    musicUrl?: string;
    copy?: Partial<ReelCopy>;
    publish?: boolean;
    scheduledAt?: number;
    videoUrl?: string;
    caption?: string;
  };

  try {
    // Publish an already-reviewed draft
    if (body.videoUrl && body.caption) {
      if (!body.publish) return NextResponse.json({ error: "set publish: true to post a draft" }, { status: 400 });
      const post = await publishGenesisNewsReel({ videoUrl: body.videoUrl, caption: body.caption }, body.scheduledAt);
      return NextResponse.json({ published: true, ...post });
    }

    if (!body.story) return NextResponse.json({ error: "story required" }, { status: 400 });
    const reel = await makeGenesisNewsReel({
      story: body.story,
      summary: body.summary,
      clips: body.clips,
      secondsPerClip: body.secondsPerClip,
      musicUrl: body.musicUrl,
      copy: body.copy,
    });
    if (!body.publish) return NextResponse.json({ published: false, ...reel });

    const post = await publishGenesisNewsReel(reel, body.scheduledAt);
    return NextResponse.json({ published: true, ...reel, ...post });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
