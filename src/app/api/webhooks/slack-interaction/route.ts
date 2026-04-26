import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sendSlackAlert } from "@/lib/alerts";

/**
 * Slack interaction webhook handler.
 * Receives button taps from review cards.
 *
 * POST /api/webhooks/slack-interaction
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const payloadStr = formData.get("payload");
    if (!payloadStr) {
      return new NextResponse("No payload", { status: 400 });
    }

    const payload = JSON.parse(payloadStr as string) as {
      type: string;
      actions?: Array<{ action_id: string; value: string }>;
      user?: { id: string; name: string };
    };

    if (payload.type !== "block_actions" || !payload.actions?.length) {
      return new NextResponse("OK");
    }

    const action = payload.actions[0];
    const candidateId = action.value;
    const userName = payload.user?.name ?? "unknown";
    const supabase = createSupabaseAdmin();

    switch (action.action_id) {
      case "approve_candidate": {
        await supabase.from("mbs_candidates").update({
          status: "approved",
          reviewed_by: userName,
          reviewed_at: new Date().toISOString(),
        }).eq("id", candidateId);

        sendSlackAlert({
          level: "info",
          title: "MBS candidate approved",
          message: `${userName} approved candidate ${candidateId.slice(0, 8)}. Generation will begin next cron cycle.`,
        }).catch(() => {});

        return NextResponse.json({
          response_type: "in_channel",
          text: `✅ Approved by ${userName}. Queued for generation.`,
        });
      }

      case "reject_candidate": {
        await supabase.from("mbs_candidates").update({
          status: "rejected",
          rejected_reason: `Manually rejected by ${userName}`,
          reviewed_by: userName,
          reviewed_at: new Date().toISOString(),
        }).eq("id", candidateId);

        return NextResponse.json({
          response_type: "in_channel",
          text: `❌ Rejected by ${userName}.`,
        });
      }

      default:
        return new NextResponse("Unknown action", { status: 400 });
    }
  } catch (err) {
    console.error("[Slack Interaction] Error:", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
