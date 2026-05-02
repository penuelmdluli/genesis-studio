import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Autoposting", () => {
  test.skip("Connect Facebook page (needs auth + Facebook)", async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    // Navigate to social connections, initiate Facebook OAuth
    // Assert Facebook page is listed as connected after auth flow
  });

  test.skip("Schedule post (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    // Create a scheduled post with a future date/time
    // Assert the post appears in the scheduled queue
  });

  test.skip("Failed post retry (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    // Trigger a failed post scenario
    // Assert retry mechanism is available and post status updates
  });

  test.skip("Disconnect revokes token (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    // Disconnect a connected social account
    // Assert the account is removed and token is revoked
  });
});
