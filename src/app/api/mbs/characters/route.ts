import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";

/**
 * Public list of active MBS characters for use as ready-made character
 * portraits in Mimic Studio's Step 1 "Library" tab. Any signed-in user
 * may read this — admin mutation lives at /api/admin/mbs-config/characters.
 */
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("mbs_characters")
    .select("id, name, description, portrait_url")
    .eq("active", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ characters: data ?? [] });
}
