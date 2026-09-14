// ============================================
// GENESIS STUDIO — runs the marketing series autopilot
// ============================================
// Called every five minutes by the cron worker. Each call moves every enabled
// campaign one step forward; see src/lib/series/autopilot.ts for why it is a
// step at a time.

import { NextRequest, NextResponse } from "next/server";
import { tickAllCampaigns } from "@/lib/series/autopilot";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Not found", { status: 404 });
  }
  const results = await tickAllCampaigns();
  return NextResponse.json({ ran: results.length, results });
}
