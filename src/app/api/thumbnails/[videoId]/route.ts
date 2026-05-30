import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { r2PublicUrl, fileExists } from "@/lib/storage";

/**
 * GET /api/thumbnails/{videoId}
 * 302-redirects to the public R2 URL for the thumbnail.
 * R2 key format: thumbnails/{userId}/{videoId}.jpg
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    const supabase = getDb();
    const { data: video } = await supabase
      .from("videos")
      .select("user_id")
      .eq("id", videoId)
      .maybeSingle();

    if (!video) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const key = `thumbnails/${video.user_id}/${videoId}.jpg`;

    if (!(await fileExists(key))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.redirect(r2PublicUrl(key), {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch (error) {
    console.error("[THUMBNAILS] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
