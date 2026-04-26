// ============================================
// GENESIS STUDIO — Operator Alerts (Slack)
// Every message tagged with environment + deployment URL
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
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local";
  if (env === "production") return "PROD";
  if (env === "preview") return "PREVIEW";
  return "LOCAL";
}

function getEnvEmoji(): string {
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local";
  if (env === "production") return ":large_green_circle:";
  if (env === "preview") return ":large_yellow_circle:";
  return ":white_circle:";
}

export async function sendSlackAlert(payload: AlertPayload): Promise<void> {
  const url = process.env.SLACK_ALERT_WEBHOOK_URL;
  if (!url) return;

  // Dedupe: skip if same key already sent this process lifetime
  if (payload.dedupeKey) {
    if (sentDedupeKeys.has(payload.dedupeKey)) return;
    sentDedupeKeys.add(payload.dedupeKey);
  }

  const envEmoji = getEnvEmoji();
  const envTag = getEnvTag();
  const deploymentUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "localhost";

  const levelEmoji =
    payload.level === "critical" ? ":rotating_light:" :
    payload.level === "warning" ? ":warning:" : ":information_source:";

  const text =
    `${envEmoji} ${envTag} | ${deploymentUrl}\n` +
    `${levelEmoji} *${payload.title}*\n${payload.message}` +
    (payload.context
      ? `\n\`\`\`${JSON.stringify(payload.context, null, 2)}\`\`\``
      : "");

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("[alerts] Slack webhook failed:", err);
  }
}
