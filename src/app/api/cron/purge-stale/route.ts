/**
 * PURGE-STALE CRON — auto-clean queue/production inconsistencies
 *
 * GET /api/cron/purge-stale
 * Auth: Bearer CRON_SECRET
 * Schedule: every 6 hours
 *
 * Two cleanups:
 * 1. Queue items stuck in status=ready whose underlying production is
 *    failed/cancelled → demote to failed. Jams handlePost if left.
 * 2. Productions stuck in status=assembling for >2h → mark failed.
 *    Happens when startAssembly crashes silently; pollAssembly can't
 *    resume and they sit forever.
 *
 * Replaces manual `node scripts/purge-stale-ready.mjs` runs.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";

export const maxDuration = 60;

const STUCK_ASSEMBLING_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getDb();
  const summary = {
    stale_ready_demoted: 0,
    stuck_assembling_failed: 0,
  };

  // ── 1. Stale ready queue items ──
  // Pull all queue items in status=ready and check their underlying production.
  const { data: readyRows } = await supabase
    .from("dev_content_queue")
    .select("id, input_data")
    .eq("status", "ready");

  const pidToRowIds = new Map<string, string[]>();
  for (const r of readyRows || []) {
    const pid = (r.input_data as Record<string, unknown> | null)?.production_id as
      | string
      | undefined;
    if (!pid) continue;
    if (!pidToRowIds.has(pid)) pidToRowIds.set(pid, []);
    pidToRowIds.get(pid)!.push(r.id);
  }

  if (pidToRowIds.size > 0) {
    const pids = Array.from(pidToRowIds.keys());
    // Batch in 100s to avoid URL-length limits
    const BATCH = 100;
    const toDemote: string[] = [];
    for (let i = 0; i < pids.length; i += BATCH) {
      const batch = pids.slice(i, i + BATCH);
      const { data: prodRows } = await supabase
        .from("productions")
        .select("id, status")
        .in("id", batch);
      for (const p of (prodRows || []) as Array<{ id: string; status: string }>) {
        if (p.status === "failed" || p.status === "cancelled") {
          for (const rowId of pidToRowIds.get(p.id) || []) toDemote.push(rowId);
        }
      }
    }
    if (toDemote.length > 0) {
      const IBATCH = 80;
      for (let i = 0; i < toDemote.length; i += IBATCH) {
        const batch = toDemote.slice(i, i + IBATCH);
        await supabase
          .from("dev_content_queue")
          .update({
            status: "failed",
            error_message: "Stale ready item auto-purged (production failed/cancelled)",
          })
          .in("id", batch);
      }
      summary.stale_ready_demoted = toDemote.length;
      console.log(`[PURGE-STALE] Demoted ${toDemote.length} stale ready items`);
    }
  }

  // ── 2. Stuck assembling productions ──
  const cutoff = new Date(Date.now() - STUCK_ASSEMBLING_MS).toISOString();
  const { data: stuck } = await supabase
    .from("productions")
    .select("id, concept, started_at")
    .eq("status", "assembling")
    .lt("started_at", cutoff);

  if (stuck && stuck.length > 0) {
    const ids = stuck.map((s: any) => s.id);
    await supabase
      .from("productions")
      .update({
        status: "failed",
        error_message: "Assembly stalled >2h — auto-cleanup by purge-stale cron",
        completed_at: new Date().toISOString(),
      })
      .in("id", ids);
    summary.stuck_assembling_failed = stuck.length;
    console.log(`[PURGE-STALE] Failed ${stuck.length} stuck assembling productions`);
  }

  return NextResponse.json({ success: true, ...summary });
}
