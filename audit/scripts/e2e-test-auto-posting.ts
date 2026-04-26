/**
 * Genesis Studio Audit — Auto-Posting Dry-Run
 * Validates social media tokens WITHOUT actually posting.
 *
 * Usage: npx tsx audit/scripts/e2e-test-auto-posting.ts
 * Requires: FB_PAGE_TOKEN_* env vars in .env.local
 * Cost: $0.00
 */

import { config } from "dotenv";
config({ path: ".env.local" });

console.log("=== AUTO-POSTING DRY-RUN ===\n");

interface TokenResult {
  page: string;
  envVar: string;
  status: "VALID" | "EXPIRED" | "NOT_SET" | "ERROR";
  pageName: string;
  followers: string;
  notes: string;
}

const results: TokenResult[] = [];

const FB_PAGES = [
  "tech_news",
  "ai_money",
  "motivation",
  "health_wellness",
  "mzansi_baby_stars",
  "limitless_you",
  "pop_culture_buzz",
];

async function validateFacebookToken(pageKey: string) {
  const envVar = `FB_PAGE_TOKEN_${pageKey}`;
  const token = process.env[envVar];

  if (!token) {
    results.push({ page: pageKey, envVar, status: "NOT_SET", pageName: "-", followers: "-", notes: "Token not configured" });
    return;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${token}&fields=name,followers_count`);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errorMsg = (body as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
      results.push({ page: pageKey, envVar, status: "EXPIRED", pageName: "-", followers: "-", notes: errorMsg.slice(0, 80) });
      return;
    }

    const data = await res.json() as { name?: string; followers_count?: number };
    results.push({
      page: pageKey,
      envVar,
      status: "VALID",
      pageName: data.name || "Unknown",
      followers: data.followers_count?.toLocaleString() || "N/A",
      notes: "",
    });
  } catch (err) {
    results.push({ page: pageKey, envVar, status: "ERROR", pageName: "-", followers: "-", notes: `${err}`.slice(0, 80) });
  }
}

async function validateYouTube() {
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!refreshToken) {
    results.push({ page: "YouTube", envVar: "YOUTUBE_REFRESH_TOKEN", status: "NOT_SET", pageName: "-", followers: "-", notes: "No refresh token" });
    return;
  }

  // Would need to exchange refresh token for access token
  results.push({ page: "YouTube", envVar: "YOUTUBE_REFRESH_TOKEN", status: "NOT_SET", pageName: "-", followers: "-", notes: "Requires OAuth flow — check manually" });
}

async function main() {
  console.log("Validating Facebook page tokens...\n");

  for (const page of FB_PAGES) {
    await validateFacebookToken(page);
  }

  await validateYouTube();

  console.log("| Page | Env Var | Status | Page Name | Followers | Notes |");
  console.log("|------|---------|--------|-----------|-----------|-------|");
  for (const r of results) {
    const statusIcon = r.status === "VALID" ? "VALID" : r.status;
    console.log(`| ${r.page} | ${r.envVar} | ${statusIcon} | ${r.pageName} | ${r.followers} | ${r.notes} |`);
  }

  const valid = results.filter(r => r.status === "VALID").length;
  const expired = results.filter(r => r.status === "EXPIRED").length;
  const notSet = results.filter(r => r.status === "NOT_SET").length;

  console.log(`\nSummary: ${valid} valid, ${expired} expired, ${notSet} not configured`);
}

main().catch(console.error);
