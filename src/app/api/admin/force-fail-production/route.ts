/**
 * POST /api/admin/force-fail-production
 *
 * Force-fails one or more wedged productions and refunds credits atomically.
 * Authed via CRON_SECRET (so it can be called from scripts).
 *
 * Body: { productionIds: string[], reason?: string }
 *
 * For each production:
 *   1. Skip if already failed/completed (idempotent — no double-refund)
 *   2. Mark status='failed'
 *   3. Refund totalCredits via credits.refundCredits() if > 0
 *   4. Check credit_transactions for an existing 'generation_refund' row
 *      scoped to this productionId to avoid double-refund on retries
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { refundCredits } from "@/lib/credits";

export const maxDuration = 60;

interface ForceFailResult {
  productionId: string;
  previousStatus: string | null;
  refundedCredits: number;
  alreadyRefunded: boolean;
  ok: boolean;
  error?: string;
}

function validateSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

/**
 * GET /api/admin/force-fail-production
 *
 * Lists wedged productions that are candidates for force-fail:
 *  - status='assembling' with null/undefined assembly_state
 *  - status='assembling' with assembly_state missing a .phase
 *  - status='assembling' older than `staleMinutes` (default 20)
 *
 * Query: ?staleMinutes=20
 */
export async function GET(req: NextRequest) {
  if (!validateSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staleMinutes = Number(
    new URL(req.url).searchParams.get("staleMinutes") || "20",
  );
  const supabase = createSupabaseAdmin();

  const { data: assembling, error } = await supabase
    .from("productions")
    .select("id, user_id, total_credits, status, progress, started_at, assembly_state")
    .eq("status", "assembling")
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const staleCutoff = Date.now() - staleMinutes * 60 * 1000;

  const wedged = (assembling || [])
    .map((p) => {
      const state = p.assembly_state as Record<string, unknown> | null;
      const phase = (state?.phase as string | undefined) || null;
      const updatedMs = p.started_at ? new Date(p.started_at).getTime() : 0;
      const ageMinutes = Math.round((Date.now() - updatedMs) / 60000);
      const reasons: string[] = [];
      if (!state) reasons.push("no assembly_state");
      if (state && !phase) reasons.push("assembly_state has no phase");
      if (updatedMs > 0 && updatedMs < staleCutoff) reasons.push(`stale ${ageMinutes}m`);
      return {
        id: p.id as string,
        userId: p.user_id as string | null,
        totalCredits: Number(p.total_credits || 0),
        progress: p.progress,
        phase,
        ageMinutes,
        wedged: reasons.length > 0,
        reasons,
      };
    })
    .filter((p) => p.wedged);

  return NextResponse.json({
    staleMinutes,
    totalAssembling: (assembling || []).length,
    wedgedCount: wedged.length,
    wedged,
  });
}

export async function POST(req: NextRequest) {
  if (!validateSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { productionIds?: string[]; reason?: string; mode?: string; staleMinutes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let ids: string[] = Array.isArray(body.productionIds) ? body.productionIds : [];

  // mode: "all_wedged" — auto-select all wedged assembling productions
  if (body.mode === "all_wedged") {
    const supabaseDisc = createSupabaseAdmin();
    const staleMinutes = Number(body.staleMinutes || 20);
    const staleCutoff = Date.now() - staleMinutes * 60 * 1000;
    const { data } = await supabaseDisc
      .from("productions")
      .select("id, assembly_state, started_at")
      .eq("status", "assembling")
      .limit(200);
    const auto = (data || [])
      .filter((p) => {
        const state = p.assembly_state as Record<string, unknown> | null;
        const phase = state?.phase as string | undefined;
        const updatedMs = p.started_at ? new Date(p.started_at).getTime() : 0;
        return !state || !phase || (updatedMs > 0 && updatedMs < staleCutoff);
      })
      .map((p) => p.id as string);
    ids = [...new Set([...ids, ...auto])];
  }

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "productionIds array (or mode=all_wedged) is required" },
      { status: 400 },
    );
  }
  if (ids.length > 200) {
    return NextResponse.json(
      { error: "Max 200 productions per call" },
      { status: 400 },
    );
  }

  const reason = body.reason || "Manually force-failed by admin";
  const supabase = createSupabaseAdmin();
  const results: ForceFailResult[] = [];

  for (const productionId of ids) {
    const result: ForceFailResult = {
      productionId,
      previousStatus: null,
      refundedCredits: 0,
      alreadyRefunded: false,
      ok: false,
    };

    try {
      const { data: prod, error: prodErr } = await supabase
        .from("productions")
        .select("id, user_id, total_credits, status")
        .eq("id", productionId)
        .maybeSingle();

      if (prodErr) {
        result.error = `lookup failed: ${prodErr.message}`;
        results.push(result);
        continue;
      }

      if (!prod) {
        result.error = "production not found";
        results.push(result);
        continue;
      }

      result.previousStatus = prod.status as string;

      // Idempotent: don't touch finished productions
      if (prod.status === "completed" || prod.status === "failed") {
        result.ok = true;
        result.error = `already ${prod.status}`;
        results.push(result);
        continue;
      }

      // Check for existing refund transaction to prevent double-refund
      const { data: existingRefund } = await supabase
        .from("credit_transactions")
        .select("id")
        .eq("job_id", productionId)
        .eq("type", "generation_refund")
        .maybeSingle();

      // Mark failed first
      const { error: updErr } = await supabase
        .from("productions")
        .update({
          status: "failed",
          error_message: `[force-fail] ${reason}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", productionId);

      if (updErr) {
        result.error = `update failed: ${updErr.message}`;
        results.push(result);
        continue;
      }

      // Refund if we have credits and no prior refund
      const credits = Number(prod.total_credits || 0);
      if (credits > 0 && prod.user_id && !existingRefund) {
        await refundCredits(
          prod.user_id as string,
          credits,
          productionId,
          `Force-fail refund: ${reason.slice(0, 120)}`,
        );
        result.refundedCredits = credits;
      } else if (existingRefund) {
        result.alreadyRefunded = true;
      }

      result.ok = true;
    } catch (err) {
      result.error = err instanceof Error ? err.message : "unknown error";
    }

    results.push(result);
  }

  const totalRefunded = results.reduce((s, r) => s + r.refundedCredits, 0);

  return NextResponse.json({
    success: true,
    count: results.length,
    totalCreditsRefunded: totalRefunded,
    results,
  });
}
