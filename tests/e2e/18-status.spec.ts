import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://genesisstudio.app";

test.describe("Health & status", () => {
  test("/api/health returns 200 with JSON", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.status()).toBe(200);
    const contentType = res.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
    const body = await res.json();
    expect(body).toBeTruthy();
  });

  test("/api/health returns deps object", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Health endpoint should report dependency status
    expect(body).toHaveProperty("deps");
    expect(typeof body.deps).toBe("object");
  });

  test("/status page loads (or redirects to sign-in)", async ({ page }) => {
    const response = await page.goto(`${BASE}/status`);
    expect(response).not.toBeNull();
    const status = response!.status();
    // Either the page loads successfully or redirects to sign-in
    expect(status).toBeLessThan(500);
    const url = page.url();
    const isStatusPage = /status/.test(url);
    const isSignIn = /sign-in/.test(url);
    expect(isStatusPage || isSignIn).toBe(true);
  });
});
