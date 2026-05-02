import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Cross-browser smoke tests", () => {
  test("Landing page loads and has hero content", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    expect(page.url()).toContain(BASE.replace(/^https?:\/\//, ""));

    // Assert a visible heading or hero element exists
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
    const text = await heading.textContent();
    expect(text?.length).toBeGreaterThan(0);
  });

  test("Pricing page loads with plan cards", async ({ page }) => {
    await page.goto(`${BASE}/pricing`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    // Assert at least one pricing plan card is visible
    const cards = page.locator('[class*="card"], [class*="plan"], [class*="price"], [data-testid*="plan"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("Explore page loads with video grid", async ({ page }) => {
    await page.goto(`${BASE}/explore`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    // Assert at least one video item or card is rendered
    const items = page.locator('video, [class*="video"], [class*="grid"] > *, [data-testid*="video"]');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("/api/health returns 200", async ({ request }) => {
    const response = await request.get(`${BASE}/api/health`);
    expect(response.status()).toBe(200);
  });
});
