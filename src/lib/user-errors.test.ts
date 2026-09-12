import { describe, it, expect } from "vitest";
import { toUserFacingProviderError, isOperatorActionable } from "./user-errors";

describe("toUserFacingProviderError", () => {
  it("turns a provider balance failure into a capacity message and flags the operator", () => {
    const raw = 'Both providers refused this job. WaveSpeed: WaveSpeed submit failed (400): {"code":400,"message":"Insufficient credits. Please top up your account to continue."} | FAL: No FAL.AI model ID configured for wan-2.2 (t2v)';
    const msg = toUserFacingProviderError(raw);
    expect(msg).toMatch(/at capacity/i);
    expect(msg).toMatch(/refunded/i);
    expect(isOperatorActionable(raw)).toBe(true);
  });

  it("never names a vendor", () => {
    for (const raw of [
      "WaveSpeed submit failed (400): field duration must be one of [5, 8]",
      "No FAL.AI model ID configured for wan-2.2 (t2v)",
      "RunPod API error: 404 - endpoint not found",
      "fal.ai returned 403 Forbidden",
    ]) {
      const msg = toUserFacingProviderError(raw);
      expect(msg).not.toMatch(/wavespeed|fal|runpod/i);
    }
  });

  it("keeps an actionable validation detail", () => {
    const msg = toUserFacingProviderError('WaveSpeed submit failed (400): field "duration" must be one of [5, 8]');
    expect(msg).toMatch(/duration/);
    expect(msg).toMatch(/refunded/i);
  });
});
