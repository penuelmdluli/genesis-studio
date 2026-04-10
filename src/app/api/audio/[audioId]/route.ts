import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";

const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.R2_BUCKET_NAME || "genesis-videos";

const PRESIGN_TTL_SECONDS = 60 * 60;

/**
 * GET /api/audio/{audioId}
 * 302-redirects to a presigned R2 URL for the user's audio file.
 * Bytes flow R2 → browser directly (zero fastOriginTransfer).
 * Range requests are handled natively by R2 on the redirected URL.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ audioId: string }> }
) {
  try {
    const { audioId } = await params;

    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const key = `audio/${user.id}/${audioId}.mp3`;

    // Verify the file exists
    try {
      const head = await R2.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: key })
      );
      if ((head.ContentLength ?? 0) === 0) {
        return NextResponse.json(
          { error: "Audio file not found" },
          { status: 404 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Audio file not found" },
        { status: 404 }
      );
    }

    const signedUrl = await getSignedUrl(
      R2,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: PRESIGN_TTL_SECONDS }
    );

    return NextResponse.redirect(signedUrl, {
      status: 302,
      headers: {
        "Cache-Control": `private, max-age=${PRESIGN_TTL_SECONDS - 60}`,
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
