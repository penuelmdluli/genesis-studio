/**
 * GENESIS STUDIO — Smart Owner Post Scheduler
 *
 * STRICT RULES:
 * - NEVER post immediately. ALL posts are scheduled to optimal time slots.
 * - Max 3 posts per page per day
 * - Slots: 8am, 1pm, 8pm SA time (UTC+2)
 * - Each slot can only hold 1 post
 * - If you create 3 videos at once, they go to 8am, 1pm, 8pm
 * - If today's slots are full, overflow to tomorrow
 * - Anti-pattern jitter: ±15 minutes so posts look natural
 */

import { getDb } from "@/lib/db-driver";

const SA_OFFSET_HOURS = 2;
const MAX_POSTS_PER_DAY = 3;

// Optimal posting slots (SA local time hours)
const SLOTS = [
  { hour: 8, jitter: 15 },   // Morning
  { hour: 13, jitter: 15 },  // Lunch
  { hour: 20, jitter: 15 },  // Evening
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
        const timeLabel = `${slot.hour}:00 SA ${dayLabel}`;

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
 * Record a scheduled post for tracking.
 */
export async function recordOwnerPost(
  pageId: string,
  pageName: string,
  postId: string,
  videoId: string,
  action: "posted" | "scheduled",
  scheduledFor?: Date
): Promise<void> {
  const supabase = getDb();
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
    console.log(`[SCHEDULER] Could not record post`);
  }
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
