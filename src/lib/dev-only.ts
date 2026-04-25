import { NextResponse } from "next/server";

/**
 * Returns a 404 response if running in Vercel production.
 * Use at the top of every /api/dev/* route handler.
 */
export function blockInProduction(): NextResponse | null {
  if (process.env.VERCEL_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  return null;
}
