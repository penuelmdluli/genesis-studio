import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Onboarding flow", () => {
  test("/onboarding/first-video redirects to sign-in when not logged in", async ({
    page,
  }) => {
    await page.goto(`${BASE}/onboarding/first-video`);
    await expect(page).toHaveURL(/sign-in/, { timeout: 15000 });
  });

  test.skip("Full onboarding flow completes", async ({ page }) => {
    // Needs auth credentials — requires a signed-in session to walk
    // through the onboarding wizard steps.
    await page.goto(`${BASE}/onboarding/first-video`);
  });

  test.skip("Skip onboarding navigates to dashboard", async ({ page }) => {
    // Needs auth credentials — the skip button is only visible
    // when the user is authenticated and in the onboarding flow.
    await page.goto(`${BASE}/onboarding/first-video`);
  });

  test.skip("Onboarding survives page refresh", async ({ page }) => {
    // Needs auth credentials — verifies partial onboarding state
    // persists across a hard page reload.
    await page.goto(`${BASE}/onboarding/first-video`);
  });
});
