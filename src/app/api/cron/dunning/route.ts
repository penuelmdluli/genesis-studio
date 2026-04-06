import { NextRequest, NextResponse } from "next/server";
import { processDunningQueue } from "@/lib/dunning";

/**
 * Cron job: Process failed payment recovery (dunning).
 * Run daily via Vercel Cron or external scheduler.
 * GET /api/cron/dunning?secret=xxx
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDunningQueue();
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Dunning error:", error);
    return NextResponse.json({ error: "Dunning processing failed" }, { status: 500 });
  }
}
