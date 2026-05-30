// Temporary Worker to set up DNS records
// Deploy with: npx wrangler deploy scripts/setup-dns-worker.js --name dns-setup-temp --compatibility-date 2024-09-23
// Then visit the worker URL to trigger DNS setup
// Delete after: npx wrangler delete --name dns-setup-temp

export default {
  async fetch(request, env) {
    const ACCOUNT_ID = "a21680c65af30e3745366bc99e5388ed";
    const ZONE_ID = "e7cb33878e4d0a328185c298f08ef019";
    const PAGES_DOMAIN = "genesis-studio-28j.pages.dev";

    // Use the CF API token from the worker's service binding
    const CF_API_URL = `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records`;

    const records = [
      { type: "CNAME", name: "ivideostudio.ai", content: PAGES_DOMAIN, proxied: true },
      { type: "CNAME", name: "www", content: PAGES_DOMAIN, proxied: true },
      { type: "CNAME", name: "cdn", content: PAGES_DOMAIN, proxied: true },
    ];

    const results = [];

    for (const record of records) {
      try {
        const res = await fetch(CF_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.CF_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(record),
        });
        const data = await res.json();
        results.push({ record: record.name, success: data.success, error: data.errors });
      } catch (err) {
        results.push({ record: record.name, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
