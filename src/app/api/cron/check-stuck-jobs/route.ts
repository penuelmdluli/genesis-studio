/**
 * CHECK-STUCK-JOBS CRON — fail generation jobs stuck for 30+ minutes
 *
 * GET /api/cron/check-stuck-jobs
 * Auth: Bearer CRON_SECRET
 * Schedule: every 5 minutes
 *
 * The dashboard client-side poller has a 30-min timeout, but it only
 * runs while the browser tab is open. This server-side cron catches
 * jobs that are stuck when the user closes the browser.
 *
 * Also polls WaveSpeed/FAL for stuck jobs that might have completed
 * but weren't picked up by the client poller.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { refundCredits } from "@/lib/credits";
import { pollHostedJob, finalizeHostedJob, failHostedJob, isToolJob, HOSTED_HARD_CAP_MS, type HostedJobRow } from "@/lib/job-finalizer";

export const maxDuration = 60;

const STUCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Wan2.2-Animate on our own RunPod GPU is a long render — preprocessing plus a
// 14B diffusion pass runs well past 30 minutes on a cold worker, and the
// endpoint's own execution timeout is 60 minutes. Killing those at the hosted-
// provider threshold would refund the user while the GPU is still working.
const RUNPOD_MOTION_TIMEOUT_MS = 90 * 60 * 1000; // 90 minutes

function stuckTimeoutFor(providerJobId: string | null): number {
  // Motion jobs are stored as "fal:<endpoint>:<requestId>"; a RunPod-backed one
  // carries the "rp:" endpoint prefix.
  return providerJobId?.startsWith("fal:rp:") ? RUNPOD_MOTION_TIMEOUT_MS : STUCK_TIMEOUT_MS;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const cutoff = new Date(Date.now() - STUCK_TIMEOUT_MS).toISOString();

  // Find jobs stuck in queued/processing for 30+ minutes
  const { data: stuckJobs } = await db
    .from("generation_jobs")
    .select("id, status, model_id, runpod_job_id, user_id, credits_cost, prompt, created_at, resolution, duration, fps, aspect_ratio, audio_url, audio_track_id")
    .in("status", ["queued", "processing"])
    .lt("created_at", cutoff)
    .limit(20);

  const summary = { checked: 0, completed: 0, failed: 0, timedOut: 0 };

  for (const job of stuckJobs || []) {
    const jobId = job.runpod_job_id as string | null;

    // Long-running providers get a longer leash than the 30-minute query cutoff.
    const age = Date.now() - new Date(job.created_at as string).getTime();
    if (age < stuckTimeoutFor(jobId)) continue;

    summary.checked++;
    if (!jobId) {
      // No provider job ID — can't poll, just timeout
      await db.from("generation_jobs").update({
        status: "failed",
        error_message: "Job had no provider ID. Credits refunded.",
        completed_at: new Date().toISOString(),
      }).eq("id", job.id);
      await refundCredits(job.user_id, job.credits_cost, job.id, "Stuck job — no provider ID");
      summary.timedOut++;
      continue;
    }

    // Ask the provider before giving up. Done → deliver. Still rendering and
    // under the hard cap → leave it for the reaper's extension logic.
    if ((jobId.startsWith("ws:") || jobId.startsWith("fal:")) && !isToolJob(job as HostedJobRow)) {
      const poll = await pollHostedJob(job as HostedJobRow);
      if (poll.state === "completed") {
        try {
          await finalizeHostedJob(job as HostedJobRow, poll, { source: "stuck-sweep" });
          summary.completed++;
          continue;
        } catch (err) {
          console.error(`[STUCK-JOBS] Finalize failed for ${job.id}:`, err);
        }
      } else if (poll.state === "pending" && age < HOSTED_HARD_CAP_MS) {
        continue;
      }
    }

    // Still not done after 30 min — fail it
    await failHostedJob(job as HostedJobRow, "Generation timed out. Credits have been refunded.", "timeout");
    summary.timedOut++;

    // Notify via Discord/Slack
    try {
      const { sendSlackAlert } = await import("@/lib/alerts");
      await sendSlackAlert({
        level: "warning",
        title: "Stuck job timed out",
        message: `Job ${job.id.slice(0, 8)} stuck for 30+ min\nModel: ${job.model_id}\nPrompt: ${(job.prompt || "").slice(0, 60)}\nCredits refunded: ${job.credits_cost}`,
      });
    } catch {}
  }

  console.log(`[STUCK-JOBS] Checked ${summary.checked}: ${summary.completed} completed, ${summary.timedOut} timed out`);

  return NextResponse.json({ summary });
}
