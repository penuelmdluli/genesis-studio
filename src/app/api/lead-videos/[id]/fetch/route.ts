import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { fetchLead, getLead, MAX_LEAD_ATTEMPTS } from "@/lib/lead-videos";

/**
 * Download a lead's video into R2 (or retry a failed one).
 *
 * This is a separate call from adding the lead so that pasting a link returns
 * instantly — yt-dlp against Facebook regularly takes 20–40 seconds, and a
 * link pasted from a phone should be saved before that starts, not after.
 *
 * The client fires this right after adding, and the cron sweeps up anything
 * that was never fetched because the tab was closed mid-download.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUserByClerkId(clerkId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id } = await params;
    const lead = await getLead(id, user.id);
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    // A manual retry from the UI is an explicit decision to try again, so it
    // resets the budget the cron works against; an automatic retry does not.
    const manualRetry = req.nextUrl.searchParams.get("retry") === "1";
    if (!manualRetry && lead.attempts >= MAX_LEAD_ATTEMPTS && lead.status === "failed") {
      return NextResponse.json({ lead, error: lead.errorMessage }, { status: 200 });
    }

    const updated = await fetchLead(id, user.id);

    return NextResponse.json({
      lead: updated,
      ...(updated.status === "failed" ? { error: updated.errorMessage } : {}),
    });
  } catch (error) {
    console.error("[LEADS] Fetch failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
