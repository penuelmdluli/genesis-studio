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
  /** Extra headers, e.g. List-Unsubscribe for marketing email. */
  headers?: Record<string, string>;
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
  headers,
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
        ...(headers ? { headers } : {}),
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

/** Action movie and 3D cartoon series, announced with the films that show them. */
export function actionCartoonUpdate(appUrl: string): ProductUpdate {
  const cdn = "https://cdn.ivideostudio.ai/marketing/ads";
  return {
    subject: "Make your own AI action movie or cartoon series 🎬",
    preheader: "Chases, explosions, talking cartoon heroes: characters who speak, full sound, a movie score. Watch what it makes.",
    headline: "Blockbuster action and 3D cartoons, made by you",
    intro:
      "We made three short films to show what iVideo Studio can do: a rooftop-and-motorbike action movie, a 3D cartoon adventure and a battle between giant machine beasts. No camera, no crew, no animators. Now Series Studio makes them at the same level, episode after episode, with your characters talking, shouting and reacting, lip-synced, over full sound effects and a movie score.",
    items: [
      {
        icon: "🎬",
        title: "Watch: AI Action Movie",
        text: "A night motorbike chase, a rooftop leap and a tunnel explosion, all from a prompt. Then press Create similar and make your own action series.",
        href: `${cdn}/ai-action-movie-9x16.mp4?v=2`,
      },
      {
        icon: "✈️",
        title: "Watch: AI Cartoon Movie",
        text: "A brave little meerkat pilot, a grumpy eagle and a cheering village, in feature-film 3D animation. Kids' stories, adventures and comedies, made by you.",
        href: `${cdn}/ai-cartoon-9x16.mp4?v=2`,
      },
      {
        icon: "🦏",
        title: "Watch: AI Beast Wars",
        text: "A chrome war-rhino against a molten iron lion. Turn your sound on.",
        href: `${cdn}/ai-beast-wars-9x16.mp4?v=2`,
      },
      {
        icon: "🗣️",
        title: "Characters who talk, shout and react",
        text: "People and cartoon characters speak with real lip sync, in English or 139 other languages, and the same voice follows them into every episode.",
        href: `${appUrl}/series`,
      },
      {
        icon: "🔊",
        title: "Full sound, not silent clips",
        text: "Every scene gets its own sound effects (engines, footsteps, wind, crowds) under the dialogue, plus a score made for the genre.",
        href: `${appUrl}/series`,
      },
    ],
    ctaLabel: "Make your action or cartoon series",
    ctaHref: `${appUrl}/series`,
    outro:
      "Open Series Studio, pick Action movie or 3D cartoon, or tap Create similar under any of our films. Writing your episodes is almost free, and the price is on the button before you make the video.",
  };
}

/**
 * Invite friends campaign (2026-09-14). Personal: the WhatsApp button and the
 * link carry this user's own referral code.
 */
export function inviteFriendsUpdate(appUrl: string, invite: { shareUrl: string; whatsappUrl: string }): ProductUpdate {
  return {
    subject: "Invite 5 friends, get 50 free credits 🎁",
    preheader: "Share your link on WhatsApp. Every 5 friends who join earns you 50 credits, with no limit.",
    headline: "Share iVideo Studio, earn free credits",
    intro:
      "Your friends can make AI movies, cartoons, dance reels and ads too. Share your personal link on WhatsApp, in your groups or on your status. Every 5 friends who join earns you 50 free credits, again and again: the more friends, the more credits. Each friend also gets 50 bonus credits when they join.",
    items: [
      {
        icon: "💬",
        title: "Share on WhatsApp in one tap",
        text: "Opens WhatsApp with a ready-made message and your link. Pick friends, family or a whole group.",
        href: invite.whatsappUrl,
      },
      {
        icon: "🔗",
        title: "Your personal invite link",
        text: invite.shareUrl,
        href: invite.shareUrl,
      },
      {
        icon: "🎁",
        title: "5 friends = 50 credits, no limit",
        text: "10 friends is 100 credits, 50 friends is 500. Track who joined on your Invite page.",
        href: `${appUrl}/invite`,
      },
    ],
    ctaLabel: "Share on WhatsApp",
    ctaHref: invite.whatsappUrl,
    outro: "Tip: post your link on your WhatsApp status. Everyone who opens it and joins counts towards your next 50 credits.",
  };
}

/** Tell an inviter a friend joined (and celebrate a reward when one is earned). */
export async function sendInviteCelebrationEmail(opts: {
  email: string;
  name: string;
  friends: number;
  rewardCredits: number;   // 0 when this join did not complete a set of 5
  toNext: number;
  whatsappUrl: string;
}): Promise<boolean> {
  const { APP_URL } = getEmailConfig();
  const first = (opts.name || "there").split(" ")[0];
  const reward = opts.rewardCredits > 0;
  const subject = reward
    ? `⭐🌸 You earned ${opts.rewardCredits} credits, ${first}! ${opts.friends} friends joined`
    : `🌸 A friend just joined with your link (${opts.friends} so far)`;
  return sendEmail({
    to: opts.email,
    subject,
    tags: [{ name: "type", value: "invite_celebration" }],
    html: layout({
      preheader: reward
        ? `${opts.rewardCredits} free credits are already in your account. Keep sharing for more.`
        : `${opts.toNext} more friend${opts.toNext === 1 ? "" : "s"} and you earn 50 free credits.`,
      content: `
        <div style="text-align:center;font-size:34px;line-height:1.2;margin:0 0 8px;">${reward ? "⭐ 🌸 🎉 🌸 ⭐" : "🌸 ✨ 🌸"}</div>
        ${h1(reward ? `Congratulations, ${esc(first)}! You did a great job.` : `Well done, ${esc(first)}! Your invite worked.`)}
        ${p(reward
          ? `<strong>${opts.friends} friends</strong> have joined iVideo Studio with your link, and <strong>${opts.rewardCredits} free credits</strong> are already in your account. Thank you for sharing!`
          : `A friend just joined iVideo Studio with your link. That makes <strong>${opts.friends}</strong>. Just <strong>${opts.toNext} more</strong> and you earn 50 free credits.`)}
        ${callout(reward ? "Added to your balance" : "Next reward", reward ? `+${opts.rewardCredits} credits` : `${opts.toNext} friend${opts.toNext === 1 ? "" : "s"} away`, "Every 5 friends who join earns you another 50 credits. No limit.")}
        ${button("Share again on WhatsApp", opts.whatsappUrl)}
        ${p(`<br><a href="${APP_URL}/invite" style="color:#7c3aed;">See everyone who joined</a>`, { muted: true, size: 13 })}
      `,
    }),
  });
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
    headers: listUnsubscribeHeaders(unsubscribeUrl),
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

/** RFC 8058 one-click unsubscribe, so mail apps show their own Unsubscribe button. */
function listUnsubscribeHeaders(url?: string): Record<string, string> | undefined {
  if (!url || !url.includes("/api/email/unsubscribe")) return undefined;
  return { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

// ============================================
// MARKETING — Feature of the Week
// ============================================

export interface SpotlightEmail {
  subject: string;
  preheader: string;
  emoji: string;
  title: string;
  hook: string;
  benefits: string[];
  idea: string;
  cta: string;
  ctaHref: string;
  cost: string;
  poster: string;
  hasVideo: boolean;
  /** Who we're talking to changes the opening line. */
  segment: "new" | "inactive" | "active";
  inviteHref: string;
}

export async function sendFeatureSpotlightEmail(
  email: string,
  name: string,
  s: SpotlightEmail,
  unsubscribeUrl: string
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const first = esc((name || "there").split(" ")[0]);
  const opener =
    s.segment === "new"
      ? `Hi ${first}, your free credits are still waiting. Here's one of the easiest ways to use them.`
      : s.segment === "inactive"
        ? `Hi ${first}, it's been a while. Here's something worth coming back for.`
        : `Hi ${first}, here's this week's feature. Most creators haven't tried it yet.`;
  const benefits = s.benefits
    .map(
      (b) =>
        `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;font-family:${FONT};font-size:15px;color:${C.success};">✓</td><td style="padding:4px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${C.body};">${esc(b)}</td></tr>`
    )
    .join("");
  return sendEmailDetailed({
    to: email,
    subject: s.subject,
    tags: [{ name: "type", value: "feature_spotlight" }],
    headers: listUnsubscribeHeaders(unsubscribeUrl),
    html: layout({
      marketing: true,
      unsubscribeUrl,
      preheader: s.preheader,
      content: `
        <div style="font-family:${FONT};font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.brandDark};font-weight:700;margin-bottom:8px;">Feature of the week</div>
        ${h1(`${s.emoji} ${esc(s.title)}`)}
        ${p(opener)}
        <a href="${s.ctaHref}" style="display:block;margin:6px 0 18px;text-decoration:none;">
          <img src="${s.poster}" width="536" alt="${esc(s.title)}" style="display:block;width:100%;max-width:536px;height:auto;border-radius:12px;border:0;">
        </a>
        ${p(`<strong style="color:${C.ink};">${esc(s.hook)}</strong>`)}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;">${benefits}</table>
        <div style="background:${C.accentBg};border-radius:12px;padding:16px 18px;margin:0 0 22px;">
          <div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.brandDark};margin-bottom:6px;">💡 Try this idea</div>
          <div style="font-family:${FONT};font-size:15px;line-height:1.55;color:${C.ink};">${esc(s.idea)}</div>
        </div>
        ${button(s.cta, s.ctaHref)}
        ${p(`${esc(s.cost)}. Credits only come off when it works.`, { muted: true, size: 13 })}
        ${p(`<br>🎁 Invite 5 friends and get 50 free credits. <a href="${s.inviteHref}" style="color:${C.brand};font-weight:600;">Get your WhatsApp link</a>`, { muted: true, size: 13 })}
      `,
    }),
  });
}

// ============================================
// MARKETING — Android beta testers
// ============================================

export function androidBetaUpdate(appUrl: string, whatsappShareUrl: string): ProductUpdate {
  const join = `${appUrl}/android-beta?utm_source=ivs&utm_medium=email&utm_campaign=android-beta`;
  return {
    subject: "📱 Be one of the first to test our Android app (+50 free credits)",
    preheader: "iVideo Studio is coming to Google Play. We need Android testers, and it takes 1 minute to join.",
    headline: "iVideo Studio is coming to Google Play",
    intro:
      "our Android app is ready and Google needs a small group of real testers before it goes public. Would you help? It takes a minute, it's free, and as a thank-you we add 50 credits to your account when you join.",
    items: [
      { icon: "✍️", title: "1. Leave your Google Play email", text: "The Gmail you use on your Android phone. We add it to the tester list.", href: join },
      { icon: "📩", title: "2. Get your install link", text: "We email it as soon as Google approves the test, usually within a few days.", href: join },
      { icon: "📱", title: "3. Keep the app for 14 days", text: "Make movies, cartoons and dance reels whenever you like. Google counts testers who stay 14 days.", href: join },
      { icon: "💬", title: "Know someone with Android? Share on WhatsApp", text: "Send the beta to your family and friends groups. The more testers, the sooner everyone gets the app.", href: whatsappShareUrl },
    ],
    ctaLabel: "Join the Android beta",
    ctaHref: join,
    outro: "iPhone user? Nothing to do yet, the website works on every phone. Thank you for building iVideo Studio with us.",
  };
}
