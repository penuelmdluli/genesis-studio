import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { addLead, leadUrlProblem, listLeads } from "@/lib/lead-videos";

export async function GET(req: NextRequest) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUserByClerkId(clerkId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const leads = await listLeads(user.id, {
      includeArchived: req.nextUrl.searchParams.get("archived") === "1",
    });

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("[LEADS] List failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Save one or more links to the lead list.
 *
 * Accepts `url` for a single paste and `urls` for a bulk paste, because the
 * two ways this gets used are opposite: one link the moment you see a reel, or
 * a whole block of links pasted out of a notes app in one go. Bad links in a
 * bulk paste are reported per-link rather than failing the batch — losing
 * fifteen good links to one typo would be the worst possible behaviour here.
 */
export async function POST(req: NextRequest) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUserByClerkId(clerkId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = (await req.json()) as {
      url?: string;
      urls?: string[];
      notes?: string;
      tags?: string[];
    };

    // A bulk paste arrives as one blob of text as often as an array, so split
    // on anything that cannot appear inside a URL.
    const raw = body.urls?.length
      ? body.urls
      : String(body.url || "")
          .split(/[\s,]+/)
          .filter(Boolean);

    const urls = [...new Set(raw.map((u) => u.trim()).filter(Boolean))];

    if (urls.length === 0) {
      return NextResponse.json({ error: "Paste a video link first." }, { status: 400 });
    }
    if (urls.length > 50) {
      return NextResponse.json(
        { error: "That is more than 50 links — add them in smaller batches." },
        { status: 400 }
      );
    }

    const added: unknown[] = [];
    const skipped: { url: string; reason: string }[] = [];

    for (const url of urls) {
      const problem = leadUrlProblem(url);
      if (problem) {
        skipped.push({ url, reason: problem });
        continue;
      }
      try {
        const { lead, alreadyExisted } = await addLead({
          userId: user.id,
          url,
          notes: body.notes,
          tags: body.tags,
        });
        if (alreadyExisted) {
          skipped.push({ url, reason: "Already on your list" });
        }
        added.push(lead);
      } catch (err) {
        skipped.push({
          url,
          reason: err instanceof Error ? err.message : "Could not save that link",
        });
      }
    }

    if (added.length === 0) {
      return NextResponse.json(
        { error: skipped[0]?.reason || "Nothing was added", skipped },
        { status: 400 }
      );
    }

    // The download happens in a follow-up call per lead, so this returns as
    // soon as the links are safely on the list — a paste from a phone should
    // never sit waiting on yt-dlp.
    return NextResponse.json({ leads: added, skipped });
  } catch (error) {
    console.error("[LEADS] Add failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
