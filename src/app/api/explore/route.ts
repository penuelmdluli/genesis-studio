import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

type ExploreTab = "trending" | "latest" | "audio" | "motion" | "films" | "picks";

const VALID_TABS: ExploreTab[] = ["trending", "latest", "audio", "motion", "films", "picks"];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = (searchParams.get("tab") || "trending") as ExploreTab;
    const cursor = searchParams.get("cursor");
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)), 1),
      MAX_LIMIT
    );

    if (!VALID_TABS.includes(tab)) {
      return NextResponse.json(
        { error: `Invalid tab. Must be one of: ${VALID_TABS.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Fetch one extra to determine if there's a next page
    const fetchLimit = limit + 1;

    let videos: Record<string, unknown>[];

    if (tab === "trending") {
      // Trending: score = (likes * 3 + views + recreates * 5) + recency bonus
      // Recency bonus: videos from last 7 days get a boost
      const { data, error } = await supabase.rpc("get_trending_explore_videos", {
        p_cursor_score: cursor ? parseFloat(cursor.split("__")[0]) : null,
        p_cursor_id: cursor ? cursor.split("__")[1] : null,
        p_limit: fetchLimit,
      });

      if (error) {
        // Fallback: use a simpler query if the RPC doesn't exist yet
        console.warn("Trending RPC not found, using fallback query:", error.message);
        const query = supabase
          .from("explore_videos")
          .select("*")
          .eq("is_published", true)
          .eq("is_flagged", false)
          .order("likes", { ascending: false })
          .limit(fetchLimit);

        if (cursor) {
          query.lt("id", cursor);
        }

        const { data: fallbackData, error: fallbackError } = await query;
        if (fallbackError) throw fallbackError;
        videos = (fallbackData || []) as Record<string, unknown>[];
      } else {
        videos = (data || []) as Record<string, unknown>[];
      }
    } else {
      // Build query for non-trending tabs
      let query = supabase
        .from("explore_videos")
        .select("*")
        .eq("is_published", true)
        .eq("is_flagged", false);

      // Apply tab-specific filters and ordering
      switch (tab) {
        case "latest":
          query = query.order("created_at", { ascending: false });
          if (cursor) {
            query = query.lt("created_at", cursor);
          }
          break;

        case "audio":
          query = query
            .eq("has_audio", true)
            .order("likes", { ascending: false });
          if (cursor) {
            const [cursorLikes, cursorId] = cursor.split("__");
            query = query.or(
              `likes.lt.${cursorLikes},and(likes.eq.${cursorLikes},id.gt.${cursorId})`
            );
          }
          break;

        case "motion":
          query = query
            .eq("type", "motion")
            .order("likes", { ascending: false });
          if (cursor) {
            const [cursorLikes, cursorId] = cursor.split("__");
            query = query.or(
              `likes.lt.${cursorLikes},and(likes.eq.${cursorLikes},id.gt.${cursorId})`
            );
          }
          break;

        case "films":
          query = query
            .eq("type", "brain")
            .order("likes", { ascending: false });
          if (cursor) {
            const [cursorLikes, cursorId] = cursor.split("__");
            query = query.or(
              `likes.lt.${cursorLikes},and(likes.eq.${cursorLikes},id.gt.${cursorId})`
            );
          }
          break;

        case "picks":
          query = query
            .eq("is_featured", true)
            .order("created_at", { ascending: false });
          if (cursor) {
            query = query.lt("created_at", cursor);
          }
          break;
      }

      query = query.limit(fetchLimit);

      const { data, error } = await query;
      if (error) throw error;
      videos = (data || []) as Record<string, unknown>[];
    }

    // Determine if there's a next page
    const hasMore = videos.length > limit;
    if (hasMore) {
      videos = videos.slice(0, limit);
    }

    // Build next cursor based on the last video
    let nextCursor: string | null = null;
    if (hasMore && videos.length > 0) {
      const lastVideo = videos[videos.length - 1];
      switch (tab) {
        case "trending":
          nextCursor = `${lastVideo.trending_score}__${lastVideo.id}`;
          break;
        case "latest":
        case "picks":
          nextCursor = lastVideo.created_at as string;
          break;
        case "audio":
        case "motion":
        case "films":
          nextCursor = `${lastVideo.likes}__${lastVideo.id}`;
          break;
      }
    }

    // Map to response shape
    const mappedVideos = videos.map(formatExploreVideo);

    return NextResponse.json({
      videos: mappedVideos,
      nextCursor,
    });
  } catch (error) {
    console.error("Explore feed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/** Map a Supabase row to the public API shape */
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
