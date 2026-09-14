// ============================================
// Admin: Android beta testers
// ============================================
// Owner only.
//   GET                      → testers (JSON)
//   GET ?format=csv          → one email per line, for Play Console's tester list upload
//   POST {action:"mark-added", emails?}     → mark as added to the Play tester list
//   POST {action:"send-install-links"}      → email the opt-in link to testers on the
//                                             list who haven't had it (needs PLAY_TESTING_OPEN)

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { getDb } from "@/lib/db-driver";
import { sendProductUpdateEmail } from "@/lib/email";
import { PLAY_OPT_IN_URL, betaWhatsappUrl, testingOpen } from "@/lib/android-beta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function allowed(req: NextRequest): Promise<boolean> {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (process.env.CRON_SECRET && secret === process.env.CRON_SECRET) return true;
  const clerkId = await getAuthUserId();
  return !!clerkId && isOwnerClerkId(clerkId);
}

type Tester = { id: string; email: string; name: string | null; source: string | null; added_to_play: number; install_link_sent: number; created_at: string };

export async function GET(req: NextRequest) {
  if (!(await allowed(req))) return new NextResponse("Not found", { status: 404 });
  const { data } = await getDb()
    .from("android_testers")
    .select("id, email, name, source, added_to_play, install_link_sent, created_at")
    .order("created_at", { ascending: true })
    .limit(10000);
  const testers = (data || []) as Tester[];
  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(testers.map((t) => t.email).join("\n") + "\n", {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="android-testers.csv"' },
    });
  }
  return NextResponse.json({ testers, open: testingOpen() });
}

export async function POST(req: NextRequest) {
  if (!(await allowed(req))) return new NextResponse("Not found", { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; emails?: string[] };
  const db = getDb();

  if (body.action === "mark-added") {
    const { data } = await db.from("android_testers").select("id, email").eq("added_to_play", 0).limit(10000);
    const want = body.emails?.map((e) => e.toLowerCase().trim());
    let n = 0;
    for (const t of (data || []) as Array<{ id: string; email: string }>) {
      if (want && !want.includes(t.email)) continue;
      await db.from("android_testers").update({ added_to_play: 1 }).eq("id", t.id);
      n++;
    }
    return NextResponse.json({ ok: true, marked: n });
  }

  if (body.action === "send-install-links") {
    if (!testingOpen()) return NextResponse.json({ error: "Set PLAY_TESTING_OPEN=true once Google approves the test" }, { status: 400 });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";
    const { data } = await db
      .from("android_testers")
      .select("id, email, name")
      .eq("added_to_play", 1)
      .eq("install_link_sent", 0)
      .limit(40);
    let sent = 0;
    const failures: string[] = [];
    for (const t of (data || []) as Array<{ id: string; email: string; name: string | null }>) {
      if (sent > 0) await new Promise((r) => setTimeout(r, 600));
      const r = await sendProductUpdateEmail(t.email, t.name || "there", {
        subject: "📱 Your iVideo Studio Android app is ready to install",
        preheader: "Tap the link with your Google account, then install from Google Play.",
        headline: "You're in. Install the app",
        intro: "thank you for testing! Google has approved the beta. Two taps and it's on your phone:",
        items: [
          { icon: "1️⃣", title: "Accept the invite", text: "Open this link on your Android phone, signed in with this email, and tap Become a tester.", href: PLAY_OPT_IN_URL },
          { icon: "2️⃣", title: "Install from Google Play", text: "Then tap Download it on Google Play and install iVideo Studio.", href: PLAY_OPT_IN_URL },
          { icon: "📅", title: "Keep it for 14 days", text: "Google counts testers who stay 14 days. Use it whenever you like, and tell us what you think by replying to this email.", href: PLAY_OPT_IN_URL },
          { icon: "💬", title: "Invite an Android friend", text: "Share the beta on WhatsApp so they can join too.", href: betaWhatsappUrl(appUrl) },
        ],
        ctaLabel: "Become a tester on Google Play",
        ctaHref: PLAY_OPT_IN_URL,
      });
      if (r.ok) {
        sent++;
        await db.from("android_testers").update({ install_link_sent: 1 }).eq("id", t.id);
      } else failures.push(`${t.email}: ${r.error}`);
    }
    return NextResponse.json({ ok: true, sent, failures });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
