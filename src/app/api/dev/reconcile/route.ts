/**
 * Dev Reconcile API — Detect and recover stuck productions.
 *
 * POST /api/dev/reconcile
 * Body: { dryRun?: boolean }  — when true, only report, do not modify state
 * Auth: CRON_SECRET
 *
 * Failure modes this catches:
 *  1. Production status = 'generating' but ZERO rows in production_scenes
 *     (executeProduction crashed before inserting scenes — silent leak)
 *  2. Production status = 'generating' but no scene progress in > 30 min
 *     (RunPod webhook never came back)
 *  3. Production status = 'assembling' but stale (> 30 min since last update)
 *     (assembly phase hung — ffmpeg worker crashed)
 *  4. Queue items stuck at 'generating' but linked to a failed/missing production
 *
 * Recovery:
 *  - Mark the production as failed with an error_message tagged "reconciler".
 *  - Reset the queue item back to 'pending' (so the next produce cycle retries)
 *    or mark 'failed' if it has already been retried twice.
 *  - Report everything it did so the scheduler can log it.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const maxDuration = 120;

const STALE_MINUTES = 30;
const MAX_RETRIES = 2;

interface ReconcileAction {
  queueId: string;
  productionId?: string;
  page_id: string;
  reason: string;
  resolution: "reset_to_pending" | "marked_failed" | "dry_run";
}

function validateCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);

    const supabase = createSupabaseAdmin();
    const staleCutoff = new Date(
      Date.now() - STALE_MINUTES * 60 * 1000,
    ).toISOString();

    const actions: ReconcileAction[] = [];

    // 1. Find queue items in 'generating' state older than the stale cutoff
    const { data: stuckItems, error: qErr } = await supabase
      .from("dev_content_queue")
      .select("id, page_id, input_data, created_at, status")
      .eq("status", "generating")
      .lt("created_at", staleCutoff)
      .order("created_at", { ascending: true })
      .limit(50);

    if (qErr) {
      return NextResponse.json(
        { error: `Failed to load queue: ${qErr.message}` },
        { status: 500 },
      );
    }

    for (const item of stuckItems || []) {
      const input = (item.input_data as Record<string, unknown>) || {};
      const productionId = input.production_id as string | undefined;
      const retryCount = Number(input.reconciler_retries || 0);

      let reason = "";
      let shouldReset = false;

      if (!productionId) {
        // Case 1: never got linked — produce crashed before createProduction
        reason = "no production_id linked (produce crashed)";
        shouldReset = true;
      } else {
        // Look up production + scene counts
        const { data: production } = await supabase
          .from("productions")
          .select("id, status, updated_at")
          .eq("id", productionId)
          .maybeSingle();

        if (!production) {
          reason = `linked production ${productionId} missing`;
          shouldReset = true;
        } else {
          const { count: sceneCount } = await supabase
            .from("production_scenes")
            .select("id", { count: "exact", head: true })
            .eq("production_id", productionId);

          const anyProgress = (sceneCount || 0) > 0;

          if (!anyProgress) {
            // Case 2: zero scenes created — webhook never hit
            reason = `production has 0 scenes after ${STALE_MINUTES}m`;
            shouldReset = true;
          } else {
            // Case 3: has scenes but production itself is stale
            const { data: freshestScene } = await supabase
              .from("production_scenes")
              .select("updated_at, status")
              .eq("production_id", productionId)
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            const lastSceneUpdate = freshestScene?.updated_at
              ? new Date(freshestScene.updated_at).getTime()
              : 0;
            const ageMs = Date.now() - lastSceneUpdate;
            if (ageMs > STALE_MINUTES * 60 * 1000) {
              reason = `no scene progress in ${Math.round(ageMs / 60000)}m`;
              shouldReset = true;
            }
          }

          // If we decided to give up, also mark the production as failed
          if (shouldReset && !dryRun) {
            await supabase
              .from("productions")
              .update({
                status: "failed",
                error_message: `[reconciler] ${reason}`,
              })
              .eq("id", productionId);
          }
        }
      }

      if (!shouldReset) continue;

      let resolution: ReconcileAction["resolution"];
      if (dryRun) {
        resolution = "dry_run";
      } else if (retryCount >= MAX_RETRIES) {
        // Give up after N retries
        await supabase
          .from("dev_content_queue")
          .update({
            status: "failed",
            error_message: `[reconciler] ${reason} (retries exhausted)`,
          })
          .eq("id", item.id);
        resolution = "marked_failed";
      } else {
        // Reset to pending and increment retry_count (tracked inside input_data
        // because dev_content_queue schema does not guarantee a retry_count col)
        const mergedInput = {
          ...input,
          production_id: undefined,
          reconciler_retries: retryCount + 1,
          last_reconcile_at: new Date().toISOString(),
          last_reconcile_reason: reason,
        };
        await supabase
          .from("dev_content_queue")
          .update({
            status: "pending",
            input_data: mergedInput,
          })
          .eq("id", item.id);
        resolution = "reset_to_pending";
      }

      actions.push({
        queueId: item.id,
        productionId,
        page_id: item.page_id,
        reason,
        resolution,
      });
    }

    // 2. Find orphan productions in 'assembling' for > STALE_MINUTES with no recent update
    const { data: assemblingProductions } = await supabase
      .from("productions")
      .select("id, status, updated_at")
      .eq("status", "assembling")
      .lt("updated_at", staleCutoff)
      .limit(50);

    const orphanAssemblyIds: string[] = [];
    for (const prod of assemblingProductions || []) {
      orphanAssemblyIds.push(prod.id as string);
      if (!dryRun) {
        await supabase
          .from("productions")
          .update({
            status: "failed",
            error_message: `[reconciler] assembly stalled > ${STALE_MINUTES}m`,
          })
          .eq("id", prod.id);
      }
    }

    // Also flip any queue items that pointed to those productions back to pending
    if (orphanAssemblyIds.length > 0) {
      const { data: linkedQueueItems } = await supabase
        .from("dev_content_queue")
        .select("id, page_id, input_data")
        .eq("status", "generating");

      for (const q of linkedQueueItems || []) {
        const input = (q.input_data as Record<string, unknown>) || {};
        const pid = input.production_id as string | undefined;
        if (!pid || !orphanAssemblyIds.includes(pid)) continue;

        if (!dryRun) {
          await supabase
            .from("dev_content_queue")
            .update({
              status: "pending",
              input_data: { ...input, production_id: undefined },
            })
            .eq("id", q.id);
        }
        actions.push({
          queueId: q.id,
          productionId: pid,
          page_id: q.page_id,
          reason: `assembly stalled > ${STALE_MINUTES}m`,
          resolution: dryRun ? "dry_run" : "reset_to_pending",
        });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      stuck_items_checked: (stuckItems || []).length,
      orphan_assemblies: orphanAssemblyIds.length,
      actions_taken: actions.length,
      actions,
    });
  } catch (err) {
    console.error("[RECONCILE] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
