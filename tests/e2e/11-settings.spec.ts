import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Settings (/settings)", () => {
  test("/settings redirects to sign-in when not logged in", async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await page.waitForURL(/sign-in|login|auth/i, { timeout: 15_000 });
    expect(page.url()).toMatch(/sign-in|login|auth/i);
  });

  test.skip("Update profile name (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    // Change display name and save
    // Assert the updated name is persisted and reflected in the UI
  });

  test.skip("Delete account flow (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    // Initiate account deletion
    // Assert confirmation dialog appears and flow completes
  });

  test.skip("Export data (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    // Request data export
    // Assert download is triggered or export email is queued
  });

  test.skip("Email preferences (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    // Toggle email notification preferences
    // Assert preferences are saved and reflected on reload
  });
});
