// ============================================
// Phone alerts for the hype-reel pipeline (ntfy)
// ============================================
// The owner installs the free ntfy app (ntfy.sh) and subscribes to the topic
// in NTFY_TOPIC (.env.local). Every post, every failed slot, the morning
// health check and the nightly review land on the phone. Topics are public
// to anyone who knows the name, so it is long and random, and messages carry
// only reel titles, links and error lines — never tokens or personal data.
// A missing topic or a dead ntfy never breaks a slot.

export async function notifyPhone(
  title: string,
  body: string,
  opts: { priority?: 1 | 2 | 3 | 4 | 5; click?: string; tags?: string } = {}
): Promise<void> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      body: body.slice(0, 3500),
      headers: {
        // HTTP headers must be plain ASCII.
        Title: title.replace(/[^\x20-\x7E]/g, "").slice(0, 120),
        Priority: String(opts.priority ?? 3),
        ...(opts.tags ? { Tags: opts.tags } : {}),
        ...(opts.click ? { Click: opts.click } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    /* an alert is never worth failing a slot over */
  }
}
