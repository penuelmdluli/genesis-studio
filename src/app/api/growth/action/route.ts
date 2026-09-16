// ============================================
// Growth brain: approve or reject an action from the daily email
// ============================================
// GET /api/growth/action?id=<id>&do=approve|reject&t=<signature>
//
// Opened from a phone, signed out, possibly days later. The signature is what
// authorises it - the same HMAC pattern as the unsubscribe links - so no login
// is needed and nobody can approve an action by guessing an id.
//
// This endpoint only records the decision. The brain on the owner's machine
// polls for approvals and does the actual work, because that is where the
// repositories, the deploy tooling and the trading terminal live.

import { NextRequest, NextResponse } from "next/server";
import { initCloudflareEnv } from "@/lib/cf-env";
import { getD1 } from "@/lib/d1";
import { verifyActionToken } from "@/lib/growth-actions";

export const dynamic = "force-dynamic";

function page(title: string, body: string, tone: "ok" | "warn" = "ok"): NextResponse {
  const colour = tone === "ok" ? "#10b981" : "#f59e0b";
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#0b0b10;color:#e7e7ea;
margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px">
<div style="max-width:520px;text-align:center">
  <div style="font-size:52px;line-height:1">${tone === "ok" ? "✅" : "⚠️"}</div>
  <h1 style="margin:16px 0 8px;font-size:22px;color:${colour}">${title}</h1>
  <p style="color:#a1a1aa;font-size:15px;line-height:1.6">${body}</p>
  <a href="https://ivideostudio.ai/admin" style="display:inline-block;margin-top:20px;color:#a78bfa">Open admin</a>
</div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const decision = (req.nextUrl.searchParams.get("do") || "").toLowerCase();
  const token = req.nextUrl.searchParams.get("t") || "";

  if (!["approve", "reject"].includes(decision)) {
    return page("That link is not valid", "The action was neither approved nor rejected.", "warn");
  }
  if (!(await verifyActionToken(id, decision, token))) {
    return page("That link is not valid", "The signature did not match. Nothing was changed.", "warn");
  }

  initCloudflareEnv();
  const d1 = getD1();
  const row = await d1
    .prepare("SELECT id, title, status, money_at_stake FROM growth_actions WHERE id = ?")
    .bind(id)
    .first<{ id: string; title: string; status: string; money_at_stake: number }>();

  if (!row) return page("Action not found", "It may have expired or been cleared.", "warn");

  if (row.status !== "pending") {
    // Clicking twice, or clicking after the brain already acted, must not
    // reopen a decision that has been carried out.
    return page(
      "Already handled",
      `“${row.title}” is already <strong>${row.status}</strong>. Nothing changed.`,
      "warn"
    );
  }

  const status = decision === "approve" ? "approved" : "rejected";
  await d1
    .prepare("UPDATE growth_actions SET status = ?, decided_at = datetime('now') WHERE id = ? AND status = 'pending'")
    .bind(status, id)
    .run();

  return decision === "approve"
    ? page("Approved", `“${row.title}” will be carried out within the hour.`)
    : page("Rejected", `“${row.title}” will not be done. The brain will stop proposing it.`, "warn");
}
