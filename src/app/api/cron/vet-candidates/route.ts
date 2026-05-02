import { isAutomationPaused } from "@/lib/automation-killswitch";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { downloadAndPersist, fetchVideoMetadata } from "@/lib/mbs/scraper";
import { vetCandidate, generateSuggestions } from "@/lib/mbs/brand-safety";
import { sendSlackAlert } from "@/lib/alerts";
import { envString } from "@/lib/env";

export const maxDuration = 120;

/**
 * Cron: Vet discovered candidates for brand safety.
 * Runs every 15 min. Downloads video, runs AI vision check,
 * routes to approved/review/rejected.
 *
 * GET /api/cron/vet-candidates
 */
export async function GET(req: NextRequest) {
  if (isAutomationPaused()) return NextResponse.json({ paused: true, reason: "AUTOMATION_PAUSED=true" });
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== envString("CRON_SECRET")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const results = { processed: 0, approved: 0, review: 0, rejected: 0, errors: 0 };

  // Get discovered candidates (limit 3 per run to manage costs + timeout)
  const { data: candidates } = await supabase
    .from("mbs_candidates")
    .select("*, mbs_source_creators(handle, display_name)")
    .eq("status", "discovered")
    .order("discovered_at", { ascending: true })
    .limit(3);

  for (const candidate of candidates ?? []) {
    try {
      // Rule 1: Reject candidates without verified creator source
      if (!candidate.source_creator_id) {
        await supabase.from("mbs_candidates").update({
          status: "rejected",
          rejected_reason: "no_verified_source",
        }).eq("id", candidate.id);
        results.rejected++;
        continue;
      }

      // Step 1: Download video to R2
      let r2Key: string;
      let durationSec: number;

      if (candidate.reference_video_r2_url) {
        r2Key = candidate.reference_video_r2_url;
        durationSec = candidate.duration_sec ?? 10;
      } else {
        const dl = await downloadAndPersist(candidate.source_url);
        r2Key = dl.r2Key;
        durationSec = dl.durationSec;
      }

      await supabase.from("mbs_candidates").update({
        status: "vetting",
        reference_video_r2_url: r2Key,
        duration_sec: durationSec,
      }).eq("id", candidate.id);

      // Step 2: Get thumbnail — fetch metadata if missing
      let thumbUrl = candidate.thumbnail_url;
      if (!thumbUrl) {
        try {
          const meta = await fetchVideoMetadata(candidate.source_url);
          thumbUrl = meta.thumbnailUrl;
          if (thumbUrl) {
            await supabase.from("mbs_candidates").update({ thumbnail_url: thumbUrl }).eq("id", candidate.id);
          }
        } catch (metaErr) {
          console.warn(`[Vet] Metadata fetch failed for ${candidate.id}:`, metaErr);
        }
      }
      if (!thumbUrl) {
        await supabase.from("mbs_candidates").update({
          status: "rejected",
          rejected_reason: "No thumbnail available for vision check",
        }).eq("id", candidate.id);
        results.rejected++;
        continue;
      }

      const safety = await vetCandidate(thumbUrl);

      // Step 3: Generate suggestions
      const creatorHandle = candidate.mbs_source_creators?.handle;
      const suggestions = await generateSuggestions(safety.suggestedDanceStyle, creatorHandle);

      // Step 4: Route based on score (85+ auto, 60-84 review, <60 reject)
      let status: string;
      if (safety.overall >= 85) {
        status = "approved";
        results.approved++;
      } else if (safety.overall >= 50) {
        status = "review";
        results.review++;
      } else {
        status = "rejected";
        results.rejected++;
      }

      await supabase.from("mbs_candidates").update({
        status,
        vision_score: safety.overall,
        overall_score: safety.overall,
        safety_notes: {
          scores: {
            single_subject: safety.singleSubject,
            full_body: safety.fullBody,
            brand_safe: safety.brandSafe,
            dance_quality: safety.danceQuality,
            lighting_quality: safety.lightingQuality,
          },
          flags: safety.flags,
          reasoning: safety.reasoning,
        },
        suggested_character_id: suggestions.character.id,
        suggested_setting: suggestions.setting,
        suggested_caption: suggestions.caption ?? undefined,
        suggested_dance_style: safety.suggestedDanceStyle,
        rejected_reason: status === "rejected" ? safety.reasoning : null,
        updated_at: new Date().toISOString(),
      }).eq("id", candidate.id);

      // Send Slack alert for review candidates
      if (status === "review") {
        const slackUrl = envString("SLACK_ALERT_WEBHOOK_URL");
        if (slackUrl) {
          await fetch(slackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: [
                `:large_yellow_circle: *MBS Review Needed* (score: ${Math.round(safety.overall)}/100)`,
                `Source: ${candidate.source_url}`,
                `Flags: ${safety.flags.join(", ") || "none"}`,
                `Reasoning: ${safety.reasoning}`,
                `Suggested: ${suggestions.character.name} in ${suggestions.setting}`,
                `Caption: ${(suggestions.caption ?? "No caption (missing attribution)").slice(0, 100)}...`,
                ``,
                `To approve: update mbs_candidates set status='approved' where id='${candidate.id}'`,
                `To reject: update mbs_candidates set status='rejected' where id='${candidate.id}'`,
              ].join("\n"),
            }),
          });
        }
      }

      if (status === "approved") {
        sendSlackAlert({
          level: "info",
          title: "MBS candidate auto-approved",
          message: `Score ${Math.round(safety.overall)}/100 | ${suggestions.character.name} | ${safety.suggestedDanceStyle}`,
        }).catch(() => {});
      }

      results.processed++;
    } catch (err) {
      console.error(`[Vet] Error for candidate ${candidate.id}:`, err);
      await supabase.from("mbs_candidates").update({
        status: "failed",
        rejected_reason: err instanceof Error ? err.message : "Vetting error",
      }).eq("id", candidate.id);
      results.errors++;
    }
  }

  console.log(`[Vet] Processed ${results.processed}: ${results.approved} approved, ${results.review} review, ${results.rejected} rejected`);
  return NextResponse.json(results);
}
