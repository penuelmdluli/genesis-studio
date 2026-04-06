import { NextResponse } from "next/server";
import { FEATURES } from "@/lib/constants";

/**
 * Returns which features have their RunPod endpoints configured.
 * Used by the frontend to show "Coming Soon" on unconfigured features.
 */
export async function GET() {
  const status: Record<string, boolean> = {};

  for (const feature of FEATURES) {
    const envKey = feature.endpointEnvKey;
    const endpointValue = envKey ? process.env[envKey] : undefined;
    status[feature.id] = !!endpointValue && endpointValue.length > 0;
  }

  return NextResponse.json({ features: status });
}
