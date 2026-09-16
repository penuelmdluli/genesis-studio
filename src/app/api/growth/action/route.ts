// ============================================
// Growth brain: approve or reject an action from an email button
// ============================================
// GET  /api/growth/action?id=<id>&do=approve|reject&t=<signature>
// POST (same query) - records the decision
//
// Opened from a phone, signed out. The signature is the authorisation - the
// same HMAC pattern as the unsubscribe links - so no login is needed and nobody
// can decide an action by guessing an id.
//
// Why GET does not decide anything: mail apps and security scanners open links
// in emails before the person does. The first version recorded the decision on
// GET, and an action was rejected ninety seconds after its email went out. GET
// now returns a page that submits itself in a real browser - still one tap for
// the owner - while a scanner that only fetches the link changes nothing.
//
// A decision can be reversed until the brain starts the work: rejected actions
// never ran, and approved ones stay "approved" only until the brain picks them up.
//
// This endpoint only records the decision. The brain on the owner's machine
// picks it up within a minute and does the work.

import { NextRequest, NextResponse } from "next/server";
import { initCloudflareEnv } from "@/lib/cf-env";
import { getD1 } from "@/lib/d1";
import { actionToken, verifyActionToken } from "@/lib/growth-actions";

export const dynamic = "force-dynamic";

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function page(title: string, body: string, tone: "ok" | "warn" = "ok", extraHead = ""): NextResponse {
  const colour = tone === "ok" ? "#10b981" : "#f59e0b";
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${extraHead}</head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#0b0b10;color:#e7e7ea;
margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px">
<div style="max-width:520px;text-align:center">
  <div style="font-size:52px;line-height:1">${tone === "ok" ? "✅" : "⚠️"}</div>
  <h1 style="margin:16px 0 8px;font-size:22px;color:${colour}">${esc(title)}</h1>
  <div style="color:#a1a1aa;font-size:15px;line-height:1.6">${body}</div>
</div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}

function bigButton(label: string, colour: string): string {
  return `<button type="submit" style="margin-top:18px;background:${colour};color:#fff;border:0;
border-radius:12px;font-size:17px;font-weight:600;padding:14px 26px;cursor:pointer">${esc(label)}</button>`;
}

async function read(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const decision = (req.nextUrl.searchParams.get("do") || "").toLowerCase();
  const token = req.nextUrl.searchParams.get("t") || "";
  const valid = ["approve", "reject"].includes(decision) && (await verifyActionToken(id, decision, token));
  return { id, decision, token, valid };
}

export async function GET(req: NextRequest) {
  const { decision, valid } = await read(req);
  if (!valid) return page("That link is not valid", "Nothing was changed.", "warn");

  // Self-submitting confirmation. A browser posts it immediately; a link
  // scanner fetching the URL never runs the script, so nothing is recorded.
  const action = esc(req.nextUrl.pathname + req.nextUrl.search);
  const label = decision === "approve" ? "Confirm approve" : "Confirm not now";
  return page(
    decision === "approve" ? "Approving…" : "Saving…",
    `<form method="post" action="${action}">
       <noscript><p>Tap to confirm.</p></noscript>
       ${bigButton(label, decision === "approve" ? "#10b981" : "#52525b")}
     </form>
     <script>document.forms[0].submit()</script>`
  );
}

export async function POST(req: NextRequest) {
  const { id, decision, valid } = await read(req);
  if (!valid) return page("That link is not valid", "Nothing was changed.", "warn");

  initCloudflareEnv();
  const d1 = getD1();
  const row = await d1
    .prepare("SELECT id, title, status FROM growth_actions WHERE id = ?")
    .bind(id)
    .first<{ id: string; title: string; status: string }>();
  if (!row) return page("Action not found", "It may have expired or been cleared.", "warn");

  const target = decision === "approve" ? "approved" : "rejected";
  // pending -> either; rejected -> approved (it never ran); approved -> rejected
  // only while the brain has not started it yet.
  const reversible =
    row.status === "pending" ||
    (row.status === "rejected" && target === "approved") ||
    (row.status === "approved" && target === "rejected");

  const flipDecision = target === "approved" ? "reject" : "approve";
  const flipUrl = `/api/growth/action?id=${encodeURIComponent(id)}&do=${flipDecision}&t=${await actionToken(id, flipDecision)}`;
  const flipLink = `<p style="margin-top:22px"><a href="${esc(flipUrl)}" style="color:#a78bfa">${
    target === "approved" ? "Tapped by mistake? Cancel it" : "Changed your mind? Approve instead"
  }</a></p>`;

  if (row.status === target) {
    return page("Already done", `“${esc(row.title)}” is already <strong>${esc(row.status)}</strong>.${flipLink}`, "ok");
  }
  if (!reversible) {
    return page(
      "Already underway",
      `“${esc(row.title)}” is <strong>${esc(row.status)}</strong> - the brain has already acted on it, so it cannot be changed from here.`,
      "warn"
    );
  }

  await d1
    .prepare("UPDATE growth_actions SET status = ?, decided_at = datetime('now') WHERE id = ? AND status = ?")
    .bind(target, id, row.status)
    .run();

  return target === "approved"
    ? page("Approved", `“${esc(row.title)}” starts within a minute. You will get an email with the result.${flipLink}`)
    : page("Not now", `“${esc(row.title)}” will not be done.${flipLink}`, "warn");
}
