// ============================================
// MBS Character Picker — Engagement-based selection
// Prefers characters that perform well for the
// given dance style, with exploration factor.
// ============================================

import { createSupabaseAdmin } from "@/lib/supabase";

interface Character {
  id: string;
  name: string;
  portrait_url: string;
  description: string;
  best_for_styles: string[] | null;
  avg_engagement_per_post: number | null;
}

export async function pickCharacterForStyle(danceStyle?: string): Promise<Character> {
  const supabase = createSupabaseAdmin();

  // Get all active characters
  const { data: characters } = await supabase
    .from("mbs_characters")
    .select("*")
    .eq("active", true);

  if (!characters || characters.length === 0) {
    throw new Error("No active MBS characters found");
  }

  // If we have engagement data, weight by performance
  const withEngagement = characters.filter(c => (c.avg_engagement_per_post ?? 0) > 0);

  if (withEngagement.length >= 3 && danceStyle) {
    // Style-matched characters get bonus
    const scored = characters.map(c => {
      let score = c.avg_engagement_per_post ?? 1;
      if (c.best_for_styles?.includes(danceStyle)) score *= 1.5;
      return { ...c, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Weighted random: 60% top, 30% second, 10% rest
    const r = Math.random();
    if (r < 0.6) return scored[0];
    if (r < 0.9 && scored.length > 1) return scored[1];
    return scored[Math.floor(Math.random() * scored.length)];
  }

  // No engagement data yet — pure random
  return characters[Math.floor(Math.random() * characters.length)];
}
