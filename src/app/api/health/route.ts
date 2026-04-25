import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

async function checkSupabase(): Promise<"ok" | "error"> {
  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from("users").select("id").limit(1);
    return error ? "error" : "ok";
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
    // Try to HEAD a known key; if bucket is reachable, the 404 still proves connectivity
    try {
      await r2.send(new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || "genesis-videos",
        Key: "health-check-probe",
      }));
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

export async function GET() {
  const [supabase, r2] = await Promise.all([
    checkSupabase(),
    checkR2(),
  ]);

  const allOk = supabase === "ok" && r2 === "ok";

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
      checks: { supabase, r2 },
    },
    { status: allOk ? 200 : 503 }
  );
}
