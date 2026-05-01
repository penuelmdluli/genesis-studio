import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Video generation", () => {
  test("/generate redirects to sign-in when not logged in", async ({
    page,
  }) => {
    await page.goto(`${BASE}/generate`);
    await expect(page).toHaveURL(/sign-in/, { timeout: 15000 });
  });

  test("/api/generate requires auth (POST returns 401 without session)", async ({
    request,
  }) => {
    const res = await request.post(`${BASE}/api/generate`, {
      data: { prompt: "test" },
    });
    expect(res.status()).toBe(401);
  });

  test.skip("Text-to-video Seedance Lite", async ({ page }) => {
    // Needs auth + credits — submits a prompt using the Seedance Lite model
    // and verifies the generation job is queued.
  });

  test.skip("Text-to-video Kling Standard", async ({ page }) => {
    // Needs auth + credits — submits a prompt using Kling Standard model
    // and verifies the generation job is queued.
  });

  test.skip("Image-to-video", async ({ page }) => {
    // Needs auth + image upload — uploads a source image and generates
    // a video from it.
  });

  test.skip("RunPod Wan 2.2", async ({ page }) => {
    // Needs auth + credits — submits a prompt to the RunPod Wan 2.2
    // serverless endpoint.
  });

  test.skip("Empty prompt validation", async ({ page }) => {
    // Needs auth — verifies the UI rejects an empty prompt with
    // a validation message.
  });

  test.skip("Credit cap enforcement", async ({ page }) => {
    // Needs auth — verifies that users at zero credits are blocked
    // from generating.
  });

  test.skip("Daily cap enforcement", async ({ page }) => {
    // Needs auth — verifies daily generation limits are enforced.
  });

  test.skip("Cancel mid-generation", async ({ page }) => {
    // Needs auth — starts a generation, cancels it, and verifies
    // the job is aborted.
  });

  test.skip("Concurrent submissions", async ({ page }) => {
    // Needs auth — verifies the UI prevents duplicate submissions
    // while a generation is in progress.
  });

  test.skip("Idempotency key", async ({ page }) => {
    // Needs auth — verifies that duplicate POST requests with the
    // same idempotency key do not create duplicate jobs.
  });
});
