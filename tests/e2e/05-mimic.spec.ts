import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Mimic (/mimic)", () => {
  test("/mimic redirects to sign-in when not logged in", async ({ page }) => {
    await page.goto(`${BASE}/mimic`);
    await page.waitForURL(/sign-in|login|auth/i, { timeout: 15_000 });
    expect(page.url()).toMatch(/sign-in|login|auth/i);
  });

  test.skip("Reference image to stylized video (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/mimic`);
    // Upload a reference image and submit for stylized video generation
    // Assert the output video URL is valid and playable
  });

  test.skip("NSFW reference blocked (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/mimic`);
    // Attempt to upload an NSFW reference image
    // Assert the request is rejected with an appropriate error message
  });
});
