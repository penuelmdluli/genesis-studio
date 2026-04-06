import { describe, it, expect } from "vitest";
import {
  estimateGpuCostUsd,
  creditsToRevenue,
  creditsToRevenueNet,
  getGenerationMargin,
  isProfitable,
  calculateBreakEven,
  checkPlanLimits,
  checkStorageLimits,
  CREDIT_VALUE_USD,
  GPU_RATES,
  MODEL_GPU_MAP,
  FIXED_COSTS_MONTHLY,
  PLAN_LIMITS,
  STORAGE_LIMITS,
  VAT_RATE,
  PAYMENT_PROCESSOR_FEE,
  NET_REVENUE_MULTIPLIER,
} from "./profitability";

describe("profitability", () => {
  describe("constants", () => {
    it("has correct credit value", () => {
      expect(CREDIT_VALUE_USD).toBe(0.024);
    });

    it("has GPU rates for all GPU types", () => {
      expect(GPU_RATES["RTX_4090"]).toBe(0.69);
      expect(GPU_RATES["A6000"]).toBe(0.76);
      expect(GPU_RATES["H100"]).toBe(2.39);
    });

    it("maps every model to a GPU", () => {
      expect(MODEL_GPU_MAP["cogvideo-x"]).toBe("RTX_4090");
      expect(MODEL_GPU_MAP["wan-2.2"]).toBe("L40S");
      expect(MODEL_GPU_MAP["mochi-1"]).toBe("A6000");
    });

    it("has correct fixed costs including all services", () => {
      expect(FIXED_COSTS_MONTHLY.total).toBe(155);
      expect(FIXED_COSTS_MONTHLY.resend).toBe(20);
      expect(FIXED_COSTS_MONTHLY.claude_api).toBe(30);
    });

    it("has correct tax and fee rates", () => {
      expect(VAT_RATE).toBe(0.15);
      expect(PAYMENT_PROCESSOR_FEE).toBe(0.035);
      // We keep ~83.9% of every rand charged
      expect(NET_REVENUE_MULTIPLIER).toBeCloseTo(0.839, 2);
    });
  });

  describe("estimateGpuCostUsd", () => {
    it("returns a positive number for valid models", () => {
      const cost = estimateGpuCostUsd("cogvideo-x", 5, "480p");
      expect(cost).toBeGreaterThan(0);
    });

    it("higher resolution costs more", () => {
      const cost480 = estimateGpuCostUsd("wan-2.2", 5, "480p");
      const cost720 = estimateGpuCostUsd("wan-2.2", 5, "720p");
      const cost1080 = estimateGpuCostUsd("wan-2.2", 5, "1080p");
      expect(cost720).toBeGreaterThan(cost480);
      expect(cost1080).toBeGreaterThan(cost720);
    });

    it("longer duration costs more", () => {
      const cost5 = estimateGpuCostUsd("wan-2.2", 5, "720p");
      const cost10 = estimateGpuCostUsd("wan-2.2", 10, "720p");
      expect(cost10).toBeGreaterThan(cost5);
    });

    it("returns 0 for unknown model", () => {
      const cost = estimateGpuCostUsd("unknown-model", 5, "720p");
      expect(cost).toBe(0);
    });
  });

  describe("creditsToRevenue", () => {
    it("converts credits to USD", () => {
      expect(creditsToRevenue(100)).toBe(2.4); // 100 × $0.024
    });

    it("returns 0 for 0 credits", () => {
      expect(creditsToRevenue(0)).toBe(0);
    });
  });

  describe("creditsToRevenueNet", () => {
    it("applies VAT and payment processor deduction", () => {
      const gross = creditsToRevenue(100); // $2.40
      const net = creditsToRevenueNet(100); // $2.40 × 0.839 = ~$2.01
      expect(net).toBeLessThan(gross);
      expect(net).toBeCloseTo(gross * NET_REVENUE_MULTIPLIER, 2);
    });
  });

  describe("getGenerationMargin", () => {
    it("calculates margin using NET revenue (after taxes)", () => {
      // 10 credits = $0.24 gross, ~$0.201 net, $0.06 GPU
      const margin = getGenerationMargin(10, 0.06);
      expect(margin).toBeGreaterThan(50); // Should still be profitable
      expect(margin).toBeLessThan(80);    // But less than gross-only calc
    });

    it("returns 0 for 0 credits", () => {
      expect(getGenerationMargin(0, 0.05)).toBe(0);
    });

    it("handles negative margin", () => {
      // 1 credit = $0.024 gross, ~$0.020 net, $0.10 GPU = negative
      const margin = getGenerationMargin(1, 0.10);
      expect(margin).toBeLessThan(0);
    });
  });

  describe("isProfitable", () => {
    it("returns profitable for cheap models with correct pricing", () => {
      // CogVideoX at 15 credits should be profitable (net revenue > full cost)
      const result = isProfitable(15, "cogvideo-x", 5, "480p");
      expect(result.netRevenue).toBeGreaterThan(result.fullCost);
    });

    it("returns correct structure with full cost breakdown", () => {
      const result = isProfitable(40, "wan-2.2", 5, "720p");
      expect(result).toHaveProperty("profitable");
      expect(result).toHaveProperty("margin");
      expect(result).toHaveProperty("gpuCost");
      expect(result).toHaveProperty("fullCost");
      expect(result).toHaveProperty("grossRevenue");
      expect(result).toHaveProperty("netRevenue");
      expect(result.fullCost).toBeGreaterThanOrEqual(result.gpuCost);
      expect(result.netRevenue).toBeLessThan(result.grossRevenue);
    });

    it("Brain Studio has higher cost due to Claude API", () => {
      const normal = isProfitable(50, "kling-2.6", 5, "720p", false);
      const brain = isProfitable(50, "kling-2.6", 5, "720p", true);
      expect(brain.fullCost).toBeGreaterThan(normal.fullCost);
    });
  });

  describe("calculateBreakEven", () => {
    it("calculates break-even users with all costs", () => {
      const users = calculateBreakEven(24.60, 155, 5);
      expect(users).toBeGreaterThan(0);
      expect(users).toBeLessThan(20);
    });

    it("returns Infinity if cost per user exceeds net revenue", () => {
      const users = calculateBreakEven(5, 155, 10);
      expect(users).toBe(Infinity);
    });
  });

  describe("checkPlanLimits", () => {
    it("allows free user with low usage", () => {
      const result = checkPlanLimits("free", 2, 0);
      expect(result.allowed).toBe(true);
    });

    it("blocks free user at daily limit", () => {
      const result = checkPlanLimits("free", 5, 0);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Daily generation limit");
    });

    it("blocks when max concurrent jobs reached", () => {
      const result = checkPlanLimits("free", 0, 1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("concurrent");
    });

    it("allows pro user with higher limits", () => {
      const result = checkPlanLimits("pro", 100, 3);
      expect(result.allowed).toBe(true);
    });

    it("uses free limits for unknown plans", () => {
      const result = checkPlanLimits("unknown", 5, 0);
      expect(result.allowed).toBe(false);
    });
  });

  describe("PLAN_LIMITS", () => {
    it("free has strictest limits", () => {
      expect(PLAN_LIMITS.free.maxGenerationsPerDay).toBe(5);
      expect(PLAN_LIMITS.free.maxConcurrentJobs).toBe(1);
    });

    it("studio has highest limits", () => {
      expect(PLAN_LIMITS.studio.maxGenerationsPerDay).toBe(500);
      expect(PLAN_LIMITS.studio.maxConcurrentJobs).toBe(10);
    });

    it("limits increase with plan tier", () => {
      expect(PLAN_LIMITS.creator.maxGenerationsPerDay)
        .toBeGreaterThan(PLAN_LIMITS.free.maxGenerationsPerDay);
      expect(PLAN_LIMITS.pro.maxGenerationsPerDay)
        .toBeGreaterThan(PLAN_LIMITS.creator.maxGenerationsPerDay);
      expect(PLAN_LIMITS.studio.maxGenerationsPerDay)
        .toBeGreaterThan(PLAN_LIMITS.pro.maxGenerationsPerDay);
    });
  });

  describe("STORAGE_LIMITS", () => {
    it("free has strictest storage limits", () => {
      expect(STORAGE_LIMITS.free.maxVideos).toBe(10);
      expect(STORAGE_LIMITS.free.retentionDays).toBe(30);
    });

    it("studio has unlimited storage", () => {
      expect(STORAGE_LIMITS.studio.maxVideos).toBe(-1);
      expect(STORAGE_LIMITS.studio.retentionDays).toBe(-1);
    });

    it("file size limits increase with plan tier", () => {
      expect(STORAGE_LIMITS.creator.maxFileSizeBytes)
        .toBeGreaterThan(STORAGE_LIMITS.free.maxFileSizeBytes);
      expect(STORAGE_LIMITS.pro.maxFileSizeBytes)
        .toBeGreaterThan(STORAGE_LIMITS.creator.maxFileSizeBytes);
      expect(STORAGE_LIMITS.studio.maxFileSizeBytes)
        .toBeGreaterThan(STORAGE_LIMITS.pro.maxFileSizeBytes);
    });
  });

  describe("checkStorageLimits", () => {
    it("allows storage when under limit", () => {
      const result = checkStorageLimits("free", 5);
      expect(result.allowed).toBe(true);
    });

    it("blocks storage at limit", () => {
      const result = checkStorageLimits("free", 10);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Storage limit reached");
    });

    it("allows unlimited storage for studio", () => {
      const result = checkStorageLimits("studio", 10000);
      expect(result.allowed).toBe(true);
    });

    it("uses free limits for unknown plans", () => {
      const result = checkStorageLimits("unknown", 10);
      expect(result.allowed).toBe(false);
    });
  });
});
