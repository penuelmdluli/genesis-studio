import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isOwnerClerkId } from "@/lib/credits";

/**
 * GET /api/admin/fb-health
 * Checks all Facebook page tokens are valid and not expired.
 */
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId || !isOwnerClerkId(clerkId)) {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const pages = [
    { name: "Mzansi Baby Stars", envKey: "FB_PAGE_TOKEN_mzansi_baby_stars" },
    { name: "Tech Pulse Africa", envKey: "FB_PAGE_TOKEN_tech_news" },
    { name: "Africa 2050", envKey: "FB_PAGE_TOKEN_limitless_you" },
    { name: "Smart Money AI", envKey: "FB_PAGE_TOKEN_ai_money" },
    { name: "Elevate You", envKey: "FB_PAGE_TOKEN_motivation" },
    { name: "Health & Wellness", envKey: "FB_PAGE_TOKEN_health_wellness" },
  ];

  const results = await Promise.all(
    pages.map(async (page) => {
      const token = process.env[page.envKey];
      if (!token) return { name: page.name, status: "missing", detail: "No token configured" };

      try {
        const res = await fetch(
          `https://graph.facebook.com/v25.0/me?fields=id,name,access_token&access_token=${token}`
        );
        const data = await res.json();
        if (data.error) {
          return { name: page.name, status: "expired", detail: data.error.message.slice(0, 100) };
        }
        // Check token debug info for expiry
        const debugRes = await fetch(
          `https://graph.facebook.com/v25.0/debug_token?input_token=${token}&access_token=${token}`
        );
        const debug = await debugRes.json();
        const expiresAt = debug.data?.expires_at;
        const isNeverExpire = expiresAt === 0;
        const daysLeft = expiresAt && !isNeverExpire
          ? Math.round((expiresAt * 1000 - Date.now()) / 86400000)
          : null;

        return {
          name: page.name,
          fbName: data.name,
          status: isNeverExpire ? "ok" : (daysLeft !== null && daysLeft < 7) ? "expiring" : "ok",
          detail: isNeverExpire ? "Never expires" : daysLeft !== null ? `${daysLeft} days left` : "Active",
        };
      } catch {
        return { name: page.name, status: "error", detail: "Network error" };
      }
    })
  );

  const issues = results.filter((r) => r.status !== "ok");

  // Send Slack alert if any token is expiring
  if (issues.length > 0) {
    try {
      const { sendSlackAlert } = await import("@/lib/alerts");
      await sendSlackAlert({
        level: "warning",
        title: "⚠️ Facebook Token Health Check",
        message: issues.map((i) => `*${i.name}*: ${i.status} — ${i.detail}`).join("\n"),
      });
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ pages: results, issues: issues.length });
}
