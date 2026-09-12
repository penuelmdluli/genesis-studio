// ============================================
// SERIES STUDIO — the shelf
// ============================================
// GET  /api/series  — the creator's series, newest first
// POST /api/series  — start a new one
//
// Creating a series costs nothing. The story only becomes expensive when a
// creator asks for pictures, and they should be able to set up a world,
// leave, and come back next week to find it exactly as they left it.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getDb } from "@/lib/db-driver";
import { SERIES_LANGUAGES, type SeriesLanguage } from "@/lib/series/writer";

export const dynamic = "force-dynamic";

const VALID_LANGUAGES = new Set(SERIES_LANGUAGES.map((l) => l.id));

export async function GET() {
  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const db = getDb();
  const { data, error } = await db
    .from("series")
    .select("id, title, language, genre, logline, character_name, character_image_url, episode_count, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  // The shim returns errors rather than throwing, so an unchecked call here
  // would quietly render an empty shelf over a database fault.
  if (error) {
    console.error("[SERIES] list failed:", error);
    return NextResponse.json({ error: "Could not load your series" }, { status: 500 });
  }

  return NextResponse.json({ series: data || [] });
}

export async function POST(req: NextRequest) {
  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    language?: string;
    genre?: string;
    logline?: string;
    characterName?: string;
    characterDescription?: string;
    characterImageUrl?: string;
  };

  const title = (body.title || "").trim();
  if (!title) return NextResponse.json({ error: "Give your series a name" }, { status: 400 });

  const language = (VALID_LANGUAGES.has(body.language as SeriesLanguage)
    ? body.language
    : "en-ZA") as SeriesLanguage;

  const db = getDb();

  // A cap, not a paywall: runaway series rows are a support problem, and
  // nobody is genuinely running more than this at once.
  const { data: existing } = await db.from("series").select("id").eq("user_id", user.id).limit(51);
  if ((existing?.length || 0) >= 50) {
    return NextResponse.json(
      { error: "You have reached 50 series. Delete one you have finished to start another." },
      { status: 400 }
    );
  }

  const id = randomUUID();
  const { error } = await db.from("series").insert({
    id,
    user_id: user.id,
    title: title.slice(0, 120),
    language,
    genre: (body.genre || "drama").slice(0, 60),
    logline: (body.logline || "").slice(0, 600),
    character_name: (body.characterName || "").slice(0, 60),
    character_description: (body.characterDescription || "").slice(0, 600),
    character_image_url: (body.characterImageUrl || "").slice(0, 500),
    story_so_far: "",
    episode_count: 0,
  });

  if (error) {
    console.error("[SERIES] create failed:", error);
    return NextResponse.json({ error: "Could not start your series" }, { status: 500 });
  }

  return NextResponse.json({ id, title, language });
}
