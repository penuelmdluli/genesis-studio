import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { initCloudflareEnv } from "@/lib/cf-env";
import { getAuthUserId } from "@/lib/auth";

// First-party page-view collection.
//
// Public and unauthenticated by necessity — it has to record visits from
// people who have not signed up, which is the entire top of the funnel we were
// blind to. See migrations/0007_page_views.sql for the privacy stance.
//
// Never returns an error to the caller. A tracking beacon that fails loudly
// would put a red line in the console of a working page for no benefit; the
// client fires this and forgets it.

export const dynamic = "force-dynamic";

/** Only these are recorded, and only the host of the referrer. */
const MAX_LEN = 256;

function clean(v: unknown, max = MAX_LEN): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s.length ? s : null;
}

/**
 * Reduce a referrer to its host.
 *
 * Full referring URLs routinely carry search terms and personal identifiers in
 * the query string. The host is all we need to answer "where did they come
 * from", so it is all we keep.
 */
function referrerHost(raw: unknown, selfHost: string): string | null {
  const s = clean(raw, 2048);
  if (!s) return null;
  try {
    const host = new URL(s).hostname.replace(/^www\./, "");
    // Internal navigation is not a referral and would drown out real sources.
    return host && host !== selfHost.replace(/^www\./, "") ? host : null;
  } catch {
    return null;
  }
}

function deviceFrom(ua: string): "mobile" | "tablet" | "desktop" | "unknown" {
  if (!ua) return "unknown";
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * A visitor id must look like one we issued. Accepting arbitrary strings would
 * let anyone write chosen identifiers into our analytics.
 */
function safeVisitorId(v: unknown): string | null {
  const s = clean(v, 64);
  return s && /^[a-zA-Z0-9_-]{8,64}$/.test(s) ? s : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const path = clean(body.path, 512);
    if (!path || !path.startsWith("/")) {
      return NextResponse.json({ ok: true });
    }

    initCloudflareEnv();
    const d1 = getD1();

    const selfHost = req.headers.get("host") || "ivideostudio.ai";

    // Country comes from Cloudflare's edge. Coarse by construction, and it
    // means we never have to see, let alone store, an IP address.
    const country = clean(req.headers.get("cf-ipcountry"), 4);

    // Only present when the visitor accepted analytics cookies — the client
    // withholds it otherwise, so a declined visit still counts but cannot be
    // joined to any other visit.
    const visitorId = safeVisitorId(body.visitorId);

    // Signed-in visits can be attributed to the account, which is already
    // identified to us. This is what links a landing page to a signup.
    let userId: string | null = null;
    try {
      userId = await getAuthUserId();
    } catch {
      // Anonymous visit; expected for most of the funnel.
    }

    await d1
      .prepare(
        `INSERT INTO page_views
           (id, visitor_id, user_id, path, referrer_host, utm_source, utm_medium, utm_campaign, country, device)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        visitorId,
        userId,
        path,
        referrerHost(body.referrer, selfHost),
        clean(body.utmSource, 128),
        clean(body.utmMedium, 128),
        clean(body.utmCampaign, 128),
        country,
        deviceFrom(req.headers.get("user-agent") || "")
      )
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Deliberately swallowed. Analytics must never break a page.
    console.error("[TRACK] Failed to record page view:", err);
    return NextResponse.json({ ok: true });
  }
}
