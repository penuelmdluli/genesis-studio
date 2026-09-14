/**
 * iVideo Studio — Email System (Resend)
 *
 * Every customer email goes through `layout()`, which produces a table-based,
 * inline-styled document that renders the same in Gmail, Outlook, Apple Mail
 * and the mobile clients — dark brand header, light readable body, one clear
 * call to action, and a footer that says who we are and why they got it.
 *
 * Transactional emails (welcome, receipts, video ready, plan changes) are
 * always sent. Marketing emails (product updates) go through sendProductUpdate
 * and carry an unsubscribe line; the broadcast route respects it.
 */

function getEmailConfig() {
  return {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    FROM_EMAIL: process.env.RESEND_FROM_EMAIL || "iVideo Studio <onboarding@resend.dev>",
    APP_URL: process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai",
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || "support@ivideostudio.ai",
  };
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /** Plain-text preview shown in inbox list (hidden in body). */
  preheader?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Send, and say why it failed. `sendEmail` keeps the boolean contract its
 * callers expect; anything diagnosing a delivery problem wants the reason,
 * because a silent `false` is what let a broken sender go unnoticed.
 */
export async function sendEmailDetailed({
  to,
  subject,
  html,
  replyTo,
  tags,
}: SendEmailParams): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { RESEND_API_KEY, FROM_EMAIL, SUPPORT_EMAIL } = getEmailConfig();
  if (!RESEND_API_KEY) {
    const error = "RESEND_API_KEY is not configured";
    console.warn("[email]", error);
    return { ok: false, error };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
        reply_to: replyTo || SUPPORT_EMAIL,
        tags,
      }),
    });

    const body = await res.text();
    if (!res.ok) {
      const error = `Resend ${res.status}: ${body.slice(0, 300)}`;
      console.error("[email] Failed to send:", error);
      return { ok: false, error };
    }
    let id: string | undefined;
    try {
      id = (JSON.parse(body) as { id?: string }).id;
    } catch {
      /* body is not JSON — delivery still succeeded */
    }
    return { ok: true, id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[email] Error:", error);
    return { ok: false, error };
  }
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  return (await sendEmailDetailed(params)).ok;
}

// ============================================
// LAYOUT
// ============================================

const C = {
  bg: "#f4f4f7",
  card: "#ffffff",
  ink: "#111118",
  body: "#3f3f46",
  muted: "#71717a",
  line: "#e4e4e7",
  brand: "#7c3aed",
  brandDark: "#5b21b6",
  headerBg: "#0f0f16",
  accentBg: "#f5f3ff",
  success: "#059669",
  warn: "#d97706",
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function button(label: string, href: string, variant: "primary" | "ghost" = "primary"): string {
  const primary = `background:${C.brand};color:#ffffff;border:1px solid ${C.brand};`;
  const ghost = `background:#ffffff;color:${C.brand};border:1px solid ${C.brand};`;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr><td style="border-radius:8px;${variant === "primary" ? primary : ghost}">
        <a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;text-decoration:none;color:${variant === "primary" ? "#ffffff" : C.brand};border-radius:8px;">${esc(label)}</a>
      </td></tr>
    </table>`;
}

export function h1(text: string): string {
  return `<h1 style="margin:0 0 12px;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:700;color:${C.ink};">${text}</h1>`;
}

export function p(text: string, opts: { muted?: boolean; size?: number } = {}): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:${opts.size || 15}px;line-height:1.6;color:${opts.muted ? C.muted : C.body};">${text}</p>`;
}

/** Key/value rows — receipts and summaries. */
export function detailsTable(rows: Array<[string, string]>): string {
  const tr = rows
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:14px;color:${C.muted};">${esc(k)}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:14px;font-weight:600;color:${C.ink};">${v}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">${tr}</table>`;
}

/** A soft highlighted box for the one number that matters. */
export function callout(label: string, value: string, sub?: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr><td style="background:${C.accentBg};border:1px solid #ddd6fe;border-radius:10px;padding:18px 20px;">
        <div style="font-family:${FONT};font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.brandDark};font-weight:700;">${esc(label)}</div>
        <div style="font-family:${FONT};font-size:28px;line-height:1.2;font-weight:800;color:${C.ink};margin-top:4px;">${value}</div>
        ${sub ? `<div style="font-family:${FONT};font-size:13px;color:${C.muted};margin-top:4px;">${sub}</div>` : ""}
      </td></tr>
    </table>`;
}

/** Numbered or feature rows with an emoji lead. */
export function featureList(items: Array<{ icon: string; title: string; text: string; href?: string }>): string {
  const rows = items
    .map(
      (it) => `
      <tr>
        <td valign="top" width="40" style="padding:10px 12px 10px 0;font-size:22px;line-height:1;">${it.icon}</td>
        <td valign="top" style="padding:10px 0;border-bottom:1px solid ${C.line};">
          <div style="font-family:${FONT};font-size:15px;font-weight:700;color:${C.ink};">${it.href ? `<a href="${it.href}" style="color:${C.ink};text-decoration:none;">${esc(it.title)}</a>` : esc(it.title)}</div>
          <div style="font-family:${FONT};font-size:14px;line-height:1.5;color:${C.body};margin-top:2px;">${it.text}</div>
        </td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;">${rows}</table>`;
}

export function layout(opts: { preheader?: string; content: string; marketing?: boolean; unsubscribeUrl?: string }): string {
  const { APP_URL, SUPPORT_EMAIL } = getEmailConfig();
  const year = new Date().getFullYear();
  const footerNote = opts.marketing
    ? `You're receiving this because you have an iVideo Studio account. <a href="${opts.unsubscribeUrl || `${APP_URL}/settings`}" style="color:${C.muted};">Unsubscribe from product updates</a>.`
    : `This is a service email about your iVideo Studio account. Questions? Reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.muted};">${SUPPORT_EMAIL}</a>.`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>iVideo Studio</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(opts.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
    <!-- header -->
    <tr><td style="background:${C.headerBg};border-radius:14px 14px 0 0;padding:22px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:10px;"><div style="width:30px;height:30px;border-radius:8px;background:${C.brand};text-align:center;line-height:30px;font-family:${FONT};font-weight:800;color:#fff;font-size:16px;">iV</div></td>
        <td><a href="${APP_URL}" style="font-family:${FONT};font-size:18px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:-.01em;">iVideo Studio</a></td>
      </tr></table>
    </td></tr>
    <!-- body -->
    <tr><td style="background:${C.card};padding:36px 32px 28px;border-left:1px solid ${C.line};border-right:1px solid ${C.line};">
      ${opts.content}
    </td></tr>
    <!-- footer -->
    <tr><td style="background:${C.card};border:1px solid ${C.line};border-top:0;border-radius:0 0 14px 14px;padding:20px 32px 26px;">
      <p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};">${footerNote}</p>
      <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};">© ${year} iVideo Studio · DEVEDGE SOLUTIONS · South Africa · <a href="${APP_URL}" style="color:${C.muted};">ivideostudio.ai</a></p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function money(amountCents: number, currency = "ZAR"): string {
  const n = (amountCents / 100).toFixed(2);
  return currency === "ZAR" ? `R${n}` : `${currency} ${n}`;
}

function dateZA(d: Date = new Date()): string {
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

// ============================================
// ACCOUNT EMAILS
// ============================================

export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const { APP_URL } = getEmailConfig();
  const first = (name || "there").split(" ")[0];
  return sendEmail({
    to: email,
    subject: "Welcome to iVideo Studio — your first 100 credits are in",
    tags: [{ name: "type", value: "welcome" }],
    html: layout({
      preheader: "100 free credits are waiting. Here's the fastest way to your first video.",
      content: `
        ${h1(`Welcome, ${esc(first)}.`)}
        ${p(`You now have an iVideo Studio account with <strong>100 free credits</strong> — enough for your first videos, a voiceover and captions. Nothing expires while you learn the tools.`)}
        ${callout("Your balance", "100 credits", "Credits you buy never expire.")}
        ${p("<strong>Three things to try in your first ten minutes</strong>")}
        ${featureList([
          { icon: "🎬", title: "Generate a video from text", text: "Describe a scene, pick a style, get a cinematic clip with sound in about a minute.", href: `${APP_URL}/generate` },
          { icon: "🗣️", title: "Make a photo talk", text: "Upload a face and a script — AI Avatar lip-syncs it in your chosen voice, including South African English.", href: `${APP_URL}/talking-avatar` },
          { icon: "🧰", title: "Creator Tools", text: "Add sound to a silent clip, remove a background, dub into Portuguese or French, or make an amapiano beat in 30 seconds.", href: `${APP_URL}/tools` },
        ])}
        ${button("Create your first video", `${APP_URL}/generate`)}
        ${p(`<br>Stuck on anything? Just reply to this email — a real person reads it.`, { muted: true, size: 13 })}
      `,
    }),
  });
}

export async function sendVideoReadyEmail(email: string, name: string, videoId: string): Promise<boolean> {
  const { APP_URL } = getEmailConfig();
  const first = (name || "there").split(" ")[0];
  const watch = `${APP_URL}/gallery?video=${encodeURIComponent(videoId)}`;
  return sendEmail({
    to: email,
    subject: "Your video is ready ▶",
    tags: [{ name: "type", value: "video_ready" }],
    html: layout({
      preheader: "Rendering finished — your video is in your gallery, ready to download or share.",
      content: `
        ${h1(`It's ready, ${esc(first)}.`)}
        ${p("Your video has finished rendering and is saved in your gallery. Download it, post it, or run it through Creator Tools to add captions, sound or a new language.")}
        ${button("Watch your video", watch)}
        <div style="height:20px;"></div>
        ${featureList([
          { icon: "💬", title: "Add captions", text: "Reels get watched on mute — auto-captions take 30 seconds.", href: `${APP_URL}/captions` },
          { icon: "🔊", title: "Add sound", text: "Give a silent clip realistic ambience and effects.", href: `${APP_URL}/tools` },
        ])}
      `,
    }),
  });
}

export async function sendLowCreditsEmail(email: string, name: string, balance: number): Promise<boolean> {
  const { APP_URL } = getEmailConfig();
  const first = (name || "there").split(" ")[0];
  return sendEmail({
    to: email,
    subject: `${balance} credits left — top up before your next video`,
    tags: [{ name: "type", value: "low_credits" }],
    html: layout({
      preheader: "You're running low. Packs from R185 and credits never expire.",
      content: `
        ${h1("Running low on credits")}
        ${p(`Hi ${esc(first)}, you have <strong>${balance} credits</strong> left — a standard video costs 80. Top up now so your next idea doesn't have to wait.`)}
        ${callout("Balance", `${balance} credits`)}
        ${detailsTable([
          ["500 credits", "R185"],
          ["2,000 credits", "R650"],
          ["10,000 credits", "R2,400"],
        ])}
        ${button("Top up credits", `${APP_URL}/pricing`)}
        ${p("<br>Credits you buy never expire, and a Creator plan (R220/month) gives you 500 every month plus premium models.", { muted: true, size: 13 })}
      `,
    }),
  });
}

// ============================================
// BILLING EMAILS
// ============================================

export interface ReceiptInfo {
  amountCents?: number;
  currency?: string;
  reference?: string;
  provider?: string;
  paidAt?: Date;
}

export async function sendPlanUpgradeEmail(
  email: string,
  name: string,
  plan: string,
  receipt: ReceiptInfo = {},
  expiresAt?: string
): Promise<boolean> {
  const { APP_URL } = getEmailConfig();
  const first = (name || "there").split(" ")[0];
  const planCredits: Record<string, number> = { Creator: 500, Pro: 2000, Studio: 8000 };
  const credits = planCredits[plan] || 0;
  const rows: Array<[string, string]> = [["Plan", `${esc(plan)} (monthly)`]];
  if (receipt.amountCents) rows.push(["Amount paid", money(receipt.amountCents, receipt.currency)]);
  rows.push(["Date", dateZA(receipt.paidAt)]);
  if (receipt.reference) rows.push(["Reference", `<span style="font-family:Menlo,Consolas,monospace;font-size:12px;">${esc(receipt.reference)}</span>`]);
  if (expiresAt) rows.push(["Active until", dateZA(new Date(expiresAt))]);

  return sendEmail({
    to: email,
    subject: `Receipt — ${plan} plan activated`,
    tags: [{ name: "type", value: "plan_receipt" }],
    html: layout({
      preheader: `Thanks ${first} — your ${plan} plan is active and ${credits} credits have been added.`,
      content: `
        ${h1(`You're on ${esc(plan)}. Thank you.`)}
        ${p(`Hi ${esc(first)}, your payment went through and your plan is active. This email is your receipt — keep it for your records.`)}
        ${callout("Credits added", `+${credits.toLocaleString()}`, "Added to your balance now, and again every month while the plan is active.")}
        ${detailsTable(rows)}
        ${p("<strong>What's now unlocked</strong>")}
        ${featureList([
          { icon: "🎥", title: "Premium video engines", text: "Cinematic 1080p generation with native sound." },
          { icon: "🗣️", title: "AI Avatar & AI Singer", text: "Make any face speak or sing — your script, your voice." },
          { icon: "🧰", title: "Pro Creator Tools", text: "Dubbing, video background removal, lip-sync and 4K upscaling." },
        ])}
        ${button("Start creating", `${APP_URL}/generate`)}
      `,
    }),
  });
}

export async function sendCreditPackReceiptEmail(
  email: string,
  name: string,
  credits: number,
  newBalance: number,
  receipt: ReceiptInfo = {}
): Promise<boolean> {
  const { APP_URL } = getEmailConfig();
  const first = (name || "there").split(" ")[0];
  const rows: Array<[string, string]> = [["Item", `${credits.toLocaleString()} credit pack`]];
  if (receipt.amountCents) rows.push(["Amount paid", money(receipt.amountCents, receipt.currency)]);
  rows.push(["Date", dateZA(receipt.paidAt)]);
  if (receipt.reference) rows.push(["Reference", `<span style="font-family:Menlo,Consolas,monospace;font-size:12px;">${esc(receipt.reference)}</span>`]);
  rows.push(["New balance", `${newBalance.toLocaleString()} credits`]);

  return sendEmail({
    to: email,
    subject: `Receipt — ${credits.toLocaleString()} credits added`,
    tags: [{ name: "type", value: "pack_receipt" }],
    html: layout({
      preheader: `Payment received. ${credits.toLocaleString()} credits are in your account and never expire.`,
      content: `
        ${h1("Payment received — thank you.")}
        ${p(`Hi ${esc(first)}, your credits are in your account and ready to use. This email is your receipt.`)}
        ${callout("Credits added", `+${credits.toLocaleString()}`, "Purchased credits never expire.")}
        ${detailsTable(rows)}
        ${button("Start creating", `${APP_URL}/generate`)}
      `,
    }),
  });
}

export async function sendPlanExpiringEmail(email: string, name: string, plan: string, expiresAt: string): Promise<boolean> {
  const { APP_URL } = getEmailConfig();
  const first = (name || "there").split(" ")[0];
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  const date = dateZA(new Date(expiresAt));
  return sendEmail({
    to: email,
    subject: `Your ${planName} plan ends on ${date}`,
    tags: [{ name: "type", value: "plan_expiring" }],
    html: layout({
      preheader: `Renew before ${date} to keep premium models and next month's credits.`,
      content: `
        ${h1(`Keep ${esc(planName)} going`)}
        ${p(`Hi ${esc(first)}, your <strong>${esc(planName)}</strong> month ends on <strong>${date}</strong>. Renew before then and your premium models and next credit grant carry on without a gap.`)}
        ${detailsTable([["Plan", planName], ["Ends", date], ["Your current credits", "Stay yours either way"]])}
        ${button(`Renew ${planName}`, `${APP_URL}/pricing`)}
      `,
    }),
  });
}

export async function sendPlanExpiredEmail(email: string, name: string, plan: string): Promise<boolean> {
  const { APP_URL } = getEmailConfig();
  const first = (name || "there").split(" ")[0];
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  return sendEmail({
    to: email,
    subject: `Your ${planName} plan has ended`,
    tags: [{ name: "type", value: "plan_expired" }],
    html: layout({
      preheader: "Your account is back on Free. Your credits are safe. Renew any time.",
      content: `
        ${h1(`Your ${esc(planName)} plan has ended`)}
        ${p(`Hi ${esc(first)}, your ${esc(planName)} month is over, so your account is back on the Free plan. Every credit you still have is safe — credits never expire. Renew whenever you're ready and premium models and your monthly credits return immediately.`)}
        ${button(`Renew ${planName}`, `${APP_URL}/pricing`)}
      `,
    }),
  });
}

export async function sendSupportReply(email: string, name: string, reply: string, originalMessage: string): Promise<boolean> {
  const { APP_URL } = getEmailConfig();
  const first = (name || "there").split(" ")[0];
  return sendEmail({
    to: email,
    subject: "Re: your iVideo Studio support request",
    tags: [{ name: "type", value: "support" }],
    html: layout({
      preheader: "We've replied to your message.",
      content: `
        ${h1("Here's our reply")}
        ${p(`Hi ${esc(first)}, thanks for getting in touch.`)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
          <tr><td style="background:${C.accentBg};border-left:4px solid ${C.brand};border-radius:6px;padding:16px 18px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.ink};">${esc(reply).replace(/\n/g, "<br>")}</td></tr>
        </table>
        ${p("Your original message:", { muted: true, size: 13 })}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
          <tr><td style="background:#fafafa;border:1px solid ${C.line};border-radius:6px;padding:12px 14px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${esc(originalMessage.slice(0, 600))}</td></tr>
        </table>
        ${p("Need more help? Just reply to this email.")}
        ${button("Back to iVideo Studio", `${APP_URL}/dashboard`, "ghost")}
      `,
    }),
  });
}

// ============================================
// MARKETING — product updates
// ============================================

export interface ProductUpdateItem {
  icon: string;
  title: string;
  text: string;
  href: string;
}

export interface ProductUpdate {
  subject: string;
  preheader: string;
  headline: string;
  intro: string;
  items: ProductUpdateItem[];
  ctaLabel: string;
  ctaHref: string;
  outro?: string;
}

/** The current "what's new" campaign. Edit here; /api/admin/broadcast sends it. */
export function newToolsUpdate(appUrl: string): ProductUpdate {
  return {
    subject: "New in iVideo Studio: Creator Tools, AI Singer and real lip-sync",
    preheader: "Add sound, dub into other languages, make an amapiano beat, remove backgrounds — all in one click.",
    headline: "Seven new tools built for South African creators",
    intro:
      "We've spent the past weeks rebuilding the studio around what creators here actually ship every day: reels that need sound, products that need clean cut-outs, videos that need to reach Mozambique and Nigeria as well as Joburg. Everything below is live now.",
    items: [
      { icon: "🔊", title: "Add Sound to Video", text: "AI-generated clips are silent. Describe the scene — \"taxi rank at rush hour\" — and get synced ambience and effects. 5 credits.", href: `${appUrl}/tools` },
      { icon: "🌍", title: "Translate & Dub", text: "Your video, your voice, in Portuguese, French, Spanish and 7 more — no re-shoot. Reach Maputo, Luanda and Lagos.", href: `${appUrl}/tools` },
      { icon: "🎹", title: "AI Beat & Song Maker", text: "Amapiano, gqom, kwaito, afrobeats, gospel. Type a hook or let it write the lyrics — royalty-free track in 30 seconds. 8 credits.", href: `${appUrl}/tools` },
      { icon: "✂️", title: "Remove Background", text: "Photo cut-outs for your shop listings (2 credits) and green-screen-free video for your reels.", href: `${appUrl}/tools` },
      { icon: "🗣️", title: "AI Avatar with real lip-sync", text: "Upload a face, paste a script, choose a voice (yes, SA English) — mouth movement now actually matches the words.", href: `${appUrl}/talking-avatar` },
      { icon: "🎤", title: "AI Singer", text: "Your face sings your lyrics in your genre. Made for birthday videos, artist teasers and church announcements.", href: `${appUrl}/ai-singer` },
      { icon: "💳", title: "Pay the South African way", text: "Instant EFT, SnapScan, Zapper, Mobicred and cards via PayFast. Credits never expire.", href: `${appUrl}/pricing` },
    ],
    ctaLabel: "Open Creator Tools",
    ctaHref: `${appUrl}/tools`,
    outro: "Every tool only charges credits when it succeeds — if a job fails, the credits come straight back. Reply to this email and tell us what you'd like next.",
  };
}

/**
 * The Series Studio launch. Not a tool list — a pitch for a different way of
 * working, so it argues one idea (a series, not a clip) and leads with the
 * language, because that is the part nobody else offers here.
 */
export function seriesStudioUpdate(appUrl: string): ProductUpdate {
  return {
    subject: "Make a drama in isiZulu — episode after episode",
    preheader:
      "Series Studio is live: same characters, a story that continues, real lip-sync, English subtitles.",
    headline: "Your own series, in your own language",
    intro:
      "One clip gets you a view. A series gets you an audience that comes back every week. Series Studio writes your story in isiZulu, Afrikaans or South African English, keeps the same characters across every episode, and makes them actually speak — with lip movement that matches the words.",
    items: [
      {
        icon: "🎬",
        title: "A story that continues",
        text: "Episode 7 knows what happened in episode 1. We keep the recap, the cast and the loose ends, so it reads like a real series instead of unrelated clips.",
        href: `${appUrl}/series`,
      },
      {
        icon: "🗣️",
        title: "Characters who speak your language",
        text: "isiZulu, Afrikaans and SA English up front, plus 137 more languages — every one of them actually spoken, with lip movement that matches. Not a voice over a still picture.",
        href: `${appUrl}/series`,
      },
      {
        icon: "💬",
        title: "English subtitles, automatically",
        text: "Every line is translated as it is written, so a drama in isiZulu still reaches the whole country, not only the people who speak it.",
        href: `${appUrl}/series`,
      },
      {
        icon: "👤",
        title: "The same face, every episode",
        text: "Describe your lead once. Those exact words go into every shot of every episode, so they stay recognisable as the series grows.",
        href: `${appUrl}/series`,
      },
      {
        icon: "📅",
        title: "Plan a season, make it slowly",
        text: "Write five episodes for 50 credits, read them all, then make them one at a time whenever you are ready. The scripts wait for you.",
        href: `${appUrl}/series`,
      },
    ],
    ctaLabel: "Start your series",
    ctaHref: `${appUrl}/series`,
    outro:
      "Writing is almost free — you only pay when you turn an episode into video, and the price is on the button before you press it. Tell us what your series is about, we read every reply.",
  };
}

export async function sendProductUpdateEmail(
  email: string,
  name: string,
  update: ProductUpdate,
  unsubscribeUrl?: string
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const first = (name || "there").split(" ")[0];
  return sendEmailDetailed({
    to: email,
    subject: update.subject,
    tags: [{ name: "type", value: "product_update" }],
    html: layout({
      marketing: true,
      unsubscribeUrl,
      preheader: update.preheader,
      content: `
        <div style="font-family:${FONT};font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.brandDark};font-weight:700;margin-bottom:8px;">What's new</div>
        ${h1(esc(update.headline))}
        ${p(`Hi ${esc(first)}, ${update.intro}`)}
        ${featureList(update.items)}
        ${button(update.ctaLabel, update.ctaHref)}
        ${update.outro ? p(`<br>${update.outro}`, { muted: true, size: 13 }) : ""}
      `,
    }),
  });
}
