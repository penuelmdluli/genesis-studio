// ============================================
// GENESIS STUDIO — Admin: one personal email to one customer
// ============================================
// POST { to, subject, preheader?, paragraphs: string[], ctaLabel?, ctaHref?,
//        signoff?, campaign? }
//
// For the hand-written note that a template can't be: a founder writing to
// a customer who stopped at checkout. Sent from the normal brand sender with
// replies going to support. `campaign` is recorded in email_sends, so
// passing "recover-1" makes the automated recovery treat this as its step 1.
//
// Owner session or cron secret. Paragraphs are trusted owner HTML.

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { getDb } from "@/lib/db-driver";
import { sendEmailDetailed, layout, h1, p, button } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  const viaSecret = !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
  if (!viaSecret) {
    const clerkId = await getAuthUserId();
    if (!clerkId || !isOwnerClerkId(clerkId)) return new NextResponse("Not found", { status: 404 });
  }

  const b = (await req.json().catch(() => ({}))) as {
    to?: string;
    subject?: string;
    preheader?: string;
    headline?: string;
    paragraphs?: string[];
    ctaLabel?: string;
    ctaHref?: string;
    signoff?: string;
    campaign?: string;
  };
  if (!b.to || !b.subject || !Array.isArray(b.paragraphs) || !b.paragraphs.length) {
    return NextResponse.json({ error: "to, subject and paragraphs are required" }, { status: 400 });
  }
  if (b.ctaHref && !/^https:\/\/ivideostudio\.ai\//.test(b.ctaHref)) {
    return NextResponse.json({ error: "ctaHref must be an ivideostudio.ai link" }, { status: 400 });
  }

  const content = `
    ${b.headline ? h1(b.headline) : ""}
    ${b.paragraphs.map((x) => p(x)).join("\n")}
    ${b.ctaLabel && b.ctaHref ? button(b.ctaLabel, b.ctaHref) : ""}
    ${b.signoff ? p(b.signoff) : ""}
  `;
  const r = await sendEmailDetailed({
    to: b.to,
    subject: b.subject,
    tags: [{ name: "type", value: "personal" }],
    html: layout({ preheader: b.preheader, content }),
  });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 });

  let recorded = false;
  if (b.campaign) {
    const db = getDb();
    const { data: u } = await db.from("users").select("id").eq("email", b.to).maybeSingle();
    if (u?.id) {
      const { error } = await db.from("email_sends").insert({ id: crypto.randomUUID(), user_id: u.id, campaign: b.campaign });
      recorded = !error;
    }
  }
  return NextResponse.json({ ok: true, id: r.id, recorded });
}
