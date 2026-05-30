import { NextRequest, NextResponse } from "next/server";
import { validateSession, getSessionCookieName } from "@/lib/auth-custom/session";
import { getDb } from "@/lib/db-driver";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(getSessionCookieName())?.value;
    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const session = await validateSession(token);
    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const db = getDb();
    const { data: user } = await db
      .from("users")
      .select("*")
      .eq("id", session.userId)
      .single();

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        plan: user.plan,
        creditBalance: user.credit_balance,
        monthlyCreditsUsed: user.monthly_credits_used,
        monthlyCreditsLimit: user.monthly_credits_limit,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
