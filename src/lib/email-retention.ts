/**
 * Genesis Studio — Retention & Dunning Emails
 * Win-back campaigns, credit expiry warnings, weekly digests, dunning.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Genesis Studio <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://genesis-studio-hazel.vercel.app";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.debug("[EMAIL-RETENTION] No RESEND_API_KEY, skipping");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    throw new Error(`Resend error: ${res.status} ${await res.text()}`);
  }
}

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0A0A0F; color: #ededed; padding: 40px 20px;
`;
const card = `
  max-width: 520px; margin: 0 auto; background: #111118;
  border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); padding: 32px;
`;
const btn = `
  display: inline-block; padding: 12px 28px; background: #7c3aed;
  color: white; text-decoration: none; border-radius: 10px; font-weight: 600;
`;

// --- Dunning Emails ---

export async function sendDunningEmail(to: string, name: string) {
  return sendEmail(
    to,
    "Action needed: Update your payment method",
    `<div style="${baseStyle}"><div style="${card}">
      <h2 style="margin:0 0 12px;color:#ededed;">Payment Update Needed</h2>
      <p style="color:#a1a1aa;line-height:1.6;">
        Hi ${name}, your recent payment for Genesis Studio failed.
        Please update your payment method to keep your plan active and avoid losing access to premium features.
      </p>
      <p style="margin:24px 0;">
        <a href="${APP_URL}/settings" style="${btn}">Update Payment Method</a>
      </p>
      <p style="color:#71717a;font-size:13px;">
        If you've already updated your payment, please disregard this email. Your plan will be downgraded in 4 days if not resolved.
      </p>
    </div></div>`
  );
}

export async function sendDowngradeEmail(to: string, name: string) {
  return sendEmail(
    to,
    "Your plan has been downgraded",
    `<div style="${baseStyle}"><div style="${card}">
      <h2 style="margin:0 0 12px;color:#ededed;">Plan Downgraded</h2>
      <p style="color:#a1a1aa;line-height:1.6;">
        Hi ${name}, due to an unresolved payment issue, your Genesis Studio plan has been downgraded to Free.
        Your videos and data are safe — you can resubscribe anytime to get your credits and features back.
      </p>
      <p style="margin:24px 0;">
        <a href="${APP_URL}/pricing" style="${btn}">Resubscribe Now</a>
      </p>
    </div></div>`
  );
}

// --- Retention Emails ---

export async function sendCreditsExpiryEmail(to: string, name: string, credits: number, expiresIn: number) {
  return sendEmail(
    to,
    `Your ${credits} credits expire in ${expiresIn} days`,
    `<div style="${baseStyle}"><div style="${card}">
      <h2 style="margin:0 0 12px;color:#ededed;">Credits Expiring Soon</h2>
      <p style="color:#a1a1aa;line-height:1.6;">
        Hi ${name}, you have <strong style="color:#7c3aed;">${credits} credits</strong> that expire in ${expiresIn} days.
        Don't let them go to waste — create something amazing!
      </p>
      <p style="margin:24px 0;">
        <a href="${APP_URL}/generate" style="${btn}">Generate a Video</a>
      </p>
    </div></div>`
  );
}

export async function sendWeeklyDigestEmail(to: string, name: string, stats: {
  videosCreated: number;
  creditsUsed: number;
  creditsRemaining: number;
  topModel: string;
}) {
  return sendEmail(
    to,
    "Your Genesis Studio weekly recap",
    `<div style="${baseStyle}"><div style="${card}">
      <h2 style="margin:0 0 12px;color:#ededed;">Your Week in Genesis Studio</h2>
      <p style="color:#a1a1aa;line-height:1.6;">Hi ${name}, here's your weekly recap:</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0;">
        <div style="background:rgba(124,58,237,0.1);border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:bold;color:#a78bfa;">${stats.videosCreated}</div>
          <div style="font-size:12px;color:#71717a;">Videos Created</div>
        </div>
        <div style="background:rgba(6,182,212,0.1);border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:bold;color:#67e8f9;">${stats.creditsUsed}</div>
          <div style="font-size:12px;color:#71717a;">Credits Used</div>
        </div>
      </div>
      <p style="color:#71717a;font-size:13px;">
        You have ${stats.creditsRemaining} credits remaining. Your most-used model: ${stats.topModel}.
      </p>
      <p style="margin:24px 0;">
        <a href="${APP_URL}/generate" style="${btn}">Keep Creating</a>
      </p>
    </div></div>`
  );
}

export async function sendWinBackEmail(to: string, name: string, bonusCredits: number) {
  return sendEmail(
    to,
    `We miss you, ${name}! Here's ${bonusCredits} free credits`,
    `<div style="${baseStyle}"><div style="${card}">
      <h2 style="margin:0 0 12px;color:#ededed;">We Miss You!</h2>
      <p style="color:#a1a1aa;line-height:1.6;">
        Hi ${name}, it's been a while since you created something on Genesis Studio.
        We've added <strong style="color:#7c3aed;">${bonusCredits} bonus credits</strong> to your account.
        Come back and see what's new — we've added new models and features!
      </p>
      <p style="margin:24px 0;">
        <a href="${APP_URL}/dashboard" style="${btn}">Claim Your Credits</a>
      </p>
      <p style="color:#71717a;font-size:13px;">
        Credits expire in 14 days. One-time offer.
      </p>
    </div></div>`
  );
}
