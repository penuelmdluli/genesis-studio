import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { getProviderHealthStatus } from "@/lib/vendor-failover";
import { SERVICE_TIERS, SCALING_MILESTONES, estimateMonthlyCosts } from "@/lib/scaling";
import { checkVatThreshold } from "@/lib/tax";

/**
 * Admin endpoint: Provider health, scaling thresholds, and business metrics.
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId || !isOwnerClerkId(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const providerHealth = getProviderHealthStatus();
  const costEstimates = {
    at100Users: estimateMonthlyCosts(100, 50),
    at1000Users: estimateMonthlyCosts(1000, 500),
    at10000Users: estimateMonthlyCosts(10000, 5000),
  };

  // Placeholder for actual revenue — wire to Stripe reporting
  const vatCheck = checkVatThreshold(0);

  return NextResponse.json({
    providerHealth,
    serviceTiers: SERVICE_TIERS,
    scalingMilestones: SCALING_MILESTONES,
    costEstimates,
    vatStatus: vatCheck,
  });
}
