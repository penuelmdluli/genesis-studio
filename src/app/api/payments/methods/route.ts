// Which payment rails are live right now. Public and secret-free: the
// pricing page uses it to decide whether to offer PayFast next to Yoco.
import { NextResponse } from "next/server";
import { configuredProviders } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ providers: configuredProviders() });
}
