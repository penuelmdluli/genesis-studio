// Meta calls this when someone removes the app from their Facebook account.
// Their Pages must stop being posted to immediately.
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { parseSignedRequest, facebookConfigured } from "@/lib/social/facebook-oauth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!facebookConfigured()) return NextResponse.json({ ok: true });

  let signed = "";
  try {
    const form = await req.formData();
    signed = String(form.get("signed_request") || "");
  } catch {
    const body = (await req.json().catch(() => ({}))) as { signed_request?: string };
    signed = body.signed_request || "";
  }

  const payload = signed ? parseSignedRequest(signed) : null;
  if (!payload?.user_id) return NextResponse.json({ error: "invalid signed_request" }, { status: 400 });

  try {
    const db = getDb();
    await db.from("social_connections").delete().eq("provider", "facebook").eq("scopes", String(payload.user_id));
  } catch (err) {
    console.error("[FACEBOOK] deauthorize cleanup failed:", err);
  }
  return NextResponse.json({ ok: true });
}
