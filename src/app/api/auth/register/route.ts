import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth-custom/password";
import {
  createSession,
  buildSessionCookie,
} from "@/lib/auth-custom/session";
import { getDb } from "@/lib/db-driver";
import { sendVerifyEmail, sendWelcomeEmail } from "@/lib/email";
import { verificationUrl } from "@/lib/email-verification";
import { sendSlackAlert } from "@/lib/alerts";
import { initCloudflareEnv } from "@/lib/cf-env";
import {
  blockValue,
  blockedBy,
  logAttempt,
  deviceCookie,
  recordSignals,
  relatedAccounts,
  scoreRisk,
  signalsFrom,
} from "@/lib/signup-signals";

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

    // Who is signing up, and from where. One person farming throwaway accounts
    // for free credits costs us real generation spend, so the free grant is
    // withheld when this device has already opened an account.
    initCloudflareEnv();
    const { deviceId, setCookie: deviceSetCookie } = deviceCookie(req);
    const signals = await signalsFrom(req, deviceId);

    // A device or network we have already banned never gets to create another
    // account, so there is nothing to clean up afterwards.
    const block = await blockedBy(signals);
    if (block) {
      await logAttempt(
        "blocked",
        "register",
        signals,
        email,
        `${block.kind} on blocklist: ${block.reason || "no reason recorded"}`
      );
      return NextResponse.json(
        {
          error:
            "We could not open an account from this device. If you think this is a mistake, email support@ivideostudio.ai.",
        },
        { status: 403 }
      );
    }

    const related = await relatedAccounts(signals);
    const risk = scoreRisk(signals, email.toLowerCase().trim(), related);
    const freeCredits = risk.denyFreeCredits ? 0 : 100;

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
      credit_balance: 0,
      pending_credits: freeCredits,
      email_verified: 0,
      monthly_credits_used: 0,
      monthly_credits_limit: 100,
      suspended: risk.autoBlock ? 1 : 0,
      suspended_reason: risk.autoBlock ? risk.reasons.join("; ").slice(0, 200) : null,
    });

    if (error) {
      console.error("[AUTH] Registration failed:", error);
      return NextResponse.json(
        { error: "Registration failed" },
        { status: 500 }
      );
    }

    await recordSignals(userId, "register", signals, risk);
    if (risk.denyFreeCredits && !risk.autoBlock) {
      await logAttempt("credits_withheld", "register", signals, email, risk.reasons.join("; "));
    }

    // Create session
    const token = await createSession({
      id: userId,
      email: email.toLowerCase().trim(),
      name: name.trim(),
    });

    // Confirm the address first: the credits are waiting behind this link, so a
    // farm of invented addresses never collects them. The welcome tour follows
    // once we know the inbox is real.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";
    verificationUrl(appUrl, userId)
      .then((url) => sendVerifyEmail(email, name, url, freeCredits))
      .catch((err: unknown) => console.error("[AUTH] Verification email failed:", err));

    // Slack alert
    sendSlackAlert(
      risk.denyFreeCredits
        ? {
            level: "warning",
            title: "Sign-up flagged: no free credits granted",
            message:
              `${name} (${email}) — risk ${risk.score}\n${risk.reasons.join("\n")}\n` +
              `Device ${signals.deviceId.slice(0, 8)}, ${signals.country || "??"} ${signals.ipPrefix}\n` +
              `Review: ${process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai"}/admin/abuse`,
          }
        : {
            level: "info",
            title: "New customer signed up",
            message: `${name} (${email}) just joined iVideo Studio with ${freeCredits} free credits.`,
          }
    ).catch(() => {});

    if (risk.autoBlock) {
      // Ban the browser itself, not only this account: the next attempt from it
      // is refused before any record is created.
      const why = `auto: ${risk.reasons.join("; ")}`;
      await blockValue("device", signals.deviceId, why);
      if (risk.blockFingerprint) await blockValue("fingerprint", signals.fingerprint, why);
      if (risk.blockNetwork) await blockValue("ip_prefix", signals.ipPrefix, why);
      await logAttempt("auto_blocked", "register", signals, email, risk.reasons.join("; "));
      // The account exists (so the evidence is kept and one click restores it),
      // but no session is issued and sign-in is refused.
      sendSlackAlert({
        level: "warning",
        title: "Sign-up auto-blocked",
        message:
          `${name} (${email}) — risk ${risk.score}\n${risk.reasons.join("\n")}\n` +
          `Review: ${process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai"}/admin/abuse`,
      }).catch(() => {});
      return NextResponse.json(
        {
          error:
            "We could not open an account from this device. If you think this is a mistake, email support@ivideostudio.ai.",
        },
        { status: 403 }
      );
    }

    const response = NextResponse.json({
      user: { id: userId, email, name, plan: "free", creditBalance: 0 },
      // The sign-up form tells the customer to go and confirm.
      verificationRequired: true,
      pendingCredits: freeCredits,
      // Shown by the sign-up form so a real person is not left wondering.
      creditsWithheld: risk.denyFreeCredits || undefined,
    });
    response.headers.append("Set-Cookie", buildSessionCookie(token));
    if (deviceSetCookie) response.headers.append("Set-Cookie", deviceSetCookie);

    return response;
  } catch (err) {
    console.error("[AUTH] Register error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
