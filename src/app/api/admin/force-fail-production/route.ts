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

export async function POST(req: NextRequest) {
  if (!validateSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { productionIds?: string[]; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ids = Array.isArray(body.productionIds) ? body.productionIds : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "productionIds array is required" },
      { status: 400 },
    );
  }
  if (ids.length > 50) {
    return NextResponse.json(
      { error: "Max 50 productions per call" },
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
