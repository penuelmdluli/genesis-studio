// ============================================
// GENESIS STUDIO — Cron Handler Worker
// ============================================
// Cloudflare Worker with cron triggers that calls
// the Next.js API cron endpoints on schedule.

// APP_URL and CRON_SECRET are set via wrangler.toml [vars] and `wrangler secret put`

// Map cron schedules to endpoints (arrays for multiple per schedule)
const CRON_MAP = {
  "0 5 * * *": ["/api/cron/content-pipeline"],
  "0 13 * * *": ["/api/cron/content-pipeline"],
  "0 3 * * *": ["/api/cron/cleanup-storage"],
  "0 9 * * *": ["/api/cron/dunning"],
  "*/5 * * * *": ["/api/cron/recover-scenes", "/api/cron/check-stuck-jobs"],
  "0 */6 * * *": ["/api/cron/purge-stale"],
  "*/1 * * * *": ["/api/cron/process-fallbacks", "/api/cron/check-singer"],
  "*/2 * * * *": ["/api/cron/process-mbs-queue", "/api/cron/check-mimic"],
  "*/30 * * * *": ["/api/cron/discover-content"],
  "*/15 * * * *": ["/api/cron/vet-candidates"],
};

export default {
  async scheduled(event, env, ctx) {
    const cronSecret = env.CRON_SECRET;
    const appUrl = env.APP_URL;

    // Find matching endpoints for this cron schedule
    const endpoints = CRON_MAP[event.cron];
    if (!endpoints || endpoints.length === 0) {
      console.log(`No handler for cron: ${event.cron}`);
      return;
    }

    // Run all endpoints for this schedule in parallel
    const tasks = endpoints.map(async (endpoint) => {
      const url = `${appUrl}${endpoint}`;
      console.log(`[CRON] Triggering ${endpoint} (schedule: ${event.cron})`);

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${cronSecret}`,
            "User-Agent": "Genesis-Cron-Worker/1.0",
          },
        });

        const status = res.status;
        const body = await res.text().catch(() => "");
        console.log(`[CRON] ${endpoint} -> ${status} (${body.length} bytes)`);

        if (!res.ok) {
          console.error(`[CRON] ${endpoint} failed: ${status} ${body.slice(0, 200)}`);
        }
      } catch (err) {
        console.error(`[CRON] ${endpoint} error: ${err.message}`);
      }
    });

    ctx.waitUntil(Promise.all(tasks));
  },

  // Health check endpoint
  async fetch(request, env) {
    const allEndpoints = Object.values(CRON_MAP).flat();
    return new Response(
      JSON.stringify({
        service: "genesis-studio-cron",
        status: "ok",
        endpoints: allEndpoints,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  },
};
