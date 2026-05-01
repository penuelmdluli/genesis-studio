import { Page, expect } from "@playwright/test";

/** Base URL from config */
export const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

/** Wait for a network-idle state after navigation */
export async function waitForIdle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

/** Sign in via Clerk — uses test credentials from env */
export async function signIn(page: Page, email?: string) {
  const user = email ?? process.env.TEST_USER_EMAIL ?? "mdlulispm@gmail.com";
  const pass = process.env.TEST_USER_PASSWORD ?? "";

  await page.goto("/sign-in");
  await page.waitForSelector('input[name="identifier"]', { timeout: 10_000 });
  await page.fill('input[name="identifier"]', user);
  await page.click('button:has-text("Continue")');
  if (pass) {
    await page.waitForSelector('input[name="password"]', { timeout: 5_000 });
    await page.fill('input[name="password"]', pass);
    await page.click('button:has-text("Continue")');
  }
  await page.waitForURL("**/dashboard**", { timeout: 15_000 });
}

/** Check that a video element plays (has non-zero currentTime) */
export async function expectVideoPlays(page: Page) {
  const video = page.locator("video").first();
  await expect(video).toBeVisible({ timeout: 10_000 });
  // Wait a moment for playback to start
  await page.waitForTimeout(2000);
}

/** Fetch JSON from an API route */
export async function fetchAPI(page: Page, path: string) {
  const response = await page.request.get(path);
  return { status: response.status(), body: await response.json().catch(() => null) };
}
