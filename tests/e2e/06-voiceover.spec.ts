import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Voiceover (/voiceover)", () => {
  test("/voiceover redirects to sign-in when not logged in", async ({ page }) => {
    await page.goto(`${BASE}/voiceover`);
    await page.waitForURL(/sign-in|login|auth/i, { timeout: 15_000 });
    expect(page.url()).toMatch(/sign-in|login|auth/i);
  });

  test.skip("Short text to audio (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/voiceover`);
    // Enter short text, select voice, generate audio
    // Assert audio file is returned and duration is > 0
  });

  test.skip("Long text chunked (needs auth)", async ({ page }) => {
    await page.goto(`${BASE}/voiceover`);
    // Enter text exceeding single-chunk limit
    // Assert audio is generated successfully (chunked processing)
  });
});
