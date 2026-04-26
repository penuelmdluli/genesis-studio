// ============================================
// MBS Posting Scheduler
// Finds optimal time slots with anti-pattern jitter.
// ============================================

import { createSupabaseAdmin } from "@/lib/supabase";
import { envString } from "@/lib/env";

// SA timezone offset (UTC+2)
const SA_OFFSET_HOURS = 2;

export async function scheduleJob(jobId: string): Promise<Date> {
  const supabase = createSupabaseAdmin();
  const pageId = envString("FB_MBS_PAGE_ID") ?? "";

  // Get config
  const { data: config } = await supabase
    .from("mbs_config")
    .select("*")
    .eq("page_id", pageId)
    .single();

  const maxPerDay = config?.max_posts_per_day ?? 5;
  const minGap = config?.min_minutes_between_posts ?? 90;
  const slots = (config?.optimal_slots as Array<{ hour: number; jitter_min?: number }>) ?? [
    { hour: 7 }, { hour: 12 }, { hour: 15 }, { hour: 18 }, { hour: 21 },
  ];

  // Count today's posts
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("mbs_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "posted")
    .gte("posted_at", todayStart.toISOString());

  const todayPosts = count ?? 0;

  // Find next available slot
  const now = new Date();
  let scheduledFor: Date;

  if (todayPosts >= maxPerDay) {
    // Schedule for tomorrow's first slot
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(slots[0].hour - SA_OFFSET_HOURS, 0, 0, 0);
    scheduledFor = tomorrow;
  } else {
    // Find next slot today
    const saHour = now.getUTCHours() + SA_OFFSET_HOURS;
    const futureSlots = slots.filter(s => s.hour > saHour);

    if (futureSlots.length > 0) {
      const slot = futureSlots[0];
      scheduledFor = new Date(now);
      scheduledFor.setUTCHours(slot.hour - SA_OFFSET_HOURS, 0, 0, 0);
    } else {
      // No more slots today, schedule for tomorrow
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(slots[0].hour - SA_OFFSET_HOURS, 0, 0, 0);
      scheduledFor = tomorrow;
    }
  }

  // Anti-pattern jitter: ±15 minutes
  const jitterMs = (Math.random() * 30 - 15) * 60 * 1000;
  scheduledFor = new Date(scheduledFor.getTime() + jitterMs);

  // Ensure minimum gap from last post
  const { data: lastPost } = await supabase
    .from("mbs_jobs")
    .select("posted_at")
    .eq("status", "posted")
    .order("posted_at", { ascending: false })
    .limit(1)
    .single();

  if (lastPost?.posted_at) {
    const minTime = new Date(new Date(lastPost.posted_at).getTime() + minGap * 60 * 1000);
    if (scheduledFor < minTime) {
      scheduledFor = minTime;
    }
  }

  // Update job
  await supabase.from("mbs_jobs").update({
    status: "scheduled",
    scheduled_for: scheduledFor.toISOString(),
  }).eq("id", jobId);

  // Record in posting schedule
  await supabase.from("mbs_posting_schedule").insert({
    job_id: jobId,
    page_id: pageId,
    slot_start: scheduledFor.toISOString(),
    slot_end: new Date(scheduledFor.getTime() + 15 * 60 * 1000).toISOString(),
  });

  return scheduledFor;
}
