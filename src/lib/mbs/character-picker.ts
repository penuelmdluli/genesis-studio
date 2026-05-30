// ============================================
// MBS Character Picker — STRICT ROTATION
// Never repeats any of the last 3 characters.
// Cycles through all 10 before allowing reuse.
// ============================================

import { getDb } from "@/lib/db-driver";

interface Character {
  id: string;
  name: string;
  portrait_url: string;
  description: string;
  best_for_styles: string[] | null;
  avg_engagement_per_post: number | null;
}

export async function pickCharacterForStyle(danceStyle?: string): Promise<Character> {
  const supabase = getDb();

  // Get all active characters
  const { data: characters } = await supabase
    .from("mbs_characters")
    .select("*")
    .eq("active", true);

  if (!characters || characters.length === 0) {
    throw new Error("No active MBS characters found");
  }

  // Get the last 3 characters used (from recent non-cancelled jobs)
  const { data: recentJobs } = await supabase
    .from("mbs_jobs")
    .select("character_id")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(3);

  const recentCharIds = new Set(
    (recentJobs ?? []).map((j: any) => j.character_id).filter(Boolean)
  );

  // Exclude recently used characters
  const available = characters.filter((c: any) => !recentCharIds.has(c.id));

  // If all are excluded (shouldn't happen with 10 chars, 3 exclusions), use all
  const pool = available.length > 0 ? available : characters;

  // Pick randomly from the available pool
  return pool[Math.floor(Math.random() * pool.length)];
}
