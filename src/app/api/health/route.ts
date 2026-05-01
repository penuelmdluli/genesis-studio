import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

const TIMEOUT_MS = 2000;

function withTimeout<T>(promise: PromiseLike<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

async function checkSupabase(): Promise<"ok" | "error"> {
  try {
    const supabase = createSupabaseAdmin();
    const result = await withTimeout(
      supabase.from("users").select("id").limit(1)
    );
    return result.error ? "error" : "ok";
  } catch {
    return "error";
  }
}

async function checkR2(): Promise<"ok" | "error"> {
  try {
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) return "error";
    const r2 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    });
    try {
      await withTimeout(
        r2.send(new HeadObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME || "genesis-videos",
          Key: "health-check-probe",
        }))
      );
    } catch (err: unknown) {
      const code = (err as { name?: string }).name;
      if (code === "NotFound" || code === "NoSuchKey") return "ok";
      throw err;
    }
    return "ok";
  } catch {
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
    // Any response (even 404) proves connectivity
    return res.status < 500 ? "ok" : "error";
  } catch {
    return "error";
  }
}

export async function GET() {
  const [supabase, r2, fal, runpod] = await Promise.all([
    checkSupabase(),
    checkR2(),
    checkFal(),
    checkRunpod(),
  ]);

  const allOk = supabase === "ok" && r2 === "ok";

  return NextResponse.json(
    {
      status: allOk ? (fal === "ok" && runpod === "ok" ? "ok" : "degraded") : "down",
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
      deps: { supabase, r2, fal, runpod },
    },
    { status: allOk ? 200 : 503 }
  );
}
