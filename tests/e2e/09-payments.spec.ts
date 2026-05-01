import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Payments & pricing", () => {
  test("/pricing page renders with plans", async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await expect(page).toHaveURL(/pricing/);
    // Page should contain at least one pricing card or plan container
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(100);
  });

  test("/pricing shows plan names (Free, Creator, Pro, Studio)", async ({
    page,
  }) => {
    await page.goto(`${BASE}/pricing`);
    const body = await page.textContent("body");
    expect(body).toContain("Free");
    expect(body).toContain("Creator");
    expect(body).toContain("Pro");
    expect(body).toContain("Studio");
  });

  test("/pricing has a currency display", async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    const body = await page.textContent("body");
    // Should show at least one price indicator (R, $, or a number)
    expect(body).toMatch(/[R$€£]\s?\d+|\d+\s?(\/mo|\/month|credits)/i);
  });

  test("/api/credits/subscribe requires auth (POST returns 401)", async ({
    request,
  }) => {
    const res = await request.post(`${BASE}/api/credits/subscribe`, {
      data: { plan: "creator" },
    });
    expect(res.status()).toBe(401);
  });

  test("/api/credits/buy-pack requires auth (POST returns 401)", async ({
    request,
  }) => {
    const res = await request.post(`${BASE}/api/credits/buy-pack`, {
      data: { packId: "starter" },
    });
    expect(res.status()).toBe(401);
  });

  test.skip("Yoco checkout Creator (needs auth + Yoco test card)", async () => {
    // Clicks Creator plan → redirects to Yoco hosted checkout
    // Uses test card, completes 3DS challenge, returns to success URL
    // Verifies credits added via webhook
  });

  test.skip("Yoco checkout Pro (needs auth + Yoco test card)", async () => {
    // Same flow for Pro tier
  });

  test.skip("Yoco checkout Studio (needs auth + Yoco test card)", async () => {
    // Same flow for Studio tier
  });

  test.skip("Cancel Yoco checkout (needs auth)", async () => {
    // Starts checkout, navigates back to cancel URL
    // Verifies no charge, no credits added
  });

  test.skip("Yoco webhook idempotency (needs test webhook trigger)", async () => {
    // Sends same webhook event twice
    // Verifies credits granted only once (webhook_events table check)
  });
});
