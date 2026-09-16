import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth-custom/password";
import {
  createSession,
  buildSessionCookie,
} from "@/lib/auth-custom/session";
import { getDb } from "@/lib/db-driver";
import { initCloudflareEnv } from "@/lib/cf-env";
import { blockedBy, deviceCookie, logAttempt, recordSignals, signalsFrom } from "@/lib/signup-signals";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    let loginDeviceCookie: string | null = null;
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

    if (Number(user.suspended) === 1) {
      return NextResponse.json(
        { error: "This account has been suspended. Contact support@ivideostudio.ai." },
        { status: 403 }
      );
    }

    const valid = await verifyPassword(password, user.password_hash as string);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Record the device this account signs in from: accounts made in the same
    // browser keep linking to each other even after the sign-up itself.
    let blockedDevice = false;
    try {
      initCloudflareEnv();
      const { deviceId, setCookie } = deviceCookie(req);
      loginDeviceCookie = setCookie;
      const signals = await signalsFrom(req, deviceId);
      const hit = await blockedBy(signals);
      blockedDevice = !!hit;
      if (hit) {
        await logAttempt("blocked", "login", signals, email, `${hit.kind} on blocklist: ${hit.reason || ""}`);
      }
      await recordSignals(user.id as string, "login", signals);
    } catch (err) {
      console.error("[ABUSE] login signal failed:", err);
    }

    if (blockedDevice) {
      return NextResponse.json(
        { error: "This device is blocked. Contact support@ivideostudio.ai." },
        { status: 403 }
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
    response.headers.append("Set-Cookie", buildSessionCookie(token));
    if (loginDeviceCookie) response.headers.append("Set-Cookie", loginDeviceCookie);

    return response;
  } catch (err) {
    console.error("[AUTH] Login error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
