// ============================================
// GET  /api/email/unsubscribe?u=&t=        → opt out, show a confirmation page
// GET  /api/email/unsubscribe?u=&t=&resub=1 → opt back in
// POST /api/email/unsubscribe?u=&t=        → RFC 8058 one-click (mail apps)
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { setOptOut, verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

function page(title: string, body: string, status = 200): NextResponse {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · iVideo Studio</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0A0A0F;color:#e4e4e7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px}
.card{max-width:440px;background:#111118;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:32px;text-align:center}
h1{color:#fff;font-size:22px;margin:0 0 10px}p{line-height:1.6;color:#a1a1aa;margin:0 0 18px}
a.btn{display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600}
a.link{color:#c4b5fd}</style></head><body><div class="card">${body}</div></body></html>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

async function params(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") || "";
  const t = req.nextUrl.searchParams.get("t") || "";
  return { u, t, ok: await verifyUnsubscribeToken(u, t) };
}

export async function GET(req: NextRequest) {
  const { u, t, ok } = await params(req);
  if (!ok) {
    return page(
      "Link expired",
      `<h1>This link doesn't work</h1><p>Sign in and open Settings to change your email preferences.</p><a class="btn" href="/settings">Open Settings</a>`,
      400
    );
  }
  const self = `/api/email/unsubscribe?u=${encodeURIComponent(u)}&t=${t}`;
  if (req.nextUrl.searchParams.get("resub") === "1") {
    await setOptOut(u, false);
    return page(
      "Subscribed",
      `<h1>Welcome back 🎉</h1><p>You'll get one short email a week with a feature worth trying.</p><a class="btn" href="/dashboard">Open the studio</a>`
    );
  }
  await setOptOut(u, true);
  return page(
    "Unsubscribed",
    `<h1>You're unsubscribed</h1><p>No more product update emails. You'll still get emails about your account, like receipts and finished videos.</p>
<p><a class="link" href="${self}&resub=1">Unsubscribed by mistake? Resubscribe</a></p><a class="btn" href="/dashboard">Back to the studio</a>`
  );
}

export async function POST(req: NextRequest) {
  const { u, ok } = await params(req);
  if (!ok) return NextResponse.json({ ok: false }, { status: 400 });
  await setOptOut(u, true);
  return NextResponse.json({ ok: true });
}
