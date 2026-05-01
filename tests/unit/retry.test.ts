import { describe, it, expect, vi } from "vitest";
import { retry, isNonRetryableStatus } from "@/lib/retry";

describe("retry", () => {
  it("returns immediately on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retry(fn, { baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("succeeds after N transient failures", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");

    const result = await retry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after max attempts exceeded", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(
      retry(fn, { maxAttempts: 3, baseDelayMs: 1 })
    ).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("aborts immediately when shouldAbort returns true", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("auth error"));

    await expect(
      retry(fn, {
        maxAttempts: 5,
        baseDelayMs: 1,
        shouldAbort: (err) =>
          err instanceof Error && err.message.includes("auth"),
      })
    ).rejects.toThrow("auth error");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("applies exponential delay with jitter", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const start = Date.now();
    await retry(fn, { maxAttempts: 2, baseDelayMs: 50, maxDelayMs: 200 });
    const elapsed = Date.now() - start;

    // Should have waited at least ~50ms (baseDelay for attempt 1)
    expect(elapsed).toBeGreaterThanOrEqual(40);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("isNonRetryableStatus", () => {
  it.each([400, 401, 403, 404, 410, 422])(
    "returns true for status %d",
    (status) => {
      expect(isNonRetryableStatus(status)).toBe(true);
    }
  );

  it.each([429, 500, 502, 503, 504])(
    "returns false for status %d",
    (status) => {
      expect(isNonRetryableStatus(status)).toBe(false);
    }
  );
});
