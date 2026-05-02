/**
 * YouTube Shorts Upload
 *
 * Uploads videos to YouTube as Shorts using YouTube Data API v3 with OAuth2.
 * Requires: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
 */

export function isYouTubeConfigured(): boolean {
  return !!(
    process.env.YOUTUBE_CLIENT_ID &&
    process.env.YOUTUBE_CLIENT_SECRET &&
    process.env.YOUTUBE_REFRESH_TOKEN
  );
}

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube token refresh failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function uploadToYouTubeShorts(opts: {
  videoUrl: string;
  title: string;
  description: string;
  tags: string[];
}): Promise<{ success: boolean; youtubeVideoId?: string; error?: string }> {
  if (!isYouTubeConfigured()) {
    return { success: false, error: "YouTube not configured" };
  }

  try {
    const accessToken = await getAccessToken();

    // Download video
    console.log(`[YOUTUBE] Downloading video...`);
    const videoRes = await fetch(opts.videoUrl);
    if (!videoRes.ok) throw new Error(`Download failed: ${videoRes.status}`);
    const videoBuffer = await videoRes.arrayBuffer();

    // Ensure #Shorts is in title
    let title = opts.title.slice(0, 95);
    if (!title.includes("#Shorts")) title = `${title} #Shorts`;

    // Initialize resumable upload
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(videoBuffer.byteLength),
          "X-Upload-Content-Type": "video/mp4",
        },
        body: JSON.stringify({
          snippet: {
            title,
            description: opts.description,
            tags: opts.tags,
            categoryId: "22",
          },
          status: {
            privacyStatus: "public",
            selfDeclaredMadeForKids: false,
            embeddable: true,
          },
        }),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`YouTube init failed: ${initRes.status} ${err}`);
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) throw new Error("No upload URL returned");

    // Upload binary
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(videoBuffer.byteLength),
        "Content-Type": "video/mp4",
      },
      body: videoBuffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`YouTube upload failed: ${uploadRes.status} ${err}`);
    }

    const data = await uploadRes.json();
    console.log(`[YOUTUBE] ✅ Published as Short: ${data.id}`);
    return { success: true, youtubeVideoId: data.id };
  } catch (err) {
    console.error(`[YOUTUBE] Error:`, err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
