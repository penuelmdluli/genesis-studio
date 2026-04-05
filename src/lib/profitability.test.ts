import { describe, it, expect } from "vitest";
import {
  estimateGpuCostUsd,
  creditsToRevenue,
  getGenerationMargin,
  isProfitable,
  calculateBreakEven,
  checkPlanLimits,
  CREDIT_VALUE_USD,
  GPU_RATES,
  MODEL_GPU_MAP,
  FIXED_COSTS_MONTHLY,
  PLAN_LIMITS,
} from "./profitability";

describe("profitability", () => {
  describe("constants", () => {
    it("has correct credit value", () => {
      expect(CREDIT_VALUE_USD).toBe(0.03);
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

    it("has correct fixed costs", () => {
      expect(FIXED_COSTS_MONTHLY.total).toBe(85);
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
      expect(creditsToRevenue(100)).toBe(3); // 100 × $0.03
    });

    it("returns 0 for 0 credits", () => {
      expect(creditsToRevenue(0)).toBe(0);
    });
  });

  describe("getGenerationMargin", () => {
    it("calculates correct margin", () => {
      // 10 credits = $0.30 revenue, $0.06 GPU = 80% margin
      const margin = getGenerationMargin(10, 0.06);
      expect(margin).toBe(80);
    });

    it("returns 0 for 0 credits", () => {
      expect(getGenerationMargin(0, 0.05)).toBe(0);
    });

    it("handles negative margin", () => {
      // 1 credit = $0.03 revenue, $0.10 GPU = negative
      const margin = getGenerationMargin(1, 0.10);
      expect(margin).toBeLessThan(0);
    });
  });

  describe("isProfitable", () => {
    it("returns profitable for cheap models with good credits", () => {
      const result = isProfitable(10, "cogvideo-x", 5, "480p");
      expect(result.profitable).toBe(true);
      expect(result.margin).toBeGreaterThan(50);
    });

    it("returns correct structure", () => {
      const result = isProfitable(40, "wan-2.2", 5, "720p");
      expect(result).toHaveProperty("profitable");
      expect(result).toHaveProperty("margin");
      expect(result).toHaveProperty("gpuCost");
      expect(result).toHaveProperty("revenue");
      expect(typeof result.margin).toBe("number");
    });
  });

  describe("calculateBreakEven", () => {
    it("calculates break-even users", () => {
      const users = calculateBreakEven(24.60, 85, 5);
      expect(users).toBeGreaterThan(0);
      expect(users).toBeLessThan(20); // Should be around 5
    });

    it("returns Infinity if cost per user exceeds revenue", () => {
      const users = calculateBreakEven(5, 85, 10);
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
});
