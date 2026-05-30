import { NextRequest, NextResponse } from "next/server";

/**
 * Returns a 404 response if running in production
 * UNLESS a valid CRON_SECRET is provided (allows automated pipeline).
 * Use at the top of every /api/dev/* route handler.
 */
export function blockInProduction(req?: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    // Allow authenticated cron/pipeline requests through in production
    if (req) {
      const secret =
        req.headers.get("x-cron-secret") ||
        req.headers.get("authorization")?.replace("Bearer ", "");
      if (secret && secret === process.env.CRON_SECRET) {
        return null; // Authenticated — allow through
      }
    }
    return new NextResponse("Not found", { status: 404 });
  }
  return null;
}
