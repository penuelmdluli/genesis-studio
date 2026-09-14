import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { modelAvailability, checkCoreConfig } from "./config";

// These pin the guarantee that closed the largest failure class in production:
// a model that cannot run must be refused BEFORE the user is charged.

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL };
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("modelAvailability", () => {
  it("allows a hosted model when WaveSpeed is configured", () => {
    process.env.WAVESPEED_API_KEY = "ws-test-key";
    const result = modelAvailability("seedance-1.5", "t2v");
    expect(result.runnable).toBe(true);
  });

  it("allows wan-2.2 now that it routes to WaveSpeed, not a dead RunPod endpoint", () => {
    process.env.WAVESPEED_API_KEY = "ws-test-key";
    delete process.env.RUNPOD_ENDPOINT_WAN22;
    // The whole point of the reroute: no RunPod endpoint is needed any more.
    expect(modelAvailability("wan-2.2", "t2v").runnable).toBe(true);
    expect(modelAvailability("wan-2.2", "i2v").runnable).toBe(true);
  });

  it("refuses a hosted model when no provider key is set", () => {
    delete process.env.WAVESPEED_API_KEY;
    delete process.env.FAL_KEY;
    const result = modelAvailability("seedance-1.5", "t2v");
    expect(result.runnable).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("refuses a RunPod model whose endpoint variable is unset", () => {
    delete process.env.RUNPOD_ENDPOINT_MOCHI;
    const result = modelAvailability("mochi-1", "t2v");
    expect(result.runnable).toBe(false);
    expect(result.detail).toContain("RUNPOD_ENDPOINT_MOCHI");
  });

  it("refuses a RunPod endpoint variable holding a name instead of an id", () => {
    // This is the real production value of RUNPOD_ENDPOINT_WAN22_I2V. Sent to
    // the API it returns a 404 that reads like an outage rather than a
    // misconfiguration.
    process.env.RUNPOD_ENDPOINT_MOCHI = "wan-2-2-i2v-720-lora";
    const result = modelAvailability("mochi-1", "t2v");
    expect(result.runnable).toBe(false);
    expect(result.detail).toContain("not a valid endpoint id");
  });

  it("does not leak vendor or variable names into the user-facing reason", () => {
    delete process.env.RUNPOD_ENDPOINT_MOCHI;
    const { reason } = modelAvailability("mochi-1", "t2v");
    expect(reason).not.toMatch(/runpod|wavespeed|fal|RUNPOD_/i);
  });
});

describe("checkCoreConfig", () => {
  it("reports a missing hosted provider as a problem", () => {
    process.env.APP_URL = "https://ivideostudio.ai";
    process.env.CRON_SECRET = "a-sufficiently-long-secret";
    delete process.env.WAVESPEED_API_KEY;
    delete process.env.FAL_KEY;

    const problems = checkCoreConfig();
    expect(problems.some((p) => p.key.includes("WAVESPEED_API_KEY"))).toBe(true);
  });

  it("passes when core config is present", () => {
    process.env.APP_URL = "https://ivideostudio.ai";
    process.env.CRON_SECRET = "a-sufficiently-long-secret";
    process.env.WAVESPEED_API_KEY = "ws-test-key";

    expect(checkCoreConfig()).toEqual([]);
  });
});
