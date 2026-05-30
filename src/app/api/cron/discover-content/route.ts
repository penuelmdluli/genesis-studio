import { isAutomationPaused } from "@/lib/automation-killswitch";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { listCreatorPosts } from "@/lib/mbs/scraper";
import { envString } from "@/lib/env";

export const maxDuration = 120;

/**
 * Cron: Discover new dance content from verified creators ONLY.
 * Runs every 30 min. Only pulls from mbs_source_creators where
 * verified=true AND active=true. No unverified content enters
 * the auto-approve flow.
 *
 * GET /api/cron/discover-content
 */
export async function GET(req: NextRequest) {
  if (isAutomationPaused()) return NextResponse.json({ paused: true, reason: "AUTOMATION_PAUSED=true" });
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== envString("CRON_SECRET")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getDb();
  const results = { creatorsChecked: 0, candidatesAdded: 0, errors: 0 };

  // ONLY verified + active creators
  const { data: creators } = await supabase
    .from("mbs_source_creators")
    .select("*")
    .eq("active", true)
    .eq("verified", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true } as any)
    .limit(5);

  for (const creator of creators ?? []) {
    try {
      const posts = await listCreatorPosts(creator.profile_url, 10, creator.platform);
      results.creatorsChecked++;

      const maxDuration = creator.platform === "facebook" ? 60 : 30;
      for (const post of posts) {
        if (post.duration < 5 || post.duration > maxDuration) continue;
        if (!post.url) continue;

        const { data: existing } = await supabase
          .from("mbs_candidates")
          .select("id")
          .eq("source_url", post.url)
          .maybeSingle();
        if (existing) continue;

        await supabase.from("mbs_candidates").insert({
          source_creator_id: creator.id,
          source_url: post.url,
          source_post_id: post.id,
          duration_sec: post.duration,
          view_count: post.viewCount,
          thumbnail_url: post.thumbnailUrl,
          status: "discovered",
        });
        results.candidatesAdded++;
      }

      await supabase.from("mbs_source_creators").update({
        last_checked_at: new Date().toISOString(),
      }).eq("id", creator.id);
    } catch (err) {
      console.error(`[Discovery] Error for @${creator.handle}:`, err);
      results.errors++;
    }
  }

  console.log(`[Discovery] ${results.creatorsChecked} creators, ${results.candidatesAdded} candidates`);
  return NextResponse.json(results);
}
