import { NextRequest, NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import { createSupabaseAdmin } from "@/lib/supabase";

interface PostWithPage {
  id: string;
  facebook_post_id: string;
  video_id: string;
  page_id: string;
  studio_videos: {
    page_id: string;
    studio_pages: {
      page_access_token: string;
    } | null;
  } | null;
}

interface FacebookInsights {
  views?: number;
  reactions?: { summary?: { total_count?: number } };
  shares?: { count?: number };
  comments?: { summary?: { total_count?: number } };
}

/**
 * Analytics Sync endpoint. Can be called by cron (CRON_SECRET) or by an authenticated owner.
 * GET /api/studio/analytics/sync
 *
 * Fetches latest stats from Facebook Graph API for all posted content
 * and updates performance scores in the database.
 */
export async function GET(req: NextRequest) {
  try {
    // Accept either owner auth or CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization") || "";
    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCronAuth) {
      const authResult = await requireStudioOwner();
      if (authResult instanceof NextResponse) return authResult;
    }

    const supabase = createSupabaseAdmin();

    // Get all posts with status='posted' and a facebook_post_id,
    // joining through studio_videos to studio_pages for access tokens
    const { data: posts, error: postsError } = await supabase
      .from("studio_posts")
      .select(
        `
        id,
        facebook_post_id,
        video_id,
        page_id,
        studio_videos!inner (
          page_id,
          studio_pages:page_id (
            page_access_token
          )
        )
      `
      )
      .eq("status", "posted")
      .not("facebook_post_id", "is", null);

    if (postsError) {
      console.error("[studio/analytics/sync] Failed to fetch posts:", postsError);
      return NextResponse.json(
        { error: "Failed to fetch posts" },
        { status: 500 }
      );
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ synced: 0 });
    }

    let syncedCount = 0;
    const errors: string[] = [];

    for (const post of posts as unknown as PostWithPage[]) {
      try {
        const accessToken =
          post.studio_videos?.studio_pages?.page_access_token;

        if (!accessToken) {
          errors.push(
            `No access token found for post ${post.id} — skipping`
          );
          continue;
        }

        // Fetch stats from Facebook Graph API
        const fbUrl = new URL(
          `https://graph.facebook.com/v19.0/${post.facebook_post_id}`
        );
        fbUrl.searchParams.set(
          "fields",
          "views,reactions.summary(true),shares,comments.summary(true)"
        );
        fbUrl.searchParams.set("access_token", accessToken);

        const fbResponse = await fetch(fbUrl.toString());

        if (!fbResponse.ok) {
          const fbError = await fbResponse.json().catch(() => ({}));
          errors.push(
            `Facebook API error for post ${post.id}: ${JSON.stringify(fbError)}`
          );
          continue;
        }

        const fbData: FacebookInsights = await fbResponse.json();

        const views = fbData.views ?? 0;
        const reactions = fbData.reactions?.summary?.total_count ?? 0;
        const shares = fbData.shares?.count ?? 0;
        const comments = fbData.comments?.summary?.total_count ?? 0;

        // Calculate performance score
        const performanceScore =
          views * 0.3 + shares * 0.5 + comments * 0.2;

        // Update the post record
        const { error: updateError } = await supabase
          .from("studio_posts")
          .update({
            views,
            reactions,
            shares,
            comments,
            performance_score: Math.round(performanceScore * 100) / 100,
          })
          .eq("id", post.id);

        if (updateError) {
          errors.push(
            `Failed to update post ${post.id}: ${updateError.message}`
          );
          continue;
        }

        syncedCount++;
      } catch (postError) {
        const msg =
          postError instanceof Error ? postError.message : String(postError);
        errors.push(`Error syncing post ${post.id}: ${msg}`);
      }
    }

    return NextResponse.json({
      synced: syncedCount,
      total: posts.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[studio/analytics/sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to sync analytics" },
      { status: 500 }
    );
  }
}
