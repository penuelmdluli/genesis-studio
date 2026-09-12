import { NextRequest, NextResponse } from "next/server";
import { processDunningQueue } from "@/lib/dunning";
import { expireLapsedPlans, sendRenewalReminders, checkEngineBalance } from "@/lib/billing";

/**
 * Cron job: daily billing sweep (09:00 via the genesis-cron Worker).
 *   - Stripe dunning (legacy, no-op while Stripe is unused)
 *   - Yoco plan lifecycle: remind 3 days before, downgrade when lapsed
 *   - Prepaid generation-engine balance alert
 * GET /api/cron/dunning  (Authorization: Bearer CRON_SECRET, or ?secret=)
 */
export async function GET(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secret = req.nextUrl.searchParams.get("secret") || bearer;
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [dunning, reminders, expiry, engine] = await Promise.all([
      processDunningQueue(),
      sendRenewalReminders(),
      expireLapsedPlans(),
      checkEngineBalance(),
    ]);
    return NextResponse.json({
      success: true,
      ...dunning,
      ...reminders,
      ...expiry,
      engineBalanceUsd: engine.balanceUsd,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Dunning error:", error);
    return NextResponse.json({ error: "Dunning processing failed" }, { status: 500 });
  }
}
