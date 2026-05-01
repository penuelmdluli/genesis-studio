import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Internationalization", () => {
  test("87: Pricing page shows currency amounts", async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    // Should show some currency symbol or amount
    const text = await page.textContent("body");
    // Check for any currency indicator (R, $, ZAR, USD)
    expect(text).toMatch(/R\s?\d|USD|\$\d|ZAR/i);
  });

  test("88: Pricing visible for non-SA users", async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await expect(page.locator("body")).toBeVisible();
    // Plans should be visible regardless of location
    const text = await page.textContent("body");
    expect(text).toMatch(/free|creator|pro|studio/i);
  });

  test("89: Dates render without errors", async ({ page }) => {
    await page.goto(`${BASE}/explore`);
    await expect(page.locator("body")).toBeVisible();
    // No "Invalid Date" text should appear
    const text = await page.textContent("body");
    expect(text).not.toContain("Invalid Date");
  });

  test("90: Page language is set to English", async ({ page }) => {
    await page.goto(BASE);
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBe("en");
  });
});
