// ============================================
// Confirm an email address and release the free credits
// ============================================
// GET /api/auth/verify-email?u=<userId>&e=<expiry>&t=<signature>
//
// Opened from the inbox, so it must work signed-out and is safe to hit twice:
// the credits are attached to the account once and the second visit just says
// "already confirmed".

import { NextRequest, NextResponse } from "next/server";
import { initCloudflareEnv } from "@/lib/cf-env";
import { getD1 } from "@/lib/d1";
import { verifyToken } from "@/lib/email-verification";

export const dynamic = "force-dynamic";

function landing(appUrl: string, status: string): NextResponse {
  return NextResponse.redirect(`${appUrl}/sign-in?verified=${status}`, { status: 302 });
}

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";
  const userId = req.nextUrl.searchParams.get("u") || "";
  const expires = req.nextUrl.searchParams.get("e") || "";
  const token = req.nextUrl.searchParams.get("t") || "";

  const check = await verifyToken(userId, expires, token);
  if (!check.ok) return landing(appUrl, check.reason === "expired" ? "expired" : "invalid");

  initCloudflareEnv();
  const d1 = getD1();
  const user = await d1
    .prepare(
      `SELECT id, email_verified, COALESCE(pending_credits,0) pending, COALESCE(credit_balance,0) balance,
              COALESCE(suspended,0) suspended
         FROM users WHERE id = ?`
    )
    .bind(userId)
    .first<{ id: string; email_verified: number; pending: number; balance: number; suspended: number }>();

  if (!user) return landing(appUrl, "invalid");
  // A suspended account can prove its address and still not be let in.
  if (Number(user.suspended) === 1) return landing(appUrl, "suspended");
  if (Number(user.email_verified) === 1) return landing(appUrl, "already");

  const credits = Number(user.pending) || 0;
  await d1
    .prepare(
      `UPDATE users
          SET email_verified = 1,
              email_verified_at = datetime('now'),
              credit_balance = COALESCE(credit_balance,0) + ?,
              pending_credits = 0
        WHERE id = ? AND COALESCE(email_verified,0) = 0`
    )
    .bind(credits, userId)
    .run();

  if (credits > 0) {
    await d1
      .prepare(
        `INSERT INTO credit_transactions (id, user_id, type, amount, balance, description)
         VALUES (?, ?, 'admin_adjustment', ?, ?, 'Free credits released after email confirmation')`
      )
      .bind(crypto.randomUUID(), userId, credits, Number(user.balance) + credits)
      .run()
      .catch(() => null);
  }

  return landing(appUrl, credits > 0 ? "ok" : "ok-nocredits");
}
