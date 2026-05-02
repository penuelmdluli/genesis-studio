/**
 * TikTok Video Posting
 *
 * Uses TikTok Content Posting API v2 (requires approved developer app).
 * Requires: TIKTOK_ACCESS_TOKEN (long-lived token from OAuth2)
 *
 * If not configured, falls back to generating a download link for manual posting.
 */

export function isTikTokConfigured(): boolean {
  return !!process.env.TIKTOK_ACCESS_TOKEN;
}

export async function postToTikTok(opts: {
  videoUrl: string;
  title: string;
  hashtags: string[];
}): Promise<{ success: boolean; shareId?: string; error?: string }> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) {
    return { success: false, error: "TikTok not configured — set TIKTOK_ACCESS_TOKEN" };
  }

  try {
    // Step 1: Init video upload
    const caption = `${opts.title}\n\n${opts.hashtags.map(h => `#${h}`).join(" ")}`;

    const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: caption.slice(0, 150),
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: opts.videoUrl,
        },
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`TikTok init failed: ${initRes.status} ${err}`);
    }

    const data = await initRes.json();
    if (data.error?.code !== "ok" && data.error?.code) {
      throw new Error(`TikTok error: ${data.error.code} — ${data.error.message}`);
    }

    const publishId = data.data?.publish_id;
    console.log(`[TIKTOK] ✅ Video submitted: ${publishId}`);
    return { success: true, shareId: publishId };
  } catch (err) {
    console.error(`[TIKTOK] Error:`, err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
