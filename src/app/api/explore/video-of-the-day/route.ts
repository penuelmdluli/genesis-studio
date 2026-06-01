import { NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";

/** Deterministic day-of-year index (0–365) */
function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Map a DB row to the public API shape (same as /api/explore) */
function formatExploreVideo(row: Record<string, unknown>) {
  return {
    id: row.id,
    prompt: row.prompt,
    modelId: row.model_id,
    videoUrl: row.video_url,
    thumbnailUrl: row.thumbnail_url,
    duration: row.duration,
    resolution: row.resolution,
    hasAudio: row.has_audio,
    type: row.type,
    views: row.views,
    likes: row.likes,
    recreates: row.recreates,
    shares: row.shares,
    creatorName: row.creator_name,
    creatorAvatarUrl: row.creator_avatar_url,
    isFreeTier: row.is_free_tier,
    isFeatured: row.is_featured,
    tags: row.tags,
    createdAt: row.created_at,
  };
}

export async function GET() {
  try {
    const supabase = getDb();

    // Fetch top 10 videos by engagement score: likes + recreates + views/10
    const { data, error } = await supabase
      .from("explore_videos")
      .select("*")
      .eq("is_published", true)
      .eq("is_flagged", false)
      .order("likes", { ascending: false })
      .limit(10);

    if (error) throw error;

    const videos = (data || []) as Record<string, unknown>[];

    if (videos.length === 0) {
      return NextResponse.json(
        { error: "No videos available" },
        { status: 404 }
      );
    }

    // Sort by composite score: likes + recreates + views/10
    videos.sort((a, b) => {
      const scoreA =
        Number(a.likes || 0) +
        Number(a.recreates || 0) +
        Number(a.views || 0) / 10;
      const scoreB =
        Number(b.likes || 0) +
        Number(b.recreates || 0) +
        Number(b.views || 0) / 10;
      return scoreB - scoreA;
    });

    // Deterministic daily pick: dayOfYear % number of candidates
    const dayIndex = getDayOfYear() % videos.length;
    const picked = videos[dayIndex];

    return NextResponse.json(
      { video: formatExploreVideo(picked) },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600",
        },
      }
    );
  } catch (error) {
    console.error("Video of the Day error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
