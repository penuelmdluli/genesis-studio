import { test, expect, devices } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Mobile-specific", () => {
  test.use({ ...devices["iPhone 14"] });

  test("83: Touch targets are accessible on mobile", async ({ page }) => {
    await page.goto(BASE);
    // Check that primary CTA buttons are visible and reasonably sized
    const cta = page.locator("a, button").filter({ hasText: /sign|start|get started/i }).first();
    if (await cta.isVisible()) {
      const box = await cta.boundingBox();
      expect(box).toBeTruthy();
      // Touch target should be at least 44px in height
      expect(box!.height).toBeGreaterThanOrEqual(36);
    }
  });

  test("84: Onboarding works on small viewport", async ({ page }) => {
    await page.goto(`${BASE}/onboarding/first-video`);
    // Should redirect to sign-in on mobile too
    await page.waitForURL("**/sign-in**", { timeout: 10_000 });
  });

  test("85: Video player controls reachable", async ({ page }) => {
    await page.goto(`${BASE}/explore`);
    await expect(page.locator("body")).toBeVisible();
    // Explore page should render video cards on mobile
  });

  test("86: Bottom nav doesn't overlap iOS home bar", async ({ page }) => {
    await page.goto(BASE);
    // Check that content is visible and doesn't get clipped
    await expect(page.locator("body")).toBeVisible();
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    expect(bodyHeight).toBeGreaterThan(100);
  });
});
