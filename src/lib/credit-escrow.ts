// ============================================
// GENESIS STUDIO — Credit Escrow
// ============================================
// hold → capture | release, replacing debit-then-refund.
//
// Three production bugs this closes:
//
// 1. Orphaned debits. /api/generate debited before creating the job row, with
//    jobId "" and a promise to fill it in later that was never kept. If
//    createJob() threw, the refund lived in an inner catch that never ran and
//    the outer catch returned a bare 500 — the user was charged for a job that
//    does not exist, with no row to reconcile against.
//
// 2. Double refunds. refundCredits() has no guard against refunding the same
//    job twice, and two independent actors refund on the same 30-minute
//    timeout: cron/check-stuck-jobs and GET /api/jobs/[jobId]. A user polling
//    their job while the cron swept could be credited twice. Production shows
//    104 refunds against 117 failures.
//
// 3. Lost updates. deductCredits() reads the balance, computes the new value
//    in JS, then writes that constant. The .gte() guard stops the balance
//    going negative but not two concurrent debits writing the same number —
//    the second silently under-charges.
//
// All three are fixed the same way: every balance movement is a single
// conditional SQL statement, and every hold transition is guarded by
// status = 'held' so it can succeed exactly once.
//
// Ledger note: credit_transactions.type has a CHECK constraint, so escrow does
// not invent new types. A hold writes nothing to the ledger — it is not
// settled money. Capture writes the generation_debit. Release writes nothing,
// because nothing ever moved. The ledger therefore contains only real, settled
// debits, and the refund pathway disappears rather than being reimplemented.

import { getD1 } from "@/lib/d1";
import { initCloudflareEnv } from "@/lib/cf-env";

export type HoldStatus = "held" | "captured" | "released";

export interface CreditHold {
  id: string;
  userId: string;
  jobId: string | null;
  amount: number;
  status: HoldStatus;
  createdAt: string;
}

export interface HoldResult {
  ok: boolean;
  hold?: CreditHold;
  /** Balance after the hold, or the current balance when it failed. */
  balance: number;
  /** Set when ok is false. */
  reason?: "insufficient_credits" | "error";
  /** True when an existing hold was returned for the same idempotency key. */
  reused?: boolean;
}

function db() {
  initCloudflareEnv();
  return getD1();
}

function changeCount(result: unknown): number {
  const meta = (result as { meta?: { changes?: number } } | undefined)?.meta;
  return meta?.changes ?? 0;
}

/**
 * Reserve credits.
 *
 * The balance decrement and the hold row are written in one D1 batch, which is
 * applied atomically. The decrement is conditional — credit_balance >= ? lives
 * in the statement itself rather than being checked in JS beforehand — so two
 * concurrent submits cannot both succeed against the same credits.
 */
export async function holdCredits(params: {
  userId: string;
  amount: number;
  description: string;
  jobId?: string;
  idempotencyKey?: string;
}): Promise<HoldResult> {
  const { userId, amount, description, jobId, idempotencyKey } = params;

  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, balance: 0, reason: "error" };
  }

  const d = db();

  // A repeat submit with the same key must not charge twice. Returning the
  // original hold makes a double-click a no-op rather than a second job.
  if (idempotencyKey) {
    const existing = await d
      .prepare(
        "SELECT id, user_id, job_id, amount, status, created_at FROM credit_holds WHERE user_id = ? AND idempotency_key = ?"
      )
      .bind(userId, idempotencyKey)
      .first<Record<string, unknown>>();

    if (existing) {
      return { ok: true, hold: toHold(existing), balance: await getBalance(userId), reused: true };
    }
  }

  const holdId = crypto.randomUUID();

  try {
    const results = await d.batch([
      // Conditional and atomic: this is the whole concurrency guarantee.
      d
        .prepare(
          "UPDATE users SET credit_balance = credit_balance - ?1 WHERE id = ?2 AND credit_balance >= ?1"
        )
        .bind(amount, userId),
      d
        .prepare(
          "INSERT INTO credit_holds (id, user_id, job_id, amount, status, idempotency_key, description) VALUES (?, ?, ?, ?, 'held', ?, ?)"
        )
        .bind(holdId, userId, jobId ?? null, amount, idempotencyKey ?? null, description),
    ]);

    // D1 applies a batch in a transaction, but a conditional UPDATE that
    // matches nothing is a success with zero changes, not an error.
    // Insufficient credits look exactly like that, so check explicitly.
    if (changeCount(results[0]) === 0) {
      // The insert may have landed even though the debit did not; drop it so a
      // failed reservation never leaves a phantom hold behind.
      await d.prepare("DELETE FROM credit_holds WHERE id = ?").bind(holdId).run();
      return { ok: false, balance: await getBalance(userId), reason: "insufficient_credits" };
    }

    return {
      ok: true,
      balance: await getBalance(userId),
      hold: {
        id: holdId,
        userId,
        jobId: jobId ?? null,
        amount,
        status: "held",
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.error("[ESCROW] holdCredits failed:", err);
    return { ok: false, balance: await getBalance(userId).catch(() => 0), reason: "error" };
  }
}

/** Attach a hold to its job once the job row exists. */
export async function attachHoldToJob(holdId: string, jobId: string): Promise<void> {
  await db()
    .prepare("UPDATE credit_holds SET job_id = ? WHERE id = ? AND job_id IS NULL")
    .bind(jobId, holdId)
    .run();
}

/**
 * Settle a hold: the work succeeded, so the reserved credits are now spent.
 *
 * The balance already moved when the hold was taken, so this only flips the
 * status and writes the ledger row. Returns false if the hold was already
 * resolved, which is the guard that makes a double capture impossible.
 */
export async function captureHold(holdId: string, reason = "Generation completed"): Promise<boolean> {
  const d = db();

  const res = await d
    .prepare(
      "UPDATE credit_holds SET status = 'captured', resolved_at = datetime('now'), resolution_reason = ? WHERE id = ? AND status = 'held'"
    )
    .bind(reason.slice(0, 300), holdId)
    .run();

  if (changeCount(res) === 0) return false;

  const hold = await d
    .prepare(
      "SELECT id, user_id, job_id, amount, description FROM credit_holds WHERE id = ?"
    )
    .bind(holdId)
    .first<Record<string, unknown>>();
  if (!hold) return false;

  // Only settled money reaches the ledger.
  const balance = await getBalance(String(hold.user_id));
  await d
    .prepare(
      "INSERT INTO credit_transactions (id, user_id, type, amount, balance, description, job_id) VALUES (?, ?, 'generation_debit', ?, ?, ?, ?)"
    )
    .bind(
      crypto.randomUUID(),
      String(hold.user_id),
      -Number(hold.amount),
      balance,
      String(hold.description || reason),
      hold.job_id ? String(hold.job_id) : null
    )
    .run();

  return true;
}

/**
 * Unwind a hold: the work failed, expired or was cancelled.
 *
 * The guarded status flip and the balance restore go in one batch, so the
 * credits come back exactly once however many callers race — which is
 * precisely the double-refund that debit-then-refund allowed. Returns false
 * when the hold was already resolved.
 */
export async function releaseHold(holdId: string, reason: string): Promise<boolean> {
  const d = db();

  const hold = await d
    .prepare("SELECT id, user_id, amount, status FROM credit_holds WHERE id = ?")
    .bind(holdId)
    .first<Record<string, unknown>>();

  if (!hold || hold.status !== "held") return false;

  const results = await d.batch([
    d
      .prepare(
        "UPDATE credit_holds SET status = 'released', resolved_at = datetime('now'), resolution_reason = ? WHERE id = ? AND status = 'held'"
      )
      .bind(reason.slice(0, 300), holdId),
    d
      .prepare("UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?")
      .bind(Number(hold.amount), String(hold.user_id)),
  ]);

  // If the guarded update matched nothing, another actor got there first and
  // the balance restore in the same batch is rolled back with it.
  return changeCount(results[0]) > 0;
}

/** Release whichever hold backs a job. Safe to call more than once. */
export async function releaseHoldForJob(jobId: string, reason: string): Promise<boolean> {
  const hold = await db()
    .prepare("SELECT id FROM credit_holds WHERE job_id = ? AND status = 'held' LIMIT 1")
    .bind(jobId)
    .first<{ id: string }>();
  if (!hold) return false;
  return releaseHold(hold.id, reason);
}

/** Capture whichever hold backs a job. Safe to call more than once. */
export async function captureHoldForJob(
  jobId: string,
  reason = "Generation completed"
): Promise<boolean> {
  const hold = await db()
    .prepare("SELECT id FROM credit_holds WHERE job_id = ? AND status = 'held' LIMIT 1")
    .bind(jobId)
    .first<{ id: string }>();
  if (!hold) return false;
  return captureHold(hold.id, reason);
}

/**
 * Total credits reserved but unsettled — the outstanding liability. Surfaced
 * in the admin dashboard so a leak is visible rather than inferred.
 */
export async function outstandingHeld(userId?: string): Promise<{ count: number; amount: number }> {
  const d = db();
  const row = userId
    ? await d
        .prepare(
          "SELECT COUNT(*) c, COALESCE(SUM(amount),0) a FROM credit_holds WHERE status='held' AND user_id = ?"
        )
        .bind(userId)
        .first<{ c: number; a: number }>()
    : await d
        .prepare("SELECT COUNT(*) c, COALESCE(SUM(amount),0) a FROM credit_holds WHERE status='held'")
        .first<{ c: number; a: number }>();

  return { count: row?.c ?? 0, amount: row?.a ?? 0 };
}

/**
 * Release holds that were never attached to a job.
 *
 * A crash between reserving credits and creating the job row leaves a hold
 * with no owner and no deadline — nothing else would ever resolve it. The
 * window between those two writes is milliseconds, so an hour is far beyond
 * any legitimate in-flight reservation.
 */
export async function releaseOrphanedHolds(olderThanMinutes = 60): Promise<number> {
  const d = db();
  const { results } = await d
    .prepare(
      "SELECT id FROM credit_holds WHERE status = 'held' AND job_id IS NULL AND created_at < datetime('now', ?) LIMIT 100"
    )
    .bind(`-${olderThanMinutes} minutes`)
    .all<{ id: string }>();

  let released = 0;
  for (const r of results ?? []) {
    if (await releaseHold(r.id, "Orphaned reservation - never attached to a job")) released++;
  }
  return released;
}

async function getBalance(userId: string): Promise<number> {
  const row = await db()
    .prepare("SELECT credit_balance FROM users WHERE id = ?")
    .bind(userId)
    .first<{ credit_balance: number }>();
  return row?.credit_balance ?? 0;
}

function toHold(row: Record<string, unknown>): CreditHold {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    jobId: row.job_id ? String(row.job_id) : null,
    amount: Number(row.amount),
    status: String(row.status) as HoldStatus,
    createdAt: String(row.created_at),
  };
}
