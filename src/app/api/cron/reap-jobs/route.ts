// ============================================
// GENESIS STUDIO — Job reaper (every minute)
// ============================================
// Two passes, in this order:
//
//   1. Proactive delivery. Any hosted job the provider has finished is
//      delivered now, whether or not the customer still has the page open.
//   2. Deadlines. A job past its deadline is polled at the provider first:
//      done → delivered; still rendering and under the 45-minute hard cap →
//      deadline extended by 10 minutes; provider says failed, or hard cap
//      passed → failed and refunded.
//
// The previous reaper did only the failing half, without the poll. It killed
// a paying customer's render at the 5-minute mark on 2026-09-12 and refunded
// it; the provider finished two minutes later and billed us anyway.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { updateJobStatus } from "@/lib/db";
import { releaseOrphanedHolds, outstandingHeld } from "@/lib/credit-escrow";
import {
  sweepActiveHostedJobs,
  pollHostedJob,
  finalizeHostedJob,
  failHostedJob,
  isToolJob,
  HOSTED_HARD_CAP_MS,
  DEADLINE_EXTENSION_MS,
  type HostedJobRow,
} from "@/lib/job-finalizer";

export const maxDuration = 60;

/** Batch cap. The reaper shares the Worker's budget with everything else. */
const MAX_PER_RUN = 25;
const FALLBACK_TIMEOUT_MINUTES = 45;

const TIMEOUT_MESSAGE =
  "This generation took longer than expected and was stopped. Your credits have been returned.";

export async function GET(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const nowIso = new Date().toISOString();

  // ── Pass 1: deliver whatever is already done ───────────────────────────
  let sweep = { checked: 0, delivered: 0, failed: 0, pending: 0 };
  try {
    sweep = await sweepActiveHostedJobs({ minAgeSec: 45, limit: MAX_PER_RUN });
  } catch (err) {
    console.error("[REAPER] Sweep failed:", err);
  }

  // ── Pass 2: deadlines ──────────────────────────────────────────────────
  const fallbackCutoff = new Date(Date.now() - FALLBACK_TIMEOUT_MINUTES * 60_000).toISOString();
  const cols =
    "id, user_id, model_id, type, runpod_job_id, credits_cost, prompt, resolution, duration, fps, aspect_ratio, audio_url, audio_track_id, created_at, status, deadline_at";

  const { data: overdue } = await db
    .from("generation_jobs")
    .select(cols)
    .in("status", ["queued", "processing"])
    .lt("deadline_at", nowIso)
    .limit(MAX_PER_RUN);

  // Jobs with no deadline at all — tool jobs and everything created before migration 0006.
  const { data: ancient } = await db
    .from("generation_jobs")
    .select(cols)
    .in("status", ["queued", "processing"])
    .is("deadline_at", null)
    .lt("created_at", fallbackCutoff)
    .limit(MAX_PER_RUN);

  const seen = new Set<string>();
  const stale = [...(overdue ?? []), ...(ancient ?? [])].filter((j) => {
    if (seen.has(j.id)) return false;
    seen.add(j.id);
    return true;
  }) as Array<HostedJobRow & { deadline_at: string | null }>;

  let reaped = 0;
  let extended = 0;
  let delivered = 0;
  let creditsReturned = 0;
  const failures: string[] = [];

  for (const job of stale) {
    try {
      const age = Date.now() - new Date(job.created_at).getTime();
      const hosted = !!job.runpod_job_id && (job.runpod_job_id.startsWith("ws:") || job.runpod_job_id.startsWith("fal:"));

      // Tool jobs are finalized by their own poller; only the hard cap applies.
      if (hosted && !isToolJob(job)) {
        const poll = await pollHostedJob(job);
        if (poll.state === "completed") {
          await finalizeHostedJob(job, poll, { source: "reaper" });
          delivered++;
          continue;
        }
        if (poll.state === "pending" && age < HOSTED_HARD_CAP_MS) {
          await updateJobStatus(job.id, {
            status: "processing",
            deadlineAt: new Date(Date.now() + DEADLINE_EXTENSION_MS).toISOString(),
          });
          extended++;
          continue;
        }
        if (poll.state === "failed") {
          await failHostedJob(job, "Generation failed at the provider. Your credits have been returned.", "provider_failed");
          reaped++;
          creditsReturned += job.credits_cost ?? 0;
          continue;
        }
        // pending past the hard cap, or unsupported — fall through to timeout
      }

      await failHostedJob(job, TIMEOUT_MESSAGE, "timeout");
      reaped++;
      creditsReturned += job.credits_cost ?? 0;
    } catch (err) {
      failures.push(job.id);
      console.error(`[REAPER] Failed to reap ${job.id}:`, err);
    }
  }

  // Reservations that never reached a job row — a crash between taking the
  // credits and creating the job. Nothing else would ever resolve these.
  let orphansReleased = 0;
  try {
    orphansReleased = await releaseOrphanedHolds(60);
  } catch (err) {
    console.error("[REAPER] Orphan sweep failed:", err);
  }

  const outstanding = await outstandingHeld().catch(() => ({ count: 0, amount: 0 }));

  if (reaped > 0 || extended > 0 || delivered > 0 || sweep.delivered > 0 || orphansReleased > 0) {
    console.log(
      `[REAPER] sweep=${JSON.stringify(sweep)} delivered=${delivered} extended=${extended} reaped=${reaped} creditsReturned=${creditsReturned} orphans=${orphansReleased} stillHeld=${outstanding.amount}`
    );
  }

  return NextResponse.json({
    sweep,
    delivered,
    extended,
    reaped,
    creditsReturned,
    orphansReleased,
    failures,
    outstandingHeld: outstanding,
  });
}
