// Re-send the confirmation link. Deliberately vague in its reply: it must not
// reveal whether an address has an account.
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { sendVerifyEmail } from "@/lib/email";
import { verificationUrl } from "@/lib/email-verification";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const done = NextResponse.json({ ok: true });
  if (!email) return done;

  const { data: user } = await getDb()
    .from("users")
    .select("id, name, email, email_verified, pending_credits, suspended")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (!user || Number(user.suspended) === 1 || Number(user.email_verified) === 1) return done;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";
  const url = await verificationUrl(appUrl, user.id as string);
  await sendVerifyEmail(
    user.email as string,
    (user.name as string) || "there",
    url,
    Number(user.pending_credits) || 0
  ).catch((err) => console.error("[AUTH] resend verification failed:", err));

  return done;
}
