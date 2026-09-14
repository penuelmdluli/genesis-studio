import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getDb } from "@/lib/db-driver";
import { getLead, markLeadUsed, toLeadVideo } from "@/lib/lead-videos";

/** Edit a lead: star it, archive it, retitle it, or mark it as used. */
export async function PATCH(
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

    const body = (await req.json()) as {
      starred?: boolean;
      archived?: boolean;
      notes?: string;
      tags?: string[];
      title?: string;
      markUsed?: boolean;
    };

    if (body.markUsed) {
      await markLeadUsed(id, user.id);
      return NextResponse.json({ lead: await getLead(id, user.id) });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.starred !== undefined) patch.starred = body.starred ? 1 : 0;
    if (body.archived !== undefined) patch.archived = body.archived ? 1 : 0;
    if (body.notes !== undefined) patch.notes = body.notes || null;
    if (body.title !== undefined) patch.title = body.title || null;
    if (body.tags !== undefined) patch.tags = body.tags.length ? body.tags.join(",") : null;

    const { data, error } = await getDb()
      .from("lead_videos")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ lead: data ? toLeadVideo(data) : await getLead(id, user.id) });
  } catch (error) {
    console.error("[LEADS] Update failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Delete a lead outright, and its downloaded copy with it.
 *
 * The R2 object is best-effort: a lead whose row is gone but whose mp4 lingers
 * is a few megabytes of waste, while refusing the delete because storage
 * hiccuped would leave a row the user has already decided they do not want.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUserByClerkId(clerkId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id } = await params;
    const db = getDb();

    const { data: row } = await db
      .from("lead_videos")
      .select("r2_key")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    if (row.r2_key) {
      try {
        const { deleteFile } = await import("@/lib/storage");
        await deleteFile(row.r2_key);
      } catch (err) {
        console.warn(`[LEADS] Could not delete ${row.r2_key}:`, err);
      }
    }

    await db.from("lead_videos").delete().eq("id", id).eq("user_id", user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[LEADS] Delete failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
