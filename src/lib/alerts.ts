// ============================================
// GENESIS STUDIO — Operator Alerts (Discord / Slack)
// Discord is free and unlimited. Slack is paid.
// Set DISCORD_WEBHOOK_URL for Discord (recommended).
// Falls back to SLACK_ALERT_WEBHOOK_URL if set.
// ============================================

type AlertLevel = "info" | "warning" | "critical";

interface AlertPayload {
  level: AlertLevel;
  title: string;
  message: string;
  context?: Record<string, unknown>;
  dedupeKey?: string;
}

// In-memory dedupe for one-per-day alerts (e.g. spend cap)
const sentDedupeKeys = new Set<string>();

function getEnvTag(): string {
  const env = process.env.NODE_ENV ?? "local";
  if (env === "production") return "PROD";
  return "LOCAL";
}

const LEVEL_COLORS: Record<AlertLevel, number> = {
  info: 0x7c3aed,     // Violet
  warning: 0xf59e0b,  // Amber
  critical: 0xef4444,  // Red
};

const LEVEL_EMOJI: Record<AlertLevel, string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
};

/**
 * Send an alert to Discord (preferred) or Slack (fallback).
 * Fire-and-forget — never throws.
 */
export async function sendSlackAlert(payload: AlertPayload): Promise<void> {
  const discordUrl = process.env.DISCORD_WEBHOOK_URL;
  const slackUrl = process.env.SLACK_ALERT_WEBHOOK_URL;
  const url = discordUrl || slackUrl;
  if (!url) return;

  // Dedupe: skip if same key already sent this process lifetime
  if (payload.dedupeKey) {
    if (sentDedupeKeys.has(payload.dedupeKey)) return;
    sentDedupeKeys.add(payload.dedupeKey);
  }

  const envTag = getEnvTag();
  const isDiscord = !!discordUrl;

  try {
    if (isDiscord) {
      // Discord webhook — rich embed
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: `${LEVEL_EMOJI[payload.level]} ${payload.title}`,
            description: payload.message.slice(0, 2000),
            color: LEVEL_COLORS[payload.level],
            footer: { text: `${envTag} | Genesis Studio` },
            timestamp: new Date().toISOString(),
            ...(payload.context ? {
              fields: Object.entries(payload.context).slice(0, 5).map(([k, v]) => ({
                name: k,
                value: String(v).slice(0, 200),
                inline: true,
              })),
            } : {}),
          }],
        }),
      });
    } else {
      // Slack webhook — plain text
      const text =
        `${envTag} | ${LEVEL_EMOJI[payload.level]} *${payload.title}*\n${payload.message}` +
        (payload.context
          ? `\n\`\`\`${JSON.stringify(payload.context, null, 2)}\`\`\``
          : "");

      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    }
  } catch (err) {
    console.error("[alerts] Webhook failed:", err);
  }
}
