import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("DB URL:", process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40));

  // 1. Stuck motion control jobs (standard jobs table)
  const { data: stuck, error: e1 } = await db
    .from("jobs")
    .select("id, status, model_id, runpod_job_id, prompt, created_at, error_message, credits_cost, user_id")
    .eq("model_id", "mimic-motion")
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("\n=== STUCK MOTION CONTROL JOBS (jobs table) ===");
  if (e1) console.error("Error:", e1.message);
  console.log("Count:", stuck?.length || 0);
  for (const j of stuck || []) {
    const age = Math.round((Date.now() - new Date(j.created_at).getTime()) / 60000);
    const prov = j.runpod_job_id?.startsWith("ws:") ? "WaveSpeed" :
                 j.runpod_job_id?.startsWith("fal:") ? "FAL-Motion" : "FAL-Video";
    console.log(`\n  [${j.status}] ${j.id}`);
    console.log(`    Provider: ${prov} | Age: ${age} min`);
    console.log(`    Prompt: ${(j.prompt || "").slice(0, 60)}`);
    console.log(`    Job ID: ${(j.runpod_job_id || "none").slice(0, 100)}`);
    console.log(`    Credits: ${j.credits_cost}`);
  }

  // 2. Stuck mimic jobs (old mimic_jobs table)
  const { data: mimicStuck, error: e2 } = await db
    .from("mimic_jobs")
    .select("id, status, fal_request_id, prompt, created_at, error_message, credits_charged")
    .in("status", ["pending", "submitted", "processing", "scraping"])
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("\n=== STUCK MIMIC JOBS (mimic_jobs table) ===");
  if (e2) console.error("Error:", e2.message);
  console.log("Count:", mimicStuck?.length || 0);
  for (const j of mimicStuck || []) {
    const age = Math.round((Date.now() - new Date(j.created_at).getTime()) / 60000);
    console.log(`\n  [${j.status}] ${j.id}`);
    console.log(`    Age: ${age} min | FAL ID: ${(j.fal_request_id || "none").slice(0, 60)}`);
    console.log(`    Prompt: ${(j.prompt || "").slice(0, 60)}`);
  }

  // 3. Recent motion jobs (all statuses)
  const { data: recent } = await db
    .from("jobs")
    .select("id, status, runpod_job_id, prompt, created_at, error_message")
    .eq("model_id", "mimic-motion")
    .order("created_at", { ascending: false })
    .limit(8);

  console.log("\n=== RECENT MOTION JOBS (all statuses) ===");
  for (const j of recent || []) {
    const age = Math.round((Date.now() - new Date(j.created_at).getTime()) / 60000);
    console.log(`  [${j.status.padEnd(10)}] ${j.id.slice(0, 8)} | ${age}min | ${(j.error_message || j.prompt || "").slice(0, 60)}`);
  }

  // 4. Poll a stuck WaveSpeed job if found
  const wsStuck = (stuck || []).find(j => j.runpod_job_id?.startsWith("ws:"));
  if (wsStuck) {
    const wsId = wsStuck.runpod_job_id!.slice(3);
    console.log(`\n=== POLLING WAVESPEED JOB: ${wsId} ===`);
    const API_KEY = process.env.WAVESPEED_API_KEY;
    const res = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${wsId}/result`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    console.log("Status:", res.status);
    const json = await res.json();
    console.log("Response:", JSON.stringify(json).slice(0, 500));
  }

  // 5. Poll a stuck FAL motion job if found
  const falStuck = (stuck || []).find(j => j.runpod_job_id?.startsWith("fal:"));
  if (falStuck) {
    const parts = falStuck.runpod_job_id!.split(":");
    const endpoint = parts.slice(1, -1).join(":");
    const requestId = parts[parts.length - 1];
    const isWsMotion = endpoint.startsWith("ws:");

    console.log(`\n=== POLLING FAL MOTION JOB ===`);
    console.log(`  Endpoint: ${endpoint}`);
    console.log(`  Request ID: ${requestId}`);
    console.log(`  Is WaveSpeed Motion: ${isWsMotion}`);

    if (isWsMotion) {
      const API_KEY = process.env.WAVESPEED_API_KEY;
      const res = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      console.log("  WS Status:", res.status);
      const json = await res.json();
      console.log("  Response:", JSON.stringify(json).slice(0, 500));
    } else {
      const FAL_KEY = process.env.FAL_KEY;
      const statusUrl = `https://queue.fal.run/${endpoint.split("/").slice(0, 3).join("/")}/requests/${requestId}/status`;
      console.log(`  Polling: ${statusUrl}`);
      const res = await fetch(statusUrl, { headers: { Authorization: `Key ${FAL_KEY}` } });
      console.log("  FAL Status:", res.status);
      const text = await res.text();
      console.log("  Response:", text.slice(0, 500));
    }
  }
}

main().catch(console.error);
