// A creator removing their own Page from iVideo Studio.
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getDb } from "@/lib/db-driver";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { pageId } = (await req.json().catch(() => ({}))) as { pageId?: string };
  // Two explicit statements rather than a reused builder: the query builder
  // is stateful, so branching on a half-built one is a trap.
  const db = getDb();
  if (pageId) {
    await db
      .from("social_connections")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "facebook")
      .eq("external_id", pageId);
  } else {
    await db.from("social_connections").delete().eq("user_id", user.id).eq("provider", "facebook");
  }

  return NextResponse.json({ ok: true });
}
