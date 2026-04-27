// ============================================
// Facebook Page Video Posting
// ============================================

import { envString } from "@/lib/env";

export async function postVideoToFacebookPage(opts: {
  videoUrl: string;
  description: string;
  scheduledPublishTime?: number;
}): Promise<{ postId: string; videoId: string }> {
  const pageId = envString("FB_MBS_PAGE_ID");
  const token = envString("FB_MBS_PAGE_ACCESS_TOKEN");
  if (!pageId || !token) throw new Error("FB_MBS_PAGE_ID or FB_MBS_PAGE_ACCESS_TOKEN not set");

  const params = new URLSearchParams({
    file_url: opts.videoUrl,
    description: opts.description,
    access_token: token,
  });

  if (opts.scheduledPublishTime) {
    params.set("scheduled_publish_time", String(opts.scheduledPublishTime));
    params.set("published", "false");
  }

  const res = await fetch(`https://graph.facebook.com/v25.0/${pageId}/videos`, {
    method: "POST",
    body: params,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`FB post failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { id: string; post_id?: string };
  return {
    postId: data.post_id ?? data.id,
    videoId: data.id,
  };
}

/**
 * Cross-post video to additional Facebook profiles/pages.
 * Uses FB_CROSSPOST_TARGETS env var: comma-separated "id:token" pairs.
 * Non-fatal — failures are logged but don't block main post.
 */
export async function crossPostVideo(opts: {
  videoUrl: string;
  description: string;
}): Promise<{ posted: string[]; failed: string[] }> {
  const targets = envString("FB_CROSSPOST_TARGETS");
  if (!targets) return { posted: [], failed: [] };

  const posted: string[] = [];
  const failed: string[] = [];

  for (const target of targets.split(",").filter(Boolean)) {
    const [targetId, token] = target.split(":").map(s => s.trim());
    if (!targetId || !token) continue;

    try {
      const params = new URLSearchParams({
        file_url: opts.videoUrl,
        description: opts.description,
        access_token: token,
      });

      const res = await fetch(`https://graph.facebook.com/v25.0/${targetId}/videos`, {
        method: "POST",
        body: params,
      });

      if (res.ok) {
        const data = (await res.json()) as { id: string };
        posted.push(`${targetId}:${data.id}`);
        console.log(`[FB Crosspost] Posted to ${targetId}: ${data.id}`);
      } else {
        const err = await res.text();
        failed.push(targetId);
        console.error(`[FB Crosspost] Failed ${targetId}: ${err.slice(0, 150)}`);
      }
    } catch (err) {
      failed.push(targetId);
      console.error(`[FB Crosspost] Error ${targetId}:`, err instanceof Error ? err.message : err);
    }
  }

  return { posted, failed };
}

export async function getFacebookPostEngagement(postId: string): Promise<{
  views: number;
  reactions: number;
  comments: number;
  shares: number;
}> {
  const token = envString("FB_MBS_PAGE_ACCESS_TOKEN");
  if (!token) throw new Error("FB_MBS_PAGE_ACCESS_TOKEN not set");

  const res = await fetch(
    `https://graph.facebook.com/v25.0/${postId}?fields=video_views,reactions.summary(total_count),comments.summary(total_count),shares&access_token=${token}`
  );
  if (!res.ok) throw new Error(`FB engagement fetch failed: ${res.status}`);

  const data = (await res.json()) as {
    video_views?: number;
    reactions?: { summary: { total_count: number } };
    comments?: { summary: { total_count: number } };
    shares?: { count: number };
  };

  return {
    views: data.video_views ?? 0,
    reactions: data.reactions?.summary.total_count ?? 0,
    comments: data.comments?.summary.total_count ?? 0,
    shares: data.shares?.count ?? 0,
  };
}
