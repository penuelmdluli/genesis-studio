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
    // No endpoint key means the feature doesn't depend on an external service
    if (!envKey) {
      status[feature.id] = true;
      continue;
    }
    const endpointValue = process.env[envKey];
    status[feature.id] = !!endpointValue && endpointValue.length > 0;
  }

  return NextResponse.json({ features: status });
}
