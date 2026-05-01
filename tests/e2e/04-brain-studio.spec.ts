import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Brain Studio (/brain)", () => {
  test("/brain redirects to sign-in when not logged in", async ({ page }) => {
    await page.goto(`${BASE}/brain`);
    await page.waitForURL(/sign-in|login|auth/i, { timeout: 15_000 });
    expect(page.url()).toMatch(/sign-in|login|auth/i);
  });

  test.skip("6-scene production (needs auth + credits)", async ({ page }) => {
    await page.goto(`${BASE}/brain`);
    // Fill in topic, select 6 scenes, start production
    // Assert all 6 scene thumbnails render and final video URL is valid
  });

  test.skip("Voiceover duration check (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/brain`);
    // Create a production with voiceover enabled
    // Assert audio duration roughly matches total scene duration
  });

  test.skip("Captions burned in (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/brain`);
    // Create production with captions enabled
    // Assert final video has embedded caption track or burned-in text
  });

  test.skip("Watermark present (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/brain`);
    // Create production on free tier
    // Assert watermark overlay is visible on the rendered video
  });

  test.skip("Scene failure refund (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/brain`);
    // Simulate or trigger a scene generation failure
    // Assert credits are refunded for the failed scene
  });
});
