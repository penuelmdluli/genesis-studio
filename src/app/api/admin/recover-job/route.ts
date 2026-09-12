// ============================================
// GENESIS STUDIO — Admin: recover a job from the provider
// ============================================
// POST { jobId } — delivers a job whose provider output exists but whose row
// says failed/queued (the "charged, no video" case). If the job had been
// refunded, the charge is reinstated on delivery so the ledger is honest.
//
// Accepts the owner session or the cron secret, so it can be run from an
// operator shell without a browser.

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { recoverJob } from "@/lib/job-finalizer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  const viaSecret = !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
  if (!viaSecret) {
    const clerkId = await getAuthUserId();
    if (!clerkId || !isOwnerClerkId(clerkId)) return new NextResponse("Not found", { status: 404 });
  }

  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  try {
    const result = await recoverJob(jobId);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (err) {
    console.error("[RECOVER-JOB] error:", err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Recovery failed" }, { status: 500 });
  }
}
