// ============================================
// Growth brain: approve or reject a whole batch from one tap
// ============================================
// GET  /api/growth/batch?ids=<id,id,...>&do=approve|reject&t=<signature>
// POST (same query) - records the decisions
//
// The owner asked to decide a batch at once - six trending videos, or every
// task in an email - instead of tapping each. The signature covers the exact
// sorted set of ids and the decision, so a link cannot be edited to include an
// action it was not sent for.
//
// Pending actions change; a rejected one can still be approved (it never ran).
// Anything the brain has already acted on is reported and left alone.

import { NextRequest, NextResponse } from "next/server";
import { initCloudflareEnv } from "@/lib/cf-env";
import { getD1 } from "@/lib/d1";
import { verifyBatchToken } from "@/lib/growth-actions";

export const dynamic = "force-dynamic";

const MAX_BATCH = 40;

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function page(title: string, body: string, tone: "ok" | "warn"): NextResponse {
  const colour = tone === "ok" ? "#10b981" : "#f59e0b";
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#0b0b10;color:#e7e7ea;margin:0;padding:28px 18px">
<div style="max-width:560px;margin:0 auto">
  <div style="font-size:46px;line-height:1">${tone === "ok" ? "✅" : "⚠️"}</div>
  <h1 style="margin:14px 0 6px;font-size:22px;color:${colour}">${esc(title)}</h1>
  ${body}
</div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}

async function read(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_BATCH);
  const decision = (req.nextUrl.searchParams.get("do") || "").toLowerCase();
  const token = req.nextUrl.searchParams.get("t") || "";
  const valid = ["approve", "reject"].includes(decision) && (await verifyBatchToken(ids, decision, token));
  return { ids, decision, valid };
}

// GET never decides: mail scanners open every link in an email before the
// owner does, and a batch "Reject all" fetched by a scanner would silently
// throw away a whole email of decisions. The page submits itself in a browser.
export async function GET(req: NextRequest) {
  const { decision, valid } = await read(req);
  if (!valid) {
    return page("That link is not valid", `<p style="color:#a1a1aa">Nothing was changed.</p>`, "warn");
  }
  const action = esc(req.nextUrl.pathname + req.nextUrl.search);
  return page(
    "Saving…",
    `<form method="post" action="${action}">
       <noscript><p style="color:#a1a1aa">Tap to confirm.</p></noscript>
       <button type="submit" style="margin-top:16px;background:${decision === "approve" ? "#10b981" : "#52525b"};
         color:#fff;border:0;border-radius:12px;font-size:17px;font-weight:600;padding:14px 26px">
         ${decision === "approve" ? "Confirm approve all" : "Confirm reject all"}</button>
     </form><script>document.forms[0].submit()</script>`,
    "ok"
  );
}

export async function POST(req: NextRequest) {
  const { ids, decision, valid } = await read(req);
  if (!valid) {
    return page("That link is not valid", `<p style="color:#a1a1aa">Nothing was changed.</p>`, "warn");
  }

  initCloudflareEnv();
  const d1 = getD1();
  const status = decision === "approve" ? "approved" : "rejected";
  const rows: string[] = [];
  let changed = 0;

  for (const id of ids) {
    const row = await d1
      .prepare("SELECT title, status FROM growth_actions WHERE id = ?")
      .bind(id)
      .first<{ title: string; status: string }>();
    if (!row) continue;
    // A rejected action never ran, so approving it now is safe - this is how a
    // batch recovers from a scanner having opened "Reject all" first.
    if (row.status === "pending" || (row.status === "rejected" && status === "approved")) {
      await d1
        .prepare("UPDATE growth_actions SET status = ?, decided_at = datetime('now') WHERE id = ? AND status = ?")
        .bind(status, id, row.status)
        .run();
      changed++;
      rows.push(`<li style="margin:6px 0">${esc(row.title)}</li>`);
    } else {
      rows.push(`<li style="margin:6px 0;color:#71717a">${esc(row.title)} — already ${esc(row.status)}</li>`);
    }
  }

  const summary =
    decision === "approve"
      ? `${changed} approved. The brain starts on them within a minute and emails you the results.`
      : `${changed} rejected. The brain will stop proposing them.`;
  return page(
    decision === "approve" ? "Batch approved" : "Batch rejected",
    `<p style="color:#a1a1aa;font-size:15px;line-height:1.6">${summary}</p>
     <ul style="padding-left:20px;font-size:14px;line-height:1.5">${rows.join("")}</ul>`,
    decision === "approve" ? "ok" : "warn"
  );
}
