// Which payment rails are live right now, and where the visitor is. Public
// and secret-free: price displays use it to show rands (what PayFast actually
// charges) to everyone, plus a dollar estimate for visitors outside SA.
import { NextRequest, NextResponse } from "next/server";
import { configuredProviders } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const providers = configuredProviders();
  const country = (req.headers.get("cf-ipcountry") || "").toUpperCase().slice(0, 2) || null;
  return NextResponse.json({
    providers,
    country,
    // Paystack is the only rail here that can bill in dollars. Until its key
    // is set, everyone is charged in rands, and the UI has to say so.
    usdCheckout: providers.includes("paystack"),
  });
}
