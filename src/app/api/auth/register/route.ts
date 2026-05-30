import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth-custom/password";
import {
  createSession,
  buildSessionCookie,
} from "@/lib/auth-custom/session";
import { getDb } from "@/lib/db-driver";
import { sendWelcomeEmail } from "@/lib/email";
import { sendSlackAlert } from "@/lib/alerts";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if email is already registered
    const { data: existing } = await db
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = crypto.randomUUID();
    const clerkId = `local_${userId}`; // Backward-compatible ID format

    const { data: user, error } = await db.from("users").insert({
      id: userId,
      clerk_id: clerkId,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      password_hash: passwordHash,
      auth_provider: "email",
      plan: "free",
      credit_balance: 100,
      monthly_credits_used: 0,
      monthly_credits_limit: 100,
    });

    if (error) {
      console.error("[AUTH] Registration failed:", error);
      return NextResponse.json(
        { error: "Registration failed" },
        { status: 500 }
      );
    }

    // Create session
    const token = await createSession({
      id: userId,
      email: email.toLowerCase().trim(),
      name: name.trim(),
    });

    // Welcome email (fire-and-forget)
    sendWelcomeEmail(email, name).catch((err: unknown) =>
      console.error("[AUTH] Welcome email failed:", err)
    );

    // Slack alert
    sendSlackAlert({
      level: "info",
      title: "New customer signed up",
      message: `${name} (${email}) just joined Genesis Studio with 100 free credits.`,
    }).catch(() => {});

    const response = NextResponse.json({
      user: { id: userId, email, name, plan: "free", creditBalance: 100 },
    });
    response.headers.set("Set-Cookie", buildSessionCookie(token));

    return response;
  } catch (err) {
    console.error("[AUTH] Register error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
