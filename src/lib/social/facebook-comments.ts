// ============================================
// Facebook Page Auto-Comments
// Posts comments AS the page on its own posts.
// ============================================

import { envString } from "@/lib/env";

export async function postPageComment(postId: string, message: string): Promise<string | null> {
  const token = envString("FB_MBS_PAGE_ACCESS_TOKEN");
  if (!token) return null;

  const params = new URLSearchParams({
    message,
    access_token: token,
  });

  const res = await fetch(`https://graph.facebook.com/v25.0/${postId}/comments`, {
    method: "POST",
    body: params,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[FB Comment] Failed on ${postId}: ${err.slice(0, 200)}`);
    return null;
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}
