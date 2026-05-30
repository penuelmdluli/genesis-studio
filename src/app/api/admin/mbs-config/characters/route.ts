import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { getDb } from "@/lib/db-driver";

async function requireOwner() {
  const clerkId = await getAuthUserId();
  if (!clerkId || !isOwnerClerkId(clerkId)) return null;
  return clerkId;
}

export async function GET() {
  if (!(await requireOwner())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getDb();
  const { data } = await supabase.from("mbs_characters").select("*").order("name");
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { name, description, portrait_url } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const supabase = getDb();
  const { data, error } = await supabase.from("mbs_characters").insert({
    name, description: description || "", portrait_url: portrait_url || "", active: true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const supabase = getDb();
  const { error } = await supabase.from("mbs_characters").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const supabase = getDb();
  const { error } = await supabase.from("mbs_characters").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
