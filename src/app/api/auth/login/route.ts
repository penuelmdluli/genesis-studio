import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth-custom/password";
import {
  createSession,
  buildSessionCookie,
} from "@/lib/auth-custom/session";
import { getDb } from "@/lib/db-driver";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const db = getDb();

    const { data: user } = await db
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (!user || !user.password_hash) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.password_hash as string);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Create session
    const token = await createSession({
      id: user.id as string,
      email: user.email as string,
      name: user.name as string,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        creditBalance: user.credit_balance,
      },
    });
    response.headers.set("Set-Cookie", buildSessionCookie(token));

    return response;
  } catch (err) {
    console.error("[AUTH] Login error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
