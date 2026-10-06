// ============================================
// GENESIS STUDIO — Abandoned-checkout recovery
// ============================================
// Someone who opens a checkout and leaves is the warmest lead there is: they
// chose a pack and an amount. Until now nobody ever heard from us again.
// (5 Oct 2026: a French-speaking teacher picked R650 three minutes after
// signing up, then left. Four real checkouts before her went the same way.)
//
// Two emails, never more, run from the 5-minute reconcile cron:
//
//   Step 1  ~45 min after the checkout: "did something go wrong?" with a
//           one-tap link back to the exact pack, the payment options, and,
//           for anyone outside SA, how paying in rands works.
//   Step 2  ~22 h after step 1, if still unpaid: the last nudge, offering
//           the R49 starter pack as a smaller first step.
//
// Guards: owner/test accounts and suspended accounts never get mail; anyone
// who has paid since is skipped; one recovery sequence per person per 7 days;
// opt-outs respected; a hard cap per run. Every send is recorded in
// email_sends (campaign recover-1 / recover-2) so a re-run never double-sends.
// The person's language (French or English) is read from what they wrote.

import { getD1 } from "@/lib/d1";
import { initCloudflareEnv } from "@/lib/cf-env";
import { isOwnerClerkId } from "@/lib/credits";
import { CREDIT_PACKS, PLANS, STARTER_PACK_ID } from "@/lib/constants";
import { sendEmailDetailed, layout, h1, p, button } from "@/lib/email";
import { unsubscribeUrl } from "@/lib/unsubscribe";

const STEP1_AFTER_MIN = 45;
const STEP1_WINDOW_H = 48;
const STEP2_AFTER_H = 22;
const STEP2_WINDOW_H = 72;
const COOLDOWN_DAYS = 7;
const MAX_PER_RUN = 10;
// Checkouts from before this went live were followed up by hand (6 Oct 2026),
// so the automation starts from here and never doubles a personal email.
const RECOVERY_SINCE = "2026-10-06 08:00:00";

type Lang = "en" | "fr";

interface Candidate {
  checkout_id: string;
  user_id: string;
  type: string;
  product_id: string;
  amount: number;
  created_at: string;
  email: string;
  name: string;
  clerk_id: string;
  credit_balance: number;
}

interface Context {
  lang: Lang;
  abroad: boolean;
  lastPrompt: string | null;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const FRENCH_HINT = /\b(le|la|les|des|une|pour|avec|dans|et|est|qui|sur|enfants?|histoire)\b|[éèêàçùœ]/gi;

/** French if their own words are French, or their browser says so. */
export function detectLang(text: string | null, acceptLanguage: string | null): Lang {
  if (acceptLanguage && /^fr\b/i.test(acceptLanguage.trim())) return "fr";
  if (text && (text.match(FRENCH_HINT) || []).length >= 4) return "fr";
  return "en";
}

/** A short, clean quote of what they made, for "your video about …". */
export function promptSnippet(prompt: string | null): string | null {
  if (!prompt) return null;
  const titled = prompt.match(/[«"“]\s*([^»"”]{4,60})\s*[»"”]/);
  const base = (titled ? titled[1] : prompt).replace(/[\s"«»“”]+/g, " ").trim();
  if (base.length < 4) return null;
  return base.length > 60 ? `${base.slice(0, 57).trimEnd()}…` : base;
}

function productLabel(c: Candidate, lang: Lang): string {
  if (c.type === "subscription") {
    const plan = PLANS.find((x) => x.id === c.product_id);
    const name = plan?.name || c.product_id;
    return lang === "fr" ? `l'abonnement ${name}` : `the ${name} plan`;
  }
  const pack = CREDIT_PACKS.find((x) => x.id === c.product_id);
  const credits = (pack?.credits || 0).toLocaleString("en-ZA");
  return lang === "fr" ? `le pack de ${credits} crédits` : `the ${credits}-credit pack`;
}

function rand(cents: number): string {
  return `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;
}

function usdApprox(c: Candidate): string | null {
  const pack = CREDIT_PACKS.find((x) => x.id === c.product_id);
  if (pack) return `$${pack.price}`;
  const plan = PLANS.find((x) => x.id === c.product_id);
  return plan ? `$${plan.price}` : null;
}

function resumeUrl(appUrl: string, c: Candidate, step: 1 | 2, packOverride?: string): string {
  if (c.type === "subscription" && !packOverride) return `${appUrl}/pricing?src=recover${step}`;
  const pack = packOverride || c.product_id;
  return `${appUrl}/generate?topup=1&pack=${encodeURIComponent(pack)}&src=recover${step}`;
}

export function buildRecoveryEmail(
  step: 1 | 2,
  c: Candidate,
  ctx: Context,
  appUrl: string
): { subject: string; preheader: string; content: string } {
  const first = esc((c.name || "").split(" ")[0] || (ctx.lang === "fr" ? "" : "there"));
  const product = productLabel(c, ctx.lang);
  const price = rand(c.amount);
  const usd = usdApprox(c);
  const made = ctx.lastPrompt ? esc(ctx.lastPrompt) : null;
  const starter = CREDIT_PACKS.find((x) => x.id === STARTER_PACK_ID)!;
  const offerStarter = step === 2 && c.product_id !== STARTER_PACK_ID;

  if (ctx.lang === "fr") {
    const hello = first ? `Bonjour ${first},` : "Bonjour,";
    const abroad = ctx.abroad
      ? p(`<strong>Vous payez depuis l'étranger ?</strong> Le paiement se fait en rands sud-africains (${price}${usd ? `, environ ${usd}` : ""}). Les cartes Visa et Mastercard de la plupart des pays fonctionnent : votre banque fait la conversion. Si votre carte est refusée, répondez simplement à cet e-mail et nous trouverons une solution avec vous.`)
      : "";
    if (step === 1) {
      return {
        subject: "Un souci avec votre paiement ?",
        preheader: `Vous avez choisi ${product} (${price}). Reprenez en un clic.`,
        content: `
          ${h1("Votre commande vous attend")}
          ${p(`${hello} vous avez choisi ${product} (${price}) sur iVideo Studio, mais le paiement n'a pas été finalisé. Aucun montant n'a été débité.`)}
          ${made ? p(`Votre projet « ${made} » est bien parti : avec plus de crédits, vous pouvez créer les scènes suivantes.`) : ""}
          ${button("Reprendre ma commande", resumeUrl(appUrl, c, 1))}
          ${abroad}
          ${p("Paiement sécurisé par PayFast : carte bancaire, EFT instantané. Les crédits n'expirent jamais.", { muted: true, size: 13 })}
          ${p("Une question, un blocage ? Répondez à cet e-mail : il arrive directement chez nous.", { muted: true, size: 13 })}
        `,
      };
    }
    return {
      subject: offerStarter ? `Commencez plus petit : ${starter.credits} crédits pour R${starter.priceZAR}` : "Vos crédits sont à un clic",
      preheader: offerStarter ? "Un premier pas plus léger, sans abonnement." : "Votre commande est toujours prête.",
      content: `
        ${h1(offerStarter ? "Un premier pas plus léger" : "Toujours partant ?")}
        ${p(`${hello} ${offerStarter ? `si ${price} c'est trop pour commencer, essayez le pack découverte : <strong>${starter.credits} crédits pour R${starter.priceZAR}</strong> (environ $${starter.price}), soit environ quatre vidéos. Paiement unique, sans abonnement.` : `votre ${product.replace(/^le /, "")} est toujours disponible, en un clic.`}`)}
        ${button(offerStarter ? `${starter.credits} crédits pour R${starter.priceZAR}` : "Finaliser ma commande", resumeUrl(appUrl, c, 2, offerStarter ? STARTER_PACK_ID : undefined))}
        ${abroad}
        ${p("C'est notre dernier rappel à ce sujet. Répondez à cet e-mail si nous pouvons vous aider.", { muted: true, size: 13 })}
      `,
    };
  }

  const hello = `Hi ${first},`;
  const abroad = ctx.abroad
    ? p(`<strong>Paying from outside South Africa?</strong> Payment is in South African rand (${price}${usd ? `, about ${usd}` : ""}). Visa and Mastercard from most countries work and your bank converts it. If your card is declined, just reply to this email and we'll sort it out with you.`)
    : "";
  if (step === 1) {
    return {
      subject: "Did something go wrong with your payment?",
      preheader: `You picked ${product} (${price}). Pick up where you left off in one tap.`,
      content: `
        ${h1("Your order is waiting")}
        ${p(`${hello} you chose ${product} (${price}) on iVideo Studio, but the payment wasn't finished. Nothing was charged.`)}
        ${made ? p(`Your video "${made}" is off to a great start. More credits let you make the next scenes.`) : ""}
        ${button("Finish my order", resumeUrl(appUrl, c, 1))}
        ${abroad}
        ${p("Secure checkout by PayFast: card, Instant EFT, SnapScan or Zapper. Credits never expire.", { muted: true, size: 13 })}
        ${p("Stuck on something? Reply to this email. It comes straight to us.", { muted: true, size: 13 })}
      `,
    };
  }
  return {
    subject: offerStarter ? `Start smaller: ${starter.credits} credits for R${starter.priceZAR}` : "Your credits are one tap away",
    preheader: offerStarter ? "A lighter first step. One payment, no subscription." : "Your order is still ready.",
    content: `
      ${h1(offerStarter ? "A lighter first step" : "Still keen?")}
      ${p(`${hello} ${offerStarter ? `if ${price} is a lot to start with, try the starter pack: <strong>${starter.credits} credits for R${starter.priceZAR}</strong>, about four videos. One payment, no subscription.` : `${product} is still one tap away.`}`)}
      ${button(offerStarter ? `Get ${starter.credits} credits for R${starter.priceZAR}` : "Finish my order", resumeUrl(appUrl, c, 2, offerStarter ? STARTER_PACK_ID : undefined))}
      ${abroad}
      ${p("This is our last reminder about it. Reply if there's anything we can help with.", { muted: true, size: 13 })}
    `,
  };
}

// The owner's own addresses (same list the abuse sweep protects). PayFast
// refuses payments from the merchant's own email, so the owner's test
// checkouts always "abandon" and must never trigger a recovery email.
const OWNER_EMAILS = ["mdlulipenuel@gmail.com", "mdlulispm@gmail.com", "iteverycode@gmail.com"];

function excluded(c: Candidate): boolean {
  if (isOwnerClerkId(c.clerk_id)) return true;
  const blocked = [...OWNER_EMAILS, process.env.OWNER_EMAIL, process.env.SUPPORT_EMAIL, process.env.RECOVERY_EXCLUDE_EMAILS]
    .filter(Boolean)
    .join(",")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return blocked.includes(c.email.toLowerCase());
}

async function contextFor(userId: string): Promise<Context> {
  const db = getD1();
  const job = await db
    .prepare(`SELECT prompt FROM generation_jobs WHERE user_id = ? AND prompt IS NOT NULL ORDER BY created_at DESC LIMIT 1`)
    .bind(userId)
    .first<{ prompt: string }>();
  const sig = await db
    .prepare(`SELECT country, accept_language FROM signup_signals WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`)
    .bind(userId)
    .first<{ country: string | null; accept_language: string | null }>();
  const lang = detectLang(job?.prompt || null, sig?.accept_language || null);
  const country = (sig?.country || "").toUpperCase();
  return {
    lang,
    // Unknown country + French writing almost certainly means not South African.
    abroad: (country !== "" && country !== "ZA" && country !== "XX") || (country === "" && lang === "fr"),
    lastPrompt: promptSnippet(job?.prompt || null),
  };
}

const CANDIDATE_COLS = `c.id AS checkout_id, c.user_id, c.type, c.product_id, c.amount, c.created_at,
  u.email, u.name, u.clerk_id, u.credit_balance`;

/** Paid since `since`? Then there is nothing to recover. */
const NOT_PAID_SINCE = (col: string) => `NOT EXISTS (SELECT 1 FROM pending_checkouts p2
  WHERE p2.user_id = u.id AND p2.status = 'completed' AND p2.created_at >= ${col})`;

export async function runCheckoutRecovery(appUrl: string): Promise<{ step1: number; step2: number; skipped: number; errors: string[] }> {
  initCloudflareEnv();
  const db = getD1();
  const out = { step1: 0, step2: 0, skipped: 0, errors: [] as string[] };

  // Step 1: the latest unpaid checkout per person, 45 min to 48 h old, no
  // recovery email in the last week.
  const step1 = await db
    .prepare(
      `SELECT ${CANDIDATE_COLS} FROM pending_checkouts c JOIN users u ON u.id = c.user_id
       WHERE c.status IN ('pending','failed')
         AND c.created_at <= datetime('now', '-${STEP1_AFTER_MIN} minutes')
         AND c.created_at >= datetime('now', '-${STEP1_WINDOW_H} hours')
         AND c.created_at >= '${RECOVERY_SINCE}'
         AND COALESCE(u.suspended, 0) = 0
         AND c.created_at = (SELECT MAX(c2.created_at) FROM pending_checkouts c2 WHERE c2.user_id = c.user_id)
         AND ${NOT_PAID_SINCE("c.created_at")}
         AND NOT EXISTS (SELECT 1 FROM email_sends e WHERE e.user_id = u.id
               AND e.campaign IN ('recover-1','recover-2') AND e.sent_at >= datetime('now', '-${COOLDOWN_DAYS} days'))
         AND NOT EXISTS (SELECT 1 FROM email_optouts o WHERE o.user_id = u.id)
       ORDER BY c.created_at ASC LIMIT 25`
    )
    .all<Candidate>();

  // Step 2: got step 1 22-72 h ago, nothing since, still unpaid.
  const step2 = await db
    .prepare(
      `SELECT ${CANDIDATE_COLS}, e.sent_at AS step1_at FROM email_sends e
       JOIN users u ON u.id = e.user_id
       JOIN pending_checkouts c ON c.user_id = u.id
         AND c.created_at = (SELECT MAX(c2.created_at) FROM pending_checkouts c2 WHERE c2.user_id = u.id)
       WHERE e.campaign = 'recover-1'
         AND e.sent_at <= datetime('now', '-${STEP2_AFTER_H} hours')
         AND e.sent_at >= datetime('now', '-${STEP2_WINDOW_H} hours')
         AND c.status IN ('pending','failed')
         AND COALESCE(u.suspended, 0) = 0
         AND ${NOT_PAID_SINCE("e.sent_at")}
         AND ${NOT_PAID_SINCE("c.created_at")}
         AND NOT EXISTS (SELECT 1 FROM email_sends e2 WHERE e2.user_id = u.id AND e2.campaign = 'recover-2'
               AND e2.sent_at >= datetime('now', '-${COOLDOWN_DAYS} days'))
         AND NOT EXISTS (SELECT 1 FROM email_optouts o WHERE o.user_id = u.id)
       LIMIT 25`
    )
    .all<Candidate>();

  const queue: Array<{ step: 1 | 2; c: Candidate }> = [
    ...(step2.results || []).map((c) => ({ step: 2 as const, c })),
    ...(step1.results || []).map((c) => ({ step: 1 as const, c })),
  ];

  let sent = 0;
  for (const { step, c } of queue) {
    if (sent >= MAX_PER_RUN) break;
    if (!c.email || excluded(c)) {
      out.skipped++;
      continue;
    }
    try {
      const ctx = await contextFor(c.user_id);
      const mail = buildRecoveryEmail(step, c, ctx, appUrl);
      const unsub = await unsubscribeUrl(appUrl, c.user_id);
      const r = await sendEmailDetailed({
        to: c.email,
        subject: mail.subject,
        tags: [{ name: "type", value: `checkout_recovery_${step}` }],
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        html: layout({ marketing: true, unsubscribeUrl: unsub, preheader: mail.preheader, content: mail.content }),
      });
      if (!r.ok) {
        out.errors.push(`${c.email}: ${r.error || "send failed"}`);
        continue;
      }
      await db
        .prepare(`INSERT INTO email_sends (id, user_id, campaign) VALUES (?, ?, ?)`)
        .bind(crypto.randomUUID(), c.user_id, `recover-${step}`)
        .run();
      sent++;
      if (step === 1) out.step1++;
      else out.step2++;
    } catch (err) {
      out.errors.push(`${c.email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}
