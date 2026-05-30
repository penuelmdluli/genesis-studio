import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { r2PublicUrl, fileExists } from "@/lib/storage";

/**
 * GET /api/audio/{audioId}
 * 302-redirects to the public R2 URL for the user's audio file.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ audioId: string }> }
) {
  try {
    const { audioId } = await params;

    const clerkId = await getAuthUserId();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const key = `audio/${user.id}/${audioId}.mp3`;

    if (!(await fileExists(key))) {
      return NextResponse.json(
        { error: "Audio file not found" },
        { status: 404 }
      );
    }

    return NextResponse.redirect(r2PublicUrl(key), {
      status: 302,
      headers: {
        "Cache-Control": "private, max-age=3540",
      },
    });
  } catch (error) {
    console.error("Audio stream error:", error);
    return NextResponse.json(
      { error: "Failed to stream audio" },
      { status: 500 }
    );
  }
}
