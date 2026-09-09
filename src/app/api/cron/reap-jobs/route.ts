import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { releaseHoldForJob, releaseOrphanedHolds, outstandingHeld } from "@/lib/credit-escrow";

// The job reaper. Nothing else owns the decision to give up.
//
// Production has 18 timeout failures and four jobs still sitting in "queued",
// the oldest from weeks ago. Two different actors used to decide a job had
// timed out — cron/check-stuck-jobs and GET /api/jobs/[jobId] — and both
// refunded, so a user polling their job while the cron swept could be credited
// twice. This is now the single place that decides a job is over, and it
// resolves through the guarded hold, so it cannot double-credit.
//
// Runs every minute from workers/cron-handler.js.

/** Batch cap. The reaper shares the Worker's budget with everything else. */
const MAX_PER_RUN = 25;

/**
 * Backstop for jobs created before deadlines existed, or by a path that does
 * not set one. Long enough to clear the slowest model we run.
 */
const FALLBACK_TIMEOUT_MINUTES = 45;

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
  const fallbackCutoff = new Date(Date.now() - FALLBACK_TIMEOUT_MINUTES * 60_000).toISOString();

  // Jobs past their own deadline.
  const { data: overdue } = await db
    .from("generation_jobs")
    .select("id, user_id, credits_cost, model_id, deadline_at, created_at")
    .in("status", ["queued", "processing"])
    .lt("deadline_at", nowIso)
    .limit(MAX_PER_RUN);

  // Jobs with no deadline at all — everything created before migration 0006.
  const { data: ancient } = await db
    .from("generation_jobs")
    .select("id, user_id, credits_cost, model_id, deadline_at, created_at")
    .in("status", ["queued", "processing"])
    .is("deadline_at", null)
    .lt("created_at", fallbackCutoff)
    .limit(MAX_PER_RUN);

  const seen = new Set<string>();
  const stale = [...(overdue ?? []), ...(ancient ?? [])].filter((j) => {
    if (seen.has(j.id)) return false;
    seen.add(j.id);
    return true;
  });

  let reaped = 0;
  let creditsReturned = 0;
  const failures: string[] = [];

  for (const job of stale) {
    try {
      // Status first. updateJobStatus settles the hold on a terminal status,
      // so in the normal case the release below is already a no-op — it stays
      // as a belt-and-braces for jobs whose settlement hook failed.
      const { updateJobStatus } = await import("@/lib/db");
      await updateJobStatus(job.id, {
        status: "failed",
        errorCode: "timeout",
        errorMessage:
          "This generation took longer than expected and was stopped. Your credits have been returned.",
        completedAt: nowIso,
      });

      if (await releaseHoldForJob(job.id, "Job exceeded its deadline")) {
        creditsReturned += job.credits_cost ?? 0;
      } else if ((job.credits_cost ?? 0) > 0) {
        // No hold means this job predates escrow. Its credits were taken by
        // the old deductCredits path — which wrote the ledger row with an
        // empty job_id, so the debit cannot even be linked back here. The
        // user was still charged, so they are still owed. refundCredits is
        // now idempotent per job, so this cannot double-credit.
        const { refundCredits } = await import("@/lib/credits");
        await refundCredits(
          job.user_id,
          job.credits_cost,
          job.id,
          "Generation timed out - automatic refund"
        );
        creditsReturned += job.credits_cost;
      }
      reaped++;
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

  if (reaped > 0 || orphansReleased > 0) {
    console.log(
      `[REAPER] reaped=${reaped} creditsReturned=${creditsReturned} orphans=${orphansReleased} stillHeld=${outstanding.amount}`
    );
  }

  return NextResponse.json({
    reaped,
    creditsReturned,
    orphansReleased,
    failures,
    outstandingHeld: outstanding,
    checkedAt: nowIso,
  });
}
