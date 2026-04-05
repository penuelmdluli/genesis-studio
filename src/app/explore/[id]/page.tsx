import { Metadata } from "next";
import { notFound } from "next/navigation";
import { VideoShareContent } from "./video-share-content";

// -------------------------------------------------------------
// Supabase REST fetch helper (server-side, no client needed)
// -------------------------------------------------------------
interface VideoRow {
  id: string;
  prompt: string;
  model_id: string;
  video_url: string;
  thumbnail_url: string | null;
  duration: number | null;
  resolution: string | null;
  has_audio: boolean;
  type: string;
  views: number;
  likes: number;
  recreates: number;
  shares: number;
  creator_name: string | null;
  creator_avatar_url: string | null;
  is_free_tier: boolean;
  is_featured: boolean;
  tags: string[] | null;
  created_at: string;
}

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function fetchVideo(id: string): Promise<VideoRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/explore_videos?id=eq.${encodeURIComponent(id)}&is_published=eq.true&is_flagged=eq.false&select=*&limit=1`,
      { headers: supabaseHeaders(), next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const rows: VideoRow[] = await res.json();
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function fetchRelatedVideos(
  video: VideoRow,
  limit = 6
): Promise<VideoRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  try {
    const res = await fetch(
      `${url}/rest/v1/explore_videos?is_published=eq.true&is_flagged=eq.false&model_id=eq.${encodeURIComponent(video.model_id)}&id=neq.${encodeURIComponent(video.id)}&select=*&order=likes.desc&limit=${limit}`,
      { headers: supabaseHeaders(), next: { revalidate: 120 } }
    );
    if (!res.ok) return [];
    return (await res.json()) as VideoRow[];
  } catch {
    return [];
  }
}

/** Map DB row to the client-side ExploreVideo shape */
function toExploreVideo(row: VideoRow) {
  return {
    id: row.id,
    prompt: row.prompt,
    modelId: row.model_id,
    videoUrl: row.video_url,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    duration: row.duration ?? undefined,
    resolution: row.resolution ?? undefined,
    hasAudio: row.has_audio,
    type: row.type,
    views: row.views,
    likes: row.likes,
    recreates: row.recreates,
    creatorName: row.creator_name ?? undefined,
    creatorAvatarUrl: row.creator_avatar_url ?? undefined,
    isFreeTier: row.is_free_tier,
    isFeatured: row.is_featured,
    tags: row.tags ?? undefined,
    createdAt: row.created_at,
  };
}

// -------------------------------------------------------------
// Dynamic OG / Twitter metadata
// -------------------------------------------------------------
type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const video = await fetchVideo(id);

  if (!video) {
    return { title: "Video Not Found — Genesis Studio" };
  }

  const promptPreview =
    video.prompt.length > 80
      ? video.prompt.slice(0, 80) + "..."
      : video.prompt;
  const ogImageUrl = `https://genesis-studio-hazel.vercel.app/api/og?id=${id}`;

  return {
    title: `"${promptPreview}" — Genesis Studio`,
    description: `AI-generated video with ${video.has_audio ? "native audio" : "stunning visuals"}. Create your own for free.`,
    openGraph: {
      title: `"${promptPreview}" — Genesis Studio`,
      description: "AI-generated video. Create your own for free.",
      type: "video.other",
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      videos: video.video_url
        ? [{ url: video.video_url, type: "video/mp4" }]
        : undefined,
    },
    twitter: {
      card: "player",
      title: `"${promptPreview}" — Genesis Studio`,
      description: "AI-generated video. Create your own for free.",
      images: [ogImageUrl],
    },
  };
}

// -------------------------------------------------------------
// Page (server component)
// -------------------------------------------------------------
export default async function VideoSharePage({ params }: Props) {
  const { id } = await params;
  const video = await fetchVideo(id);

  if (!video) {
    notFound();
  }

  const related = await fetchRelatedVideos(video);

  return (
    <VideoShareContent
      video={toExploreVideo(video)}
      relatedVideos={related.map(toExploreVideo)}
    />
  );
}
