import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { getScheduledPosts, getScheduleSummary } from "@/lib/owner-scheduler";

export async function GET(req: NextRequest) {
  const clerkId = await getAuthUserId();
  if (!clerkId || !isOwnerClerkId(clerkId)) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  const [posts, summary] = await Promise.all([
    getScheduledPosts(30),
    getScheduleSummary(),
  ]);

  return NextResponse.json({
    summary,
    posts,
    slots: {
      morning: "7:00 AM SA",
      lunch: "1:00 PM SA",
      evening: "7:00 PM SA",
    },
    rules: {
      maxPerDay: 3,
      pages: ["Tech Pulse Africa", "Penuel Mdluli", "Mzansi Baby Stars", "Africa 2050"],
    },
  });
}
