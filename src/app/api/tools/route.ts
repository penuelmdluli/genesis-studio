// ============================================
// GENESIS STUDIO — Creator Tools: run
// ============================================
// GET  /api/tools          → the registry (for the page)
// POST /api/tools          → { toolId, inputs } → sync result, or a job to poll
//
// Every run: plan gate → credit debit → provider call → on failure, refund.
// Sync tools return the output URL directly. Job tools create a
// generation_jobs row with a ws: reference and the client polls
// /api/tools/[jobId], which finishes the job (persists the output to R2).

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { getTool, planAllows, publicTools, toolPrice } from "@/lib/tools-registry";
import { submitWsModel, runWsModelSync, wsJobRef } from "@/lib/wavespeed-tools";
import { toUserFacingProviderError, isOperatorActionable } from "@/lib/user-errors";
import { sendSlackAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ tools: publicTools() });
}

const URL_RE = /^https:\/\/[^\s]+$/;

export async function POST(req: NextRequest) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await getUserByClerkId(clerkId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const rate = checkRateLimit(user.id, user.plan === "free" ? "feature:free" : "feature:paid");
    if (!rate.allowed) {
      return NextResponse.json({ error: "Too many requests — please wait a minute.", resetAt: rate.resetAt }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as { toolId?: string; inputs?: Record<string, string> };
    const tool = body.toolId ? getTool(body.toolId) : undefined;
    if (!tool) return NextResponse.json({ error: "Unknown tool" }, { status: 400 });

    const inputs: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.inputs || {})) {
      if (typeof v === "string") inputs[k] = v.slice(0, 4000);
    }
    for (const spec of tool.inputs) {
      const v = inputs[spec.key];
      if (spec.required && !v) return NextResponse.json({ error: `${spec.label} is required` }, { status: 400 });
      if (v && !URL_RE.test(v)) return NextResponse.json({ error: `${spec.label} must be an uploaded file` }, { status: 400 });
    }
    for (const f of tool.fields || []) {
      if (f.required && !inputs[f.key]) return NextResponse.json({ error: `${f.label} is required` }, { status: 400 });
    }

    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount && !planAllows(user.plan, tool.minPlan)) {
      const planName = tool.minPlan.charAt(0).toUpperCase() + tool.minPlan.slice(1);
      return NextResponse.json({ error: `${tool.name} needs the ${planName} plan or higher.`, upgrade: true }, { status: 403 });
    }

    // Media length comes from the browser's metadata probe; the server clamps
    // it and bills a full minute when it is missing.
    const mediaSeconds = Number(inputs.duration_seconds) || 0;
    const credits = toolPrice(tool, mediaSeconds);

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(user.id, credits, "", `${tool.name}`);
      if (!success) {
        return NextResponse.json({ error: "Insufficient credits", required: credits, balance: newBalance }, { status: 402 });
      }
    }

    const providerInput = tool.buildInput(inputs);

    try {
      if (tool.mode === "sync") {
        const p = await runWsModelSync(tool.model, providerInput, { timeoutMs: 90_000 });
        const output = p.outputs?.[0];
        if (!output) throw new Error("no output returned");
        return NextResponse.json({ status: "completed", outputUrl: output, outputKind: tool.outputKind, creditsCost: credits });
      }

      // Job mode — a row the poller can finish later.
      const job = await createJob({
        userId: user.id,
        type: "v2v",
        modelId: "wan-2.2", // schema requires a model id; tools are identified by the prompt prefix
        prompt: `[tool:${tool.id}] ${tool.name}`,
        inputVideoUrl: inputs.video || inputs.audio || undefined,
        inputImageUrl: inputs.image || undefined,
        resolution: "720p",
        duration: Math.round(mediaSeconds) || Number(inputs.duration) || 0,
        fps: 30,
        isDraft: false,
        creditsCost: ownerAccount ? 0 : credits,
        aspectRatio: "landscape",
      });

      const p = await submitWsModel(tool.model, providerInput);
      await updateJobStatus(job.id, {
        runpodJobId: wsJobRef(p.id),
        status: "processing",
        provider: "wavespeed",
        startedAt: new Date().toISOString(),
      });

      return NextResponse.json({ status: "processing", jobId: job.id, estimatedTime: tool.estimatedSeconds, creditsCost: credits });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      console.error(`[TOOLS] ${tool.id} failed:`, raw);
      if (!ownerAccount) await refundCredits(user.id, credits, "", `${tool.name} failed — automatic refund`);
      sendSlackAlert({
        level: isOperatorActionable(raw) ? "critical" : "warning",
        title: `Tool failed: ${tool.name}`,
        message: `User: ${user.email}\nError: ${raw}`,
      }).catch(() => {});
      return NextResponse.json({ error: toUserFacingProviderError(raw) }, { status: 503 });
    }
  } catch (error) {
    console.error("[TOOLS] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
