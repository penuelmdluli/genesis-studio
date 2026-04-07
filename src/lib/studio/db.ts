import { createSupabaseAdmin } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StudioPage {
  id: string;
  owner_id: string;
  page_id: string;
  page_name: string;
  page_access_token: string;
  niche: "news" | "finance" | "motivation" | "entertainment";
  is_active: boolean;
  follower_count: number;
  created_at: string;
}

export interface StudioTrend {
  id: string;
  date: string;
  niche: string;
  topic: string;
  headline: string;
  score: number;
  source: string | null;
  used: boolean;
  created_at: string;
}

export interface StudioVideo {
  id: string;
  trend_id: string | null;
  page_id: string | null;
  niche: string;
  script: string;
  raw_video_url: string | null;
  branded_video_url: string | null;
  watermark_applied: boolean;
  caption: string | null;
  production_id: string | null;
  status:
    | "pending"
    | "scripted"
    | "generating"
    | "branding"
    | "ready"
    | "posted"
    | "failed";
  error_message: string | null;
  created_at: string;
}

export interface StudioPost {
  id: string;
  video_id: string | null;
  page_id: string | null;
  facebook_post_id: string | null;
  scheduled_at: string | null;
  posted_at: string | null;
  status: "scheduled" | "posted" | "failed";
  views: number;
  reactions: number;
  shares: number;
  comments: number;
  performance_score: number;
  pinned_comment_posted: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function getSupabase() {
  return createSupabaseAdmin();
}

// ---------------------------------------------------------------------------
// Studio Pages
// ---------------------------------------------------------------------------

export async function getStudioPages(ownerId: string): Promise<StudioPage[]> {
  const { data, error } = await getSupabase()
    .from("studio_pages")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to get studio pages: ${error.message}`);
  return data as StudioPage[];
}

export async function createStudioPage(
  page: Omit<StudioPage, "id" | "created_at" | "is_active" | "follower_count">
): Promise<StudioPage> {
  const { data, error } = await getSupabase()
    .from("studio_pages")
    .insert(page)
    .select()
    .single();

  if (error) throw new Error(`Failed to create studio page: ${error.message}`);
  return data as StudioPage;
}

export async function updateStudioPage(
  id: string,
  updates: Partial<
    Omit<StudioPage, "id" | "created_at">
  >
): Promise<StudioPage> {
  const { data, error } = await getSupabase()
    .from("studio_pages")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update studio page: ${error.message}`);
  return data as StudioPage;
}

export async function deleteStudioPage(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("studio_pages")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Failed to delete studio page: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Studio Trends
// ---------------------------------------------------------------------------

export async function getStudioTrends(
  date: string,
  niche?: string
): Promise<StudioTrend[]> {
  let query = getSupabase()
    .from("studio_trends")
    .select("*")
    .eq("date", date)
    .order("score", { ascending: false });

  if (niche) {
    query = query.eq("niche", niche);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get studio trends: ${error.message}`);
  return data as StudioTrend[];
}

export async function createStudioTrend(
  trend: Omit<StudioTrend, "id" | "created_at" | "used">
): Promise<StudioTrend> {
  const { data, error } = await getSupabase()
    .from("studio_trends")
    .insert(trend)
    .select()
    .single();

  if (error) throw new Error(`Failed to create studio trend: ${error.message}`);
  return data as StudioTrend;
}

export async function markTrendUsed(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("studio_trends")
    .update({ used: true })
    .eq("id", id);

  if (error) throw new Error(`Failed to mark trend used: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Studio Videos
// ---------------------------------------------------------------------------

export async function getStudioVideos(
  filters?: Partial<Pick<StudioVideo, "status" | "niche" | "page_id">>
): Promise<StudioVideo[]> {
  let query = getSupabase()
    .from("studio_videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.niche) {
    query = query.eq("niche", filters.niche);
  }
  if (filters?.page_id) {
    query = query.eq("page_id", filters.page_id);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get studio videos: ${error.message}`);
  return data as StudioVideo[];
}

export async function createStudioVideo(
  video: Partial<Omit<StudioVideo, "id" | "created_at">> & { niche: string; script: string }
): Promise<StudioVideo> {
  const { data, error } = await getSupabase()
    .from("studio_videos")
    .insert(video)
    .select()
    .single();

  if (error) throw new Error(`Failed to create studio video: ${error.message}`);
  return data as StudioVideo;
}

export async function updateStudioVideo(
  id: string,
  updates: Partial<Omit<StudioVideo, "id" | "created_at">>
): Promise<StudioVideo> {
  const { data, error } = await getSupabase()
    .from("studio_videos")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update studio video: ${error.message}`);
  return data as StudioVideo;
}

export async function getReadyUnpostedVideos(): Promise<StudioVideo[]> {
  // Get videos that are ready but have no associated post yet
  const { data: videos, error: videosError } = await getSupabase()
    .from("studio_videos")
    .select("*")
    .eq("status", "ready")
    .order("created_at", { ascending: true });

  if (videosError)
    throw new Error(
      `Failed to get ready unposted videos: ${videosError.message}`
    );

  if (!videos || videos.length === 0) return [];

  // Filter out videos that already have a post
  const videoIds = videos.map((v: StudioVideo) => v.id);
  const { data: posts, error: postsError } = await getSupabase()
    .from("studio_posts")
    .select("video_id")
    .in("video_id", videoIds);

  if (postsError)
    throw new Error(`Failed to check posts: ${postsError.message}`);

  const postedVideoIds = new Set(
    (posts || []).map((p: { video_id: string }) => p.video_id)
  );
  return videos.filter(
    (v: StudioVideo) => !postedVideoIds.has(v.id)
  ) as StudioVideo[];
}

// ---------------------------------------------------------------------------
// Studio Posts
// ---------------------------------------------------------------------------

export async function getStudioPosts(
  filters?: Partial<Pick<StudioPost, "status" | "page_id" | "video_id">>
): Promise<StudioPost[]> {
  let query = getSupabase()
    .from("studio_posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.page_id) {
    query = query.eq("page_id", filters.page_id);
  }
  if (filters?.video_id) {
    query = query.eq("video_id", filters.video_id);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get studio posts: ${error.message}`);
  return data as StudioPost[];
}

export async function createStudioPost(
  post: Partial<Omit<StudioPost, "id" | "created_at">> & { status: string }
): Promise<StudioPost> {
  const { data, error } = await getSupabase()
    .from("studio_posts")
    .insert(post)
    .select()
    .single();

  if (error) throw new Error(`Failed to create studio post: ${error.message}`);
  return data as StudioPost;
}

export async function updateStudioPost(
  id: string,
  updates: Partial<Omit<StudioPost, "id" | "created_at">>
): Promise<StudioPost> {
  const { data, error } = await getSupabase()
    .from("studio_posts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update studio post: ${error.message}`);
  return data as StudioPost;
}
