// ============================================
// GENESIS STUDIO — Operator Alerts (Slack)
// ============================================

type AlertLevel = "info" | "warning" | "critical";

interface AlertPayload {
  level: AlertLevel;
  title: string;
  message: string;
  context?: Record<string, unknown>;
}

export async function sendSlackAlert(payload: AlertPayload): Promise<void> {
  const url = process.env.SLACK_ALERT_WEBHOOK_URL;
  if (!url) return;

  const emoji =
    payload.level === "critical" ? ":rotating_light:" :
    payload.level === "warning" ? ":warning:" : ":information_source:";

  const text =
    `${emoji} *${payload.title}*\n${payload.message}` +
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
