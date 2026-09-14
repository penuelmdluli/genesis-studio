import { NextResponse } from "next/server";
import { FEATURES } from "@/lib/constants";
import { envString } from "@/lib/env";

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
    const endpointValue = envString(envKey);
    status[feature.id] = !!endpointValue && endpointValue.length > 0;
  }

  // Motion control's fun effects and prompt-only mode are Kling-only — our own
  // Wan-Animate GPU needs a driving video and cannot serve them at any price.
  // The page uses this to hide those modes rather than letting users spend
  // credits on a request no funded provider can take.
  let motionEffectsAvailable = false;
  try {
    const { hostedMotionAvailable } = await import("@/lib/motion-control");
    motionEffectsAvailable = await hostedMotionAvailable();
  } catch (err) {
    console.warn("[features/status] Motion provider probe failed:", err);
  }

  // Per-route availability that accounts for the hosted providers, not just
  // RunPod endpoint variables. Without this the menu advertised every
  // FAL-backed tool — thumbnails, upscaler, captions, product ads, music
  // video, avatar — as working while FAL sat locked behind a 403.
  let routes: Record<string, { available: boolean; reason?: string }> = {};
  try {
    const { getAllFeatureStatus } = await import("@/lib/feature-availability");
    routes = await getAllFeatureStatus();
  } catch (err) {
    console.warn("[features/status] Route availability failed:", err);
  }

  return NextResponse.json({
    features: status,
    routes,
    motion: { effectsAvailable: motionEffectsAvailable },
  });
}
