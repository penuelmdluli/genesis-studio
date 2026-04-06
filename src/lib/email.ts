/**
 * Genesis Studio — Email System
 * Uses Resend for transactional emails.
 * Install: npm install resend
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Genesis Studio <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://genesis-studio-hazel.vercel.app";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not configured, skipping email");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[email] Failed to send:", err);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[email] Error:", err);
    return false;
  }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #0A0A0F;
  color: #e4e4e7;
  padding: 40px 20px;
`;

const buttonStyle = `
  display: inline-block;
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
  color: white;
  padding: 12px 28px;
  border-radius: 10px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
`;

function wrap(content: string): string {
  return `
    <div style="${baseStyle}">
      <div style="max-width: 560px; margin: 0 auto;">
        <div style="margin-bottom: 32px;">
          <span style="font-size: 24px; font-weight: 800; color: white;">Genesis Studio</span>
        </div>
        ${content}
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; color: #71717a;">
          <p>Genesis Studio — AI Video Creation Platform</p>
          <p><a href="${APP_URL}" style="color: #8b5cf6;">genesis-studio.app</a></p>
        </div>
      </div>
    </div>
  `;
}

export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: "Welcome to Genesis Studio! Your 50 free credits are ready",
    html: wrap(`
      <h1 style="color: white; font-size: 28px; margin-bottom: 8px;">Welcome, ${name}!</h1>
      <p style="color: #a1a1aa; margin-bottom: 24px;">
        You've got <strong style="color: #8b5cf6;">50 free credits</strong> to create stunning AI videos.
      </p>
      <p style="color: #a1a1aa; margin-bottom: 8px;">Here's what you can make:</p>
      <ul style="color: #a1a1aa; padding-left: 20px; margin-bottom: 32px;">
        <li>Videos with native audio — dialogue, sound effects, lip sync</li>
        <li>Motion control — make any character dance</li>
        <li>Short films with Brain Studio</li>
        <li>Auto captions, voiceover, and thumbnails</li>
      </ul>
      <a href="${APP_URL}/generate" style="${buttonStyle}">Create Your First Video</a>
    `),
  });
}

export async function sendVideoReadyEmail(email: string, name: string, videoId: string): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: "Your video is ready!",
    html: wrap(`
      <h1 style="color: white; font-size: 24px; margin-bottom: 8px;">Your video is ready, ${name}!</h1>
      <p style="color: #a1a1aa; margin-bottom: 24px;">
        Your AI-generated video has finished rendering. Watch it now in your gallery.
      </p>
      <a href="${APP_URL}/gallery" style="${buttonStyle}">Watch Video</a>
    `),
  });
}

export async function sendLowCreditsEmail(email: string, name: string, balance: number): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: "Low credits — top up to keep creating",
    html: wrap(`
      <h1 style="color: white; font-size: 24px; margin-bottom: 8px;">Running low on credits</h1>
      <p style="color: #a1a1aa; margin-bottom: 24px;">
        Hey ${name}, you have <strong style="color: #f59e0b;">${balance} credits</strong> remaining.
        Top up to keep creating amazing videos.
      </p>
      <a href="${APP_URL}/pricing" style="${buttonStyle}">Get More Credits</a>
    `),
  });
}

export async function sendPlanUpgradeEmail(email: string, name: string, plan: string): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: `You're now on the ${plan} plan!`,
    html: wrap(`
      <h1 style="color: white; font-size: 24px; margin-bottom: 8px;">Welcome to ${plan}!</h1>
      <p style="color: #a1a1aa; margin-bottom: 24px;">
        Hey ${name}, your plan has been upgraded to <strong style="color: #8b5cf6;">${plan}</strong>.
        You now have access to more models, higher resolutions, and more credits.
      </p>
      <a href="${APP_URL}/generate" style="${buttonStyle}">Start Creating</a>
    `),
  });
}
