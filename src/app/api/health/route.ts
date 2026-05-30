import { NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { verifyR2Upload } from "@/lib/storage";

const TIMEOUT_MS = 2000;

function withTimeout<T>(promise: PromiseLike<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

async function checkD1(): Promise<"ok" | "error"> {
  try {
    const db = getDb();
    const result = await withTimeout(
      db.from("users").select("id").limit(1) as any
    );
    return (result as any).error ? "error" : "ok";
  } catch {
    return "error";
  }
}

async function checkR2(): Promise<"ok" | "error"> {
  try {
    await withTimeout(verifyR2Upload("health-check-probe", 0) as any);
    return "ok";
  } catch (err: unknown) {
    const msg = (err as Error)?.message || "";
    // "not found" means R2 is reachable, file just doesn't exist
    if (msg.includes("not found")) return "ok";
    return "error";
  }
}

async function checkFal(): Promise<"ok" | "error"> {
  try {
    if (!process.env.FAL_KEY) return "error";
    const res = await withTimeout(
      fetch("https://queue.fal.run/fal-ai/fast-sdxl", {
        method: "OPTIONS",
      })
    );
    return res.status < 500 ? "ok" : "error";
  } catch {
    return "error";
  }
}

async function checkRunpod(): Promise<"ok" | "error"> {
  try {
    if (!process.env.RUNPOD_API_KEY) return "error";
    const res = await withTimeout(
      fetch("https://api.runpod.ai/v2/", {
        headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` },
      })
    );
    return res.status < 500 ? "ok" : "error";
  } catch {
    return "error";
  }
}

export async function GET() {
  const [d1, r2, fal, runpod] = await Promise.all([
    checkD1(),
    checkR2(),
    checkFal(),
    checkRunpod(),
  ]);

  const allOk = d1 === "ok" && r2 === "ok";

  return NextResponse.json(
    {
      status: allOk ? (fal === "ok" && runpod === "ok" ? "ok" : "degraded") : "down",
      timestamp: new Date().toISOString(),
      version: process.env.GIT_COMMIT_SHA?.slice(0, 7) || "dev",
      runtime: "cloudflare-workers",
      deps: { d1, r2, fal, runpod },
    },
    { status: allOk ? 200 : 503 }
  );
}
