import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Customer Support", () => {
  test("91: Contact page loads", async ({ page }) => {
    await page.goto(`${BASE}/contact`);
    await expect(page.locator("body")).toBeVisible();
    const text = await page.textContent("body");
    expect(text).toMatch(/contact|support|help|reach/i);
  });

  test.skip("92: Submit support ticket (needs form submission)", async () => {
    // Requires filling and submitting the contact form
  });

  test.skip("93: Reply to ticket threads correctly (needs email system)", async () => {
    // Requires email integration testing
  });

  test("94: FAQ/docs page accessible", async ({ page }) => {
    await page.goto(`${BASE}/docs`);
    await expect(page.locator("body")).toBeVisible();
  });
});
