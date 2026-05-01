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

  test.skip("Stripe checkout Creator", async ({ page }) => {
    // Needs auth + Stripe test mode — clicks the Creator plan buy button
    // and verifies redirect to Stripe Checkout.
  });

  test.skip("Stripe checkout Pro", async ({ page }) => {
    // Needs auth + Stripe test mode — clicks the Pro plan buy button
    // and verifies redirect to Stripe Checkout.
  });

  test.skip("Stripe checkout Studio", async ({ page }) => {
    // Needs auth + Stripe test mode — clicks the Studio plan buy button
    // and verifies redirect to Stripe Checkout.
  });

  test.skip("Cancel checkout", async ({ page }) => {
    // Needs auth + Stripe test mode — starts a checkout, navigates back,
    // and verifies no charge is created.
  });

  test.skip("Webhook delivery test", async () => {
    // Needs Stripe CLI — uses `stripe trigger` to send a test webhook
    // and verifies the app processes it correctly.
  });
});
