import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Authentication pages", () => {
  test("Sign-in page renders with Clerk form", async ({ page }) => {
    await page.goto(`${BASE}/sign-in`);
    await expect(page).toHaveURL(/sign-in/);
    // Clerk renders its own form container
    const clerkRoot = page.locator('[id*="clerk"], [class*="cl-"], [data-clerk]');
    await expect(clerkRoot.first()).toBeVisible({ timeout: 15000 });
  });

  test("Sign-up page renders", async ({ page }) => {
    await page.goto(`${BASE}/sign-up`);
    await expect(page).toHaveURL(/sign-up/);
    const clerkRoot = page.locator('[id*="clerk"], [class*="cl-"], [data-clerk]');
    await expect(clerkRoot.first()).toBeVisible({ timeout: 15000 });
  });

  test("Protected route /dashboard redirects to sign-in when not logged in", async ({
    page,
  }) => {
    await page.goto(`${BASE}/dashboard`);
    // Should redirect to sign-in or show sign-in UI
    await expect(page).toHaveURL(/sign-in/, { timeout: 15000 });
  });

  test("Sign-in page has correct title", async ({ page }) => {
    await page.goto(`${BASE}/sign-in`);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    // Title should reference the app or sign-in
    expect(title.toLowerCase()).toMatch(/genesis|sign|log/i);
  });

  test("Sign-up page has correct title", async ({ page }) => {
    await page.goto(`${BASE}/sign-up`);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title.toLowerCase()).toMatch(/genesis|sign|register|create/i);
  });
});
