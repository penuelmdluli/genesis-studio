import { NextResponse } from "next/server";
import { r2PublicUrl } from "@/lib/storage";

/**
 * GET /api/assets/hero-poster
 * 302-redirects to the public R2 URL for the hero poster.
 * Bytes flow R2 -> browser directly (zero fastOriginTransfer).
 */
export async function GET() {
  try {
    const publicUrl = r2PublicUrl("assets/hero-poster.jpg");

    return NextResponse.redirect(publicUrl, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Poster not found" }, { status: 404 });
  }
}
