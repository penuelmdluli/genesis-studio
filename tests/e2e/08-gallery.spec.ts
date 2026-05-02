import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Gallery", () => {
  test("/gallery redirects to sign-in when not logged in", async ({
    page,
  }) => {
    await page.goto(`${BASE}/gallery`);
    await expect(page).toHaveURL(/sign-in/, { timeout: 15000 });
  });

  test.skip("Gallery lists videos", async ({ page }) => {
    // Needs auth — verifies that the gallery page shows the user's
    // previously generated videos.
  });

  test.skip("Video delete", async ({ page }) => {
    // Needs auth — deletes a video from the gallery and verifies
    // it is removed from the list.
  });

  test.skip("Download MP4", async ({ page }) => {
    // Needs auth — clicks the download button on a video and verifies
    // a valid MP4 file is returned.
  });

  test.skip("Share-by-link viewer", async ({ page }) => {
    // Needs auth — creates a share link for a video and verifies
    // the public viewer page renders the video.
  });
});
