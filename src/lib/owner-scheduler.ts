/**
 * GENESIS STUDIO — Smart Owner Post Scheduler
 *
 * Rules:
 * - Max 3 posts per page per day
 * - Optimal slots: 8am, 1pm, 8pm SA time (UTC+2)
 * - Min 4 hours between posts on the same page
 * - If a slot is taken, queue for the next available slot
 * - If all today's slots are used, schedule for tomorrow
 * - Anti-pattern jitter: ±15 minutes to look natural
 * - Posts that are immediate (first of the day) go out now
 * - Posts that need scheduling use Facebook's scheduled_publish_time
 */

import { createSupabaseAdmin } from "@/lib/supabase";

const SA_OFFSET_HOURS = 2;
const MAX_POSTS_PER_DAY = 3;
const MIN_GAP_MINUTES = 240; // 4 hours

// Optimal posting slots (SA local time hours)
const SLOTS = [
  { hour: 8, jitter: 30 },   // Morning: 7:30-8:30 SA
  { hour: 13, jitter: 30 },  // Lunch: 12:30-13:30 SA
  { hour: 20, jitter: 30 },  // Evening: 19:30-20:30 SA
];

// Table: owner_scheduled_posts — tracks all scheduled/posted owner content
// If table doesn't exist, scheduling still works (just without history)

interface ScheduleResult {
  action: "post_now" | "schedule";
  scheduledFor?: Date;
  reason: string;
}

/**
 * Determine whether to post now or schedule for later.
 * Checks recent posts on the target page to avoid flooding.
 */
export async function getPostingSlot(
  pageId: string,
  pageName: string
): Promise<ScheduleResult> {
  const supabase = createSupabaseAdmin();
  const now = new Date();

  // Count today's owner posts on this page
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  let todayPostCount = 0;
  let lastPostTime: Date | null = null;

  try {
    // Check our own tracking table
    const { data: recentPosts } = await supabase
      .from("owner_scheduled_posts")
      .select("posted_at, scheduled_for")
      .eq("page_id", pageId)
      .gte("posted_at", todayStart.toISOString())
      .order("posted_at", { ascending: false });

    if (recentPosts && recentPosts.length > 0) {
      todayPostCount = recentPosts.length;
      lastPostTime = new Date(recentPosts[0].posted_at);
    }
  } catch {
    // Table might not exist yet — that's fine, treat as no posts today
    console.log(`[SCHEDULER] owner_scheduled_posts table not found, proceeding without history`);
  }

  // Rule 1: If max posts reached today, schedule for tomorrow
  if (todayPostCount >= MAX_POSTS_PER_DAY) {
    const tomorrow = findNextSlot(now, true);
    return {
      action: "schedule",
      scheduledFor: tomorrow,
      reason: `${pageName}: ${todayPostCount}/${MAX_POSTS_PER_DAY} posts today, scheduled for ${formatSATime(tomorrow)}`,
    };
  }

  // Rule 2: If last post was less than 4 hours ago, schedule for next slot
  if (lastPostTime) {
    const gapMs = now.getTime() - lastPostTime.getTime();
    const gapMinutes = gapMs / (60 * 1000);

    if (gapMinutes < MIN_GAP_MINUTES) {
      const nextSlot = findNextSlot(now, false);
      // Also check the gap from last post to next slot
      const slotGap = (nextSlot.getTime() - lastPostTime.getTime()) / (60 * 1000);
      const finalSlot = slotGap >= MIN_GAP_MINUTES ? nextSlot : findNextSlot(nextSlot, false);

      return {
        action: "schedule",
        scheduledFor: finalSlot,
        reason: `${pageName}: last post ${Math.round(gapMinutes)}min ago (min ${MIN_GAP_MINUTES}min), scheduled for ${formatSATime(finalSlot)}`,
      };
    }
  }

  // Rule 3: No recent posts — post immediately
  return {
    action: "post_now",
    reason: `${pageName}: no recent posts, posting immediately`,
  };
}

/**
 * Find the next available posting slot.
 */
function findNextSlot(from: Date, nextDay: boolean): Date {
  const target = new Date(from);

  if (nextDay) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  const saHour = target.getUTCHours() + SA_OFFSET_HOURS;

  // Find next slot after current SA time
  const futureSlots = nextDay ? SLOTS : SLOTS.filter((s) => s.hour > saHour);
  const slot = futureSlots.length > 0 ? futureSlots[0] : SLOTS[0];

  if (futureSlots.length === 0 && !nextDay) {
    // No slots left today, go to tomorrow
    target.setUTCDate(target.getUTCDate() + 1);
  }

  target.setUTCHours(slot.hour - SA_OFFSET_HOURS, 0, 0, 0);

  // Anti-pattern jitter: ±jitter minutes
  const jitterMs = (Math.random() * slot.jitter * 2 - slot.jitter) * 60 * 1000;
  return new Date(target.getTime() + jitterMs);
}

/**
 * Record a post (immediate or scheduled) for tracking.
 */
export async function recordOwnerPost(
  pageId: string,
  pageName: string,
  postId: string,
  videoId: string,
  action: "posted" | "scheduled",
  scheduledFor?: Date
): Promise<void> {
  const supabase = createSupabaseAdmin();
  try {
    await supabase.from("owner_scheduled_posts").insert({
      page_id: pageId,
      page_name: pageName,
      fb_post_id: postId,
      video_id: videoId,
      status: action,
      posted_at: action === "posted" ? new Date().toISOString() : null,
      scheduled_for: scheduledFor?.toISOString() || null,
    });
  } catch {
    // Table might not exist — non-critical
    console.log(`[SCHEDULER] Could not record post (table may not exist)`);
  }
}

function formatSATime(d: Date): string {
  const sa = new Date(d.getTime() + SA_OFFSET_HOURS * 60 * 60 * 1000);
  return sa.toLocaleString("en-ZA", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
