// ============================================
// GENESIS STUDIO — Owner notifications by email
// ============================================
// Slack alerts are easy to miss and the channel is noisy. Anything that
// costs money, blocks a customer, or means the product is down also goes to
// the owner's inbox — with enough detail to act on from a phone.
//
// Deliberately quiet: `severity: "info"` events (a sale) are worth knowing
// about; "warning" needs a look today; "critical" means revenue is stopping
// right now. Nothing else sends mail.

import { sendEmail, layout, h1, p, button, detailsTable } from "@/lib/email";

export type OwnerSeverity = "info" | "warning" | "critical";

export interface OwnerNotice {
  subject: string;
  title: string;
  /** HTML — one or two short paragraphs. */
  body: string;
  severity?: OwnerSeverity;
  details?: Array<[string, string]>;
  ctaLabel?: string;
  ctaHref?: string;
}

function ownerEmails(): string[] {
  const raw = process.env.OWNER_EMAIL || process.env.SUPPORT_EMAIL || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const PREFIX: Record<OwnerSeverity, string> = {
  info: "💚",
  warning: "⚠️",
  critical: "🚨",
};

export async function notifyOwner(notice: OwnerNotice): Promise<boolean> {
  const to = ownerEmails();
  if (to.length === 0) {
    console.warn("[owner-notify] OWNER_EMAIL not configured — skipping:", notice.subject);
    return false;
  }
  const severity = notice.severity || "info";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";

  const html = layout({
    preheader: notice.subject,
    content: `
      ${h1(`${PREFIX[severity]} ${notice.title}`)}
      ${p(notice.body)}
      ${notice.details?.length ? detailsTable(notice.details) : ""}
      ${button(notice.ctaLabel || "Open admin dashboard", notice.ctaHref || `${appUrl}/admin`)}
    `,
  });

  const results = await Promise.all(
    to.map((addr) =>
      sendEmail({
        to: addr,
        subject: `[iVideo ${severity}] ${notice.subject}`,
        html,
        tags: [{ name: "type", value: "owner_alert" }],
      })
    )
  );
  return results.every(Boolean);
}
