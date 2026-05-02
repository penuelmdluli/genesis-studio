import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Captions (/captions)", () => {
  test("/captions redirects to sign-in when not logged in", async ({ page }) => {
    await page.goto(`${BASE}/captions`);
    await page.waitForURL(/sign-in|login|auth/i, { timeout: 15_000 });
    expect(page.url()).toMatch(/sign-in|login|auth/i);
  });

  test.skip("Upload video to SRT (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/captions`);
    // Upload a video file for transcription
    // Assert an SRT file is generated with valid timestamp entries
  });

  test.skip("Burn captions (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/captions`);
    // Upload video and burn captions into it
    // Assert the output video URL is valid and includes embedded captions
  });
});
