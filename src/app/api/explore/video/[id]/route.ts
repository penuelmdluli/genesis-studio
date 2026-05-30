import { NextRequest, NextResponse } from "next/server";
import { r2PublicUrl, fileExists } from "@/lib/storage";

/**
 * Serve explore videos from R2 permanent storage.
 * Public endpoint — no auth required (explore videos are public).
 *
 * URL format: /api/explore/video/{exploreId}
 * R2 key: explore/{exploreId}.mp4
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const key = `explore/${id}.mp4`;

    if (!(await fileExists(key))) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.redirect(r2PublicUrl(key), {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=604800",
      },
    });
  } catch (error) {
    console.error("[EXPLORE VIDEO] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
