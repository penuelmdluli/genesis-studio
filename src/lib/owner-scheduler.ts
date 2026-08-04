/**
 * GENESIS STUDIO — Smart Owner Post Scheduler
 *
 * STRICT RULES:
 * - NEVER post immediately. ALL posts are scheduled to optimal time slots.
 * - Max 3 posts per page per day
 * - Slots: 7am, 1pm, 6pm SA time (UTC+2)
 * - Each slot can only hold 1 post
 * - If you create 3 videos at once, they go to 7am, 1pm, 6pm
 * - If today's slots are full, overflow to tomorrow
 * - Anti-pattern jitter: ±10 minutes so posts look natural
 * - Slack + in-app notification on every schedule and post
 */

import { getDb } from "@/lib/db-driver";

const SA_OFFSET_HOURS = 2;
const MAX_POSTS_PER_DAY = 3;

// Optimal posting slots (SA local time hours)
const SLOTS = [
  { hour: 7, label: "7 AM", jitter: 10 },    // Morning commute
  { hour: 13, label: "1 PM", jitter: 10 },   // Lunch break
  { hour: 18, label: "6 PM", jitter: 10 },   // Evening prime time (last post of the day)
];

interface ScheduleResult {
  action: "schedule";
  scheduledFor: Date;
  reason: string;
}

/**
 * Always returns a scheduled slot. Never posts immediately.
 * Finds the next available slot that isn't already taken.
 */
export async function getPostingSlot(
  pageId: string,
  pageName: string
): Promise<ScheduleResult> {
  const supabase = getDb();
  const now = new Date();

  // Get all booked slots for the next 7 days on this page
  const lookAhead = new Date(now.getTime() + 7 * 86400000);
  let bookedSlots: Date[] = [];

  try {
    const { data: records } = await supabase
      .from("owner_scheduled_posts")
      .select("scheduled_for, posted_at, created_at")
      .eq("page_id", pageId)
      .gte("created_at", new Date(now.getTime() - 86400000).toISOString())
      .order("created_at", { ascending: false });

    if (records) {
      bookedSlots = records.map((r: any) => {
        const t = r.scheduled_for || r.posted_at || r.created_at;
        return new Date(t);
      });
    }
  } catch {
    // Table may not exist — proceed with empty bookings
  }

  // Find the next available slot
  const slot = findNextAvailableSlot(now, lookAhead, bookedSlots);

  return {
    action: "schedule",
    scheduledFor: slot.time,
    reason: `${pageName}: scheduled for ${formatSATime(slot.time)} (${slot.label})`,
  };
}

/**
 * Walk through slots day by day until we find one that's not booked.
 * A slot is "booked" if any existing post is within 2 hours of it.
 */
function findNextAvailableSlot(
  now: Date,
  maxDate: Date,
  bookedSlots: Date[]
): { time: Date; label: string } {
  const current = new Date(now);

  // Start from today, walk forward day by day
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const day = new Date(current);
    day.setUTCDate(day.getUTCDate() + dayOffset);

    // Count how many posts are already booked for this day
    const dayStart = new Date(day); dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(day); dayEnd.setUTCHours(23, 59, 59, 999);
    const dayBookings = bookedSlots.filter((b) => b >= dayStart && b <= dayEnd);

    if (dayBookings.length >= MAX_POSTS_PER_DAY) continue; // Day is full

    for (const slot of SLOTS) {
      const slotTime = new Date(day);
      slotTime.setUTCHours(slot.hour - SA_OFFSET_HOURS, 0, 0, 0);

      // Skip slots in the past (need at least 10 min in the future for FB API)
      if (slotTime.getTime() < now.getTime() + 10 * 60 * 1000) continue;

      // Skip if beyond our look-ahead window
      if (slotTime > maxDate) continue;

      // Check if this slot is already booked (within 2 hours of an existing post)
      const isBooked = bookedSlots.some(
        (b) => Math.abs(b.getTime() - slotTime.getTime()) < 2 * 60 * 60 * 1000
      );

      if (!isBooked) {
        // Add jitter
        const jitterMs = (Math.random() * slot.jitter * 2 - slot.jitter) * 60 * 1000;
        const finalTime = new Date(slotTime.getTime() + jitterMs);

        const dayLabel = dayOffset === 0 ? "today" : dayOffset === 1 ? "tomorrow" : `in ${dayOffset} days`;
        const timeLabel = `${slot.label} SA ${dayLabel}`;

        return { time: finalTime, label: timeLabel };
      }
    }
  }

  // Fallback: 8am in 3 days (shouldn't reach here)
  const fallback = new Date(now);
  fallback.setUTCDate(fallback.getUTCDate() + 3);
  fallback.setUTCHours(SLOTS[0].hour - SA_OFFSET_HOURS, 0, 0, 0);
  return { time: fallback, label: "8:00 SA in 3 days (fallback)" };
}

/**
 * Record a scheduled post and send notifications.
 */
export async function recordOwnerPost(
  pageId: string,
  pageName: string,
  postId: string,
  videoId: string,
  action: "posted" | "scheduled",
  scheduledFor?: Date,
  prompt?: string
): Promise<void> {
  const supabase = getDb();
  try {
    await supabase.from("owner_scheduled_posts").insert({
      page_id: pageId,
      page_name: pageName,
      fb_post_id: postId,
      video_id: videoId,
      prompt: prompt?.slice(0, 200) || null,
      status: action,
      posted_at: action === "posted" ? new Date().toISOString() : null,
      scheduled_for: scheduledFor?.toISOString() || null,
    });
  } catch {
    console.log(`[SCHEDULER] Could not record post`);
  }

  // Send Slack notification
  try {
    const { sendSlackAlert } = await import("@/lib/alerts");
    if (action === "scheduled" && scheduledFor) {
      await sendSlackAlert({
        level: "info",
        title: `📅 Video scheduled: ${pageName}`,
        message: `Post scheduled for ${formatSATime(scheduledFor)}\nPage: ${pageName}\nPrompt: ${prompt?.slice(0, 80) || "N/A"}\nFB Post ID: ${postId}`,
      });
    } else if (action === "posted") {
      await sendSlackAlert({
        level: "info",
        title: `✅ Video posted: ${pageName}`,
        message: `Successfully posted to ${pageName}\nPrompt: ${prompt?.slice(0, 80) || "N/A"}\nFB Post ID: ${postId}`,
      });
    }
  } catch {}
}

/**
 * Get upcoming scheduled posts for the owner dashboard.
 */
export async function getScheduledPosts(limit = 20): Promise<Array<{
  id: string;
  pageName: string;
  prompt: string | null;
  status: string;
  scheduledFor: string;
  postedAt: string | null;
  createdAt: string;
}>> {
  const supabase = getDb();
  try {
    const { data } = await supabase
      .from("owner_scheduled_posts")
      .select("id, page_name, prompt, status, scheduled_for, posted_at, created_at")
      .order("scheduled_for", { ascending: false })
      .limit(limit);

    return (data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      pageName: r.page_name as string,
      prompt: r.prompt as string | null,
      status: r.status as string,
      scheduledFor: r.scheduled_for as string,
      postedAt: r.posted_at as string | null,
      createdAt: r.created_at as string,
    }));
  } catch {
    return [];
  }
}

/**
 * Get posting schedule summary: slots filled today, next available slot.
 */
export async function getScheduleSummary(): Promise<{
  todayPosted: number;
  todayScheduled: number;
  nextSlot: string;
  upcomingCount: number;
}> {
  const supabase = getDb();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);

  let todayPosted = 0;
  let todayScheduled = 0;
  let upcomingCount = 0;

  try {
    const { data } = await supabase
      .from("owner_scheduled_posts")
      .select("status, scheduled_for")
      .gte("scheduled_for", todayStart.toISOString())
      .lte("scheduled_for", todayEnd.toISOString());

    for (const r of data || []) {
      if (r.status === "posted") todayPosted++;
      else todayScheduled++;
    }

    const { data: upcoming } = await supabase
      .from("owner_scheduled_posts")
      .select("id")
      .eq("status", "scheduled")
      .gte("scheduled_for", now.toISOString());

    upcomingCount = upcoming?.length || 0;
  } catch {}

  // Find next available slot
  const nextSlotResult = await getPostingSlot("any", "any");
  const nextSlot = formatSATime(nextSlotResult.scheduledFor);

  return { todayPosted, todayScheduled, nextSlot, upcomingCount };
}

function formatSATime(d: Date): string {
  const sa = new Date(d.getTime() + SA_OFFSET_HOURS * 60 * 60 * 1000);
  return sa.toLocaleString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
