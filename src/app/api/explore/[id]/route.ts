import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Video ID required" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Fetch the video
    const { data: video, error } = await supabase
      .from("explore_videos")
      .select("*")
      .eq("id", id)
      .eq("is_published", true)
      .eq("is_flagged", false)
      .single();

    if (error || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Increment view count (fire-and-forget)
    supabase
      .rpc("increment_explore_field", {
        row_id: id,
        field_name: "views",
        amount: 1,
      })
      .then(({ error: rpcError }) => {
        if (rpcError) {
          // Fallback: direct update
          supabase
            .from("explore_videos")
            .update({ views: (video.views || 0) + 1 })
            .eq("id", id)
            .then(() => {});
        }
      });

    // Fetch related videos: same model or overlapping tags, exclude current
    let relatedVideos: Record<string, unknown>[] = [];

    // Try by same model first
    const { data: modelRelated } = await supabase
      .from("explore_videos")
      .select("*")
      .eq("is_published", true)
      .eq("is_flagged", false)
      .eq("model_id", video.model_id)
      .neq("id", id)
      .order("likes", { ascending: false })
      .limit(6);

    relatedVideos = (modelRelated || []) as Record<string, unknown>[];

    // If we don't have enough, fill with tag-matched videos
    if (relatedVideos.length < 6 && video.tags && video.tags.length > 0) {
      const existingIds = [id, ...relatedVideos.map((v) => v.id)];
      const { data: tagRelated } = await supabase
        .from("explore_videos")
        .select("*")
        .eq("is_published", true)
        .eq("is_flagged", false)
        .not("id", "in", `(${existingIds.join(",")})`)
        .overlaps("tags", video.tags)
        .order("likes", { ascending: false })
        .limit(6 - relatedVideos.length);

      if (tagRelated) {
        relatedVideos = [...relatedVideos, ...tagRelated];
      }
    }

    return NextResponse.json({
      video: formatExploreVideo(video),
      relatedVideos: relatedVideos.map(formatExploreVideo),
    });
  } catch (error) {
    console.error("Explore video detail error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
