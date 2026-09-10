import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { getDb } from "@/lib/db-driver";
import { envString } from "@/lib/env";
import { checkCoreConfig } from "@/lib/config";

// Live provider reachability — the check that would have caught every one of
// the 55 RunPod 404s and 12 "Forbidden" failures on day one.
//
// Distinct from /api/admin/provider-health, which reports the in-memory
// circuit-breaker state and business projections. This one makes real calls:
// it asks each provider whether it would accept work right now.
//
// Auth: owner session, or the cron secret so an external monitor can poll it.
// Balances are revenue-sensitive, so this is not public.

export const dynamic = "force-dynamic";

interface ProviderStatus {
  name: string;
  ok: boolean;
  detail: string;
  balanceUsd?: number;
}

/** WaveSpeed publishes a balance endpoint, so this is exact and free. */
async function checkWavespeed(): Promise<ProviderStatus> {
  const key = envString("WAVESPEED_API_KEY");
  if (!key) return { name: "wavespeed", ok: false, detail: "WAVESPEED_API_KEY not set" };

  try {
    const res = await fetch("https://api.wavespeed.ai/api/v3/balance", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return { name: "wavespeed", ok: false, detail: `balance check HTTP ${res.status}` };

    const json = (await res.json()) as { data?: { balance?: number } };
    const balance = json.data?.balance ?? 0;
    return {
      name: "wavespeed",
      ok: balance > 0,
      balanceUsd: balance,
      detail: balance > 0 ? `funded ($${balance.toFixed(2)})` : "balance exhausted",
    };
  } catch (err) {
    return { name: "wavespeed", ok: false, detail: `unreachable: ${String(err).slice(0, 120)}` };
  }
}

/**
 * FAL exposes no balance endpoint. An empty body is rejected at validation
 * (422) before any billable work, so a 403/401 there is unambiguously an
 * account problem rather than a bad request. This probe costs nothing.
 */
async function checkFal(): Promise<ProviderStatus> {
  const key = process.env.FAL_KEY;
  if (!key) return { name: "fal", ok: false, detail: "FAL_KEY not set" };

  try {
    const res = await fetch(
      "https://queue.fal.run/fal-ai/kling-video/v3/standard/image-to-video",
      {
        method: "POST",
        headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: "{}",
      }
    );
    if (res.status === 403 || res.status === 401) {
      return { name: "fal", ok: false, detail: `account locked or out of balance (HTTP ${res.status})` };
    }
    return { name: "fal", ok: true, detail: `accepting work (HTTP ${res.status} on empty body, as expected)` };
  } catch (err) {
    return { name: "fal", ok: false, detail: `unreachable: ${String(err).slice(0, 120)}` };
  }
}

const RUNPOD_VARS = [
  "RUNPOD_ENDPOINT_WAN22",
  "RUNPOD_ENDPOINT_WAN22_I2V",
  "RUNPOD_ENDPOINT_MOCHI",
  "RUNPOD_ENDPOINT_HUNYUAN",
  "RUNPOD_ENDPOINT_LTX",
  "RUNPOD_ENDPOINT_WAN21_TURBO",
  "RUNPOD_ENDPOINT_MIMIC_MOTION",
  "RUNPOD_ENDPOINT_WAN_ANIMATE",
  "RUNPOD_ENDPOINT_CAPTIONS",
  "RUNPOD_COMFYUI_ENDPOINT_ID",
];

/**
 * Every configured RunPod endpoint, individually. A 404 here means the
 * endpoint was deleted — which is exactly the state that produced 54 of the 55
 * RunPod 404 failures in production, silently, for months.
 */
async function checkRunpod(): Promise<{ status: ProviderStatus; endpoints: Record<string, string> }> {
  const key = envString("RUNPOD_API_KEY");
  const endpoints: Record<string, string> = {};

  if (!key) {
    return { status: { name: "runpod", ok: false, detail: "RUNPOD_API_KEY not set" }, endpoints };
  }

  const configured = RUNPOD_VARS.filter((v) => !!envString(v));
  for (const v of configured) {
    const id = envString(v)!;
    if (!/^[a-z0-9]{10,20}$/.test(id)) {
      endpoints[v] = "invalid: not an endpoint id";
      continue;
    }
    try {
      const res = await fetch(`https://api.runpod.ai/v2/${id}/health`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      endpoints[v] = res.ok ? `alive (${id})` : `HTTP ${res.status} - endpoint gone (${id})`;
    } catch {
      endpoints[v] = `unreachable (${id})`;
    }
  }

  const alive = Object.values(endpoints).filter((s) => s.startsWith("alive")).length;
  // Reported as never ok on purpose. Endpoint reachability is not capability:
  // every endpoint on the account is scaled to workersMax=0, so even an id
  // that answers /health cannot execute a job. Reporting "ok" on reachability
  // alone is exactly the false green that let this rot unnoticed for months.
  // Flip this to `alive > 0` once workers are provisioned.
  return {
    status: {
      name: "runpod",
      ok: false,
      detail: `${alive}/${configured.length} endpoints reachable, but all workers are scaled to zero - cannot execute jobs`,
    },
    endpoints,
  };
}

/**
 * Is the payment webhook pointing at us?
 *
 * This is the check that would have caught a live revenue bug: the Yoco
 * webhook was registered against https://genesisstudio.app, a suspended Vercel
 * deployment returning HTTP 402, while the product had long since moved to
 * ivideostudio.ai. Checkout worked, the customer was charged, and the credits
 * were never granted — the worst possible failure, because it takes money and
 * gives nothing back.
 *
 * Nothing in the app could notice: the code was correct, the key was valid,
 * and the only broken part lived in a third-party dashboard. So it is checked
 * from here, against the host we are actually served from.
 */
async function checkPaymentWebhook(selfHost: string): Promise<ProviderStatus> {
  const key = envString("YOCO_SECRET_KEY");
  if (!key) return { name: "payments", ok: false, detail: "YOCO_SECRET_KEY not set" };

  if (!envString("YOCO_WEBHOOK_SECRET")) {
    return {
      name: "payments",
      ok: false,
      detail: "YOCO_WEBHOOK_SECRET not set - webhooks will fail signature checks",
    };
  }

  try {
    const res = await fetch("https://payments.yoco.com/api/webhooks", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      return { name: "payments", ok: false, detail: `Yoco webhook list failed (HTTP ${res.status})` };
    }

    const json = (await res.json()) as {
      subscriptions?: Array<{ url?: string; mode?: string; name?: string }>;
    };

    // Only our own host counts. The account legitimately carries webhooks for
    // other products, so a subscription existing is not the same as ours being
    // correct.
    const ours = (json.subscriptions ?? []).filter((sub) =>
      (sub.url ?? "").includes(selfHost)
    );

    if (ours.length === 0) {
      const others = (json.subscriptions ?? [])
        .map((sub) => sub.url ?? "")
        .filter((u) => u.includes("/api/webhooks/yoco"))
        .join(", ");
      return {
        name: "payments",
        ok: false,
        detail: others
          ? `No webhook points at ${selfHost}. Found instead: ${others} - customers would be charged and receive nothing`
          : `No Yoco webhook registered for ${selfHost} - customers would be charged and receive nothing`,
      };
    }

    const live = ours.some((sub) => sub.mode === "live");
    return {
      name: "payments",
      ok: live,
      detail: live
        ? `webhook registered for ${selfHost} (live)`
        : `webhook for ${selfHost} exists but is in test mode - live payments will not be credited`,
    };
  } catch (err) {
    return { name: "payments", ok: false, detail: `unreachable: ${String(err).slice(0, 120)}` };
  }
}

export async function GET(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");

  let authorised = !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
  if (!authorised) {
    const clerkId = await getAuthUserId();
    authorised = !!clerkId && isOwnerClerkId(clerkId);
  }
  if (!authorised) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const selfHost = req.headers.get("host") || "ivideostudio.ai";

  const [wavespeed, fal, runpod, payments] = await Promise.all([
    checkWavespeed(),
    checkFal(),
    checkRunpod(),
    checkPaymentWebhook(selfHost),
  ]);

  // Last successful generation — the metric that says whether the product is
  // actually working, as opposed to merely configured.
  let lastSuccessAt: string | null = null;
  try {
    const { data } = await getDb()
      .from("generation_jobs")
      .select("completed_at")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastSuccessAt = (data as { completed_at?: string } | null)?.completed_at ?? null;
  } catch {
    // A health endpoint must not fail because one of its readings failed.
  }

  const providers = [wavespeed, fal, runpod.status, payments];
  const configProblems = checkCoreConfig();

  // Generation needs at least one hosted provider. RunPod is not counted:
  // every endpoint on the account is scaled to workersMax=0, so a live
  // endpoint id still cannot execute a job.
  const canGenerate = wavespeed.ok || fal.ok;

  return NextResponse.json(
    {
      ok: canGenerate && payments.ok && configProblems.length === 0,
      canGenerate,
      canTakePayment: payments.ok,
      providers,
      runpodEndpoints: runpod.endpoints,
      configProblems,
      lastSuccessfulGenerationAt: lastSuccessAt,
      checkedAt: new Date().toISOString(),
    },
    { status: canGenerate ? 200 : 503 }
  );
}
