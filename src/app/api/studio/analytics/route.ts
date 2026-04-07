import { NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

interface NicheBreakdown {
  niche: string;
  videoCount: number;
  postCount: number;
  totalViews: number;
  totalReactions: number;
  totalShares: number;
  totalComments: number;
  avgScore: number;
}

interface TopPost {
  id: string;
  facebook_post_id: string | null;
  posted_at: string | null;
  views: number;
  reactions: number;
  shares: number;
  comments: number;
  performance_score: number;
  video_title: string;
  page_name: string;
  niche: string;
}

/**
 * Analytics Summary endpoint. Owner-only.
 * GET /api/studio/analytics
 *
 * Returns aggregated analytics for the current week including
 * totals, top performers, and per-niche breakdowns.
 */
export async function GET() {
  try {
    const authResult = await requireStudioOwner();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = createSupabaseAdmin();

    // Calculate the start of the current week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartISO = weekStart.toISOString();

    // Today boundaries
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartISO = todayStart.toISOString();

    // Fetch videos created this week
    const { data: weekVideos, error: videosError } = await supabase
      .from("studio_videos")
      .select("id, niche, created_at")
      .gte("created_at", weekStartISO);

    if (videosError) {
      console.error("[studio/analytics] Videos query error:", videosError);
      return NextResponse.json(
        { error: "Failed to fetch videos" },
        { status: 500 }
      );
    }

    // Fetch posts from this week with video and page info
    const { data: weekPosts, error: postsError } = await supabase
      .from("studio_posts")
      .select(
        `
        id,
        facebook_post_id,
        posted_at,
        status,
        views,
        reactions,
        shares,
        comments,
        performance_score,
        page_id,
        video_id,
        created_at
      `
      )
      .gte("created_at", weekStartISO);

    if (postsError) {
      console.error("[studio/analytics] Posts query error:", postsError);
      return NextResponse.json(
        { error: "Failed to fetch posts" },
        { status: 500 }
      );
    }

    // Fetch related video and page data for enrichment
    const videoIds = [
      ...new Set((weekPosts || []).map((p) => p.video_id).filter(Boolean)),
    ];
    const pageIds = [
      ...new Set((weekPosts || []).map((p) => p.page_id).filter(Boolean)),
    ];

    const [videosResult, pagesResult] = await Promise.all([
      videoIds.length > 0
        ? supabase
            .from("studio_videos")
            .select("id, script, niche")
            .in("id", videoIds)
        : { data: [], error: null },
      pageIds.length > 0
        ? supabase
            .from("studio_pages")
            .select("id, page_name")
            .in("id", pageIds)
        : { data: [], error: null },
    ]);

    const videosMap = new Map(
      (videosResult.data || []).map((v: { id: string; script: string; niche: string }) => [
        v.id,
        v,
      ])
    );
    const pagesMap = new Map(
      (pagesResult.data || []).map((p: { id: string; page_name: string }) => [
        p.id,
        p,
      ])
    );

    // Calculate totals
    const videos = weekVideos || [];
    const posts = weekPosts || [];

    const todayVideos = videos.filter(
      (v) => v.created_at >= todayStartISO
    );
    const todayPosts = posts.filter(
      (p) => p.created_at >= todayStartISO
    );

    const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
    const totalReactions = posts.reduce(
      (sum, p) => sum + (p.reactions || 0),
      0
    );
    const totalShares = posts.reduce((sum, p) => sum + (p.shares || 0), 0);
    const totalComments = posts.reduce(
      (sum, p) => sum + (p.comments || 0),
      0
    );
    const avgScore =
      posts.length > 0
        ? Math.round(
            (posts.reduce((sum, p) => sum + (p.performance_score || 0), 0) /
              posts.length) *
              100
          ) / 100
        : 0;

    // Top 5 performing posts
    const sortedPosts = [...posts]
      .sort((a, b) => (b.performance_score || 0) - (a.performance_score || 0))
      .slice(0, 5);

    const topPosts: TopPost[] = sortedPosts.map((p) => {
      const video = videosMap.get(p.video_id) as
        | { id: string; script: string; niche: string }
        | undefined;
      const page = pagesMap.get(p.page_id) as
        | { id: string; page_name: string }
        | undefined;

      return {
        id: p.id,
        facebook_post_id: p.facebook_post_id,
        posted_at: p.posted_at,
        views: p.views || 0,
        reactions: p.reactions || 0,
        shares: p.shares || 0,
        comments: p.comments || 0,
        performance_score: p.performance_score || 0,
        video_title: video?.script?.split("\n")[0]?.slice(0, 80) || "Untitled",
        page_name: page?.page_name || "Unknown Page",
        niche: video?.niche || "unknown",
      };
    });

    // Per-niche breakdown
    const niches = ["news", "finance", "motivation", "entertainment"];
    const nicheBreakdowns: NicheBreakdown[] = niches.map((niche) => {
      const nicheVideos = videos.filter((v) => v.niche === niche);
      const nicheVideoIds = new Set(nicheVideos.map((v) => v.id));
      const nichePosts = posts.filter((p) => nicheVideoIds.has(p.video_id));

      const nViews = nichePosts.reduce((s, p) => s + (p.views || 0), 0);
      const nReactions = nichePosts.reduce(
        (s, p) => s + (p.reactions || 0),
        0
      );
      const nShares = nichePosts.reduce((s, p) => s + (p.shares || 0), 0);
      const nComments = nichePosts.reduce(
        (s, p) => s + (p.comments || 0),
        0
      );
      const nAvgScore =
        nichePosts.length > 0
          ? Math.round(
              (nichePosts.reduce(
                (s, p) => s + (p.performance_score || 0),
                0
              ) /
                nichePosts.length) *
                100
            ) / 100
          : 0;

      return {
        niche,
        videoCount: nicheVideos.length,
        postCount: nichePosts.length,
        totalViews: nViews,
        totalReactions: nReactions,
        totalShares: nShares,
        totalComments: nComments,
        avgScore: nAvgScore,
      };
    });

    return NextResponse.json({
      period: {
        weekStart: weekStartISO,
        now: now.toISOString(),
      },
      today: {
        videosGenerated: todayVideos.length,
        postsCreated: todayPosts.length,
      },
      week: {
        videosGenerated: videos.length,
        postsCreated: posts.length,
        totalViews,
        totalReactions,
        totalShares,
        totalComments,
        avgPerformanceScore: avgScore,
      },
      topPosts,
      nicheBreakdowns,
    });
  } catch (error) {
    console.error("[studio/analytics] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
