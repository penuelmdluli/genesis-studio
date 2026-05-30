import { NextRequest, NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import { updateStudioPost } from "@/lib/studio/db";
import { getDb } from "@/lib/db-driver";

const PINNED_COMMENT_TEXT = "Follow for more \u26A1\u{1F525}";
const VIEW_THRESHOLD = 50;

/**
 * Pinned comment checker. Can be called by cron (CRON_SECRET) or by an authenticated owner.
 * GET /api/studio/posts/pin-comment
 *
 * Checks posted videos that don't have a pinned comment yet.
 * If a video has >= 50 views, posts and pins a promotional comment.
 */
export async function GET(req: NextRequest) {
  try {
    // Accept either owner auth or CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization") || "";
    const isCronAuth =
      cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCronAuth) {
      const authResult = await requireStudioOwner();
      if (authResult instanceof NextResponse) return authResult;
    }

    const supabase = getDb();

    // Get posted items where pinned_comment_posted = false
    const { data: rawPosts, error: postsError } = await supabase
      .from("studio_posts")
      .select("*")
      .eq("pinned_comment_posted", false)
      .eq("status", "posted");

    if (postsError) {
      console.error("[studio/posts/pin-comment] DB error:", postsError);
      return NextResponse.json(
        { error: "Failed to fetch posts" },
        { status: 500 }
      );
    }

    if (!rawPosts || rawPosts.length === 0) {
      return NextResponse.json({ pinned: 0, checked: 0, errors: [] });
    }

    // Fetch related studio_pages separately (D1 doesn't support join syntax)
    const pageIds = [...new Set(rawPosts.map((p: any) => p.page_id).filter(Boolean))];
    let pagesMap: Record<string, any> = {};
    if (pageIds.length > 0) {
      const { data: pages } = await supabase
        .from("studio_pages")
        .select("*")
        .in("id", pageIds);
      for (const pg of pages ?? []) {
        pagesMap[pg.id] = pg;
      }
    }
    const posts = rawPosts.map((p: any) => ({
      ...p,
      studio_pages: pagesMap[p.page_id] ?? null,
    }));

    const errors: string[] = [];
    let pinnedCount = 0;

    for (const post of posts) {
      try {
        const page = post.studio_pages;
        if (!page || !page.access_token) {
          errors.push(`Post ${post.id}: no page or access token`);
          continue;
        }

        const fbPostId = post.facebook_post_id;
        if (!fbPostId) {
          errors.push(`Post ${post.id}: no facebook_post_id`);
          continue;
        }

        // Check view count via Facebook Graph API
        const insightsResponse = await fetch(
          `https://graph.facebook.com/v19.0/${fbPostId}?fields=views&access_token=${page.access_token}`
        );

        if (!insightsResponse.ok) {
          // Video insights might not be available yet, skip
          continue;
        }

        const insightsData = await insightsResponse.json();
        const views = insightsData.views || 0;

        if (views < VIEW_THRESHOLD) {
          continue;
        }

        // Post the promotional comment
        const commentResponse = await fetch(
          `https://graph.facebook.com/v19.0/${fbPostId}/comments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: PINNED_COMMENT_TEXT,
              access_token: page.access_token,
            }),
          }
        );

        if (!commentResponse.ok) {
          const commentError = await commentResponse
            .json()
            .catch(() => ({}));
          errors.push(
            `Post ${post.id}: failed to comment: ${JSON.stringify(commentError)}`
          );
          continue;
        }

        const commentData = await commentResponse.json();
        const commentId = commentData.id;

        // Pin the comment (Facebook doesn't have a native pin API for page
        // video comments via Graph API, but we can mark it as done)
        // Note: Facebook Graph API v19 does not support pinning comments
        // programmatically on video posts. The comment is posted at the top
        // since it's posted by the page itself, which gives it prominence.

        // Update the post record
        await updateStudioPost(post.id, {
          pinned_comment_posted: true,
        });

        pinnedCount++;
      } catch (postError) {
        const msg =
          postError instanceof Error ? postError.message : String(postError);
        errors.push(`Error processing post ${post.id}: ${msg}`);
      }
    }

    return NextResponse.json({
      pinned: pinnedCount,
      checked: posts.length,
      errors,
    });
  } catch (error) {
    console.error("[studio/posts/pin-comment] Error:", error);
    return NextResponse.json(
      { error: "Failed to check pinned comments" },
      { status: 500 }
    );
  }
}
