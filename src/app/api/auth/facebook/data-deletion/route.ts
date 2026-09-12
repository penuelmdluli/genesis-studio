// ============================================
// Meta-required: Data Deletion Request callback
// ============================================
// Meta will not approve an app without this. They POST a signed_request
// identifying a Facebook user; we must delete that person's data and answer
// with a URL where they can check the status, plus a confirmation code.
//
// The signature is verified before anything is deleted — an unverified
// request would let anyone wipe another account's connections.
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db-driver";
import { parseSignedRequest, facebookConfigured } from "@/lib/social/facebook-oauth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!facebookConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  let signed = "";
  try {
    const form = await req.formData();
    signed = String(form.get("signed_request") || "");
  } catch {
    const body = (await req.json().catch(() => ({}))) as { signed_request?: string };
    signed = body.signed_request || "";
  }

  const payload = signed ? parseSignedRequest(signed) : null;
  if (!payload?.user_id) {
    return NextResponse.json({ error: "invalid signed_request" }, { status: 400 });
  }

  const facebookUserId = String(payload.user_id);
  const confirmationCode = randomUUID().replace(/-/g, "").slice(0, 16);

  try {
    const db = getDb();
    // scopes holds the Facebook user id this connection came from.
    await db.from("social_connections").delete().eq("provider", "facebook").eq("scopes", facebookUserId);
    console.log(`[FACEBOOK] Deleted connections for FB user ${facebookUserId} (${confirmationCode})`);
  } catch (err) {
    console.error("[FACEBOOK] data deletion failed:", err);
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";
  return NextResponse.json({
    url: `${base}/privacy?deletion=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}
