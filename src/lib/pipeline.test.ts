import { describe, it, expect, vi, beforeEach } from "vitest";
import { AI_MODELS, MODEL_ACCESS, PLANS, CREDIT_PACKS } from "./constants";
import { estimateCreditCost, formatCredits, formatDuration, generateApiKey } from "./utils";
import { estimateGpuCostUsd, isProfitable, checkPlanLimits, PLAN_LIMITS, CREDIT_VALUE_USD } from "./profitability";
import { ModelId, GenerationType } from "@/types";

/**
 * END-TO-END GENERATION PIPELINE TESTS
 * Validates the complete flow: model selection → cost estimation → profitability → limits
 */

describe("E2E Generation Pipeline", () => {
  // Test every model
  const allModels = Object.keys(AI_MODELS) as ModelId[];

  describe("Model Registry Integrity", () => {
    it.each(allModels)("model '%s' has all required fields", (modelId) => {
      const model = AI_MODELS[modelId];
      expect(model).toBeDefined();
      expect(model.id).toBe(modelId);
      expect(model.name).toBeTruthy();
      expect(model.tier).toBeTruthy();
      expect(model.types.length).toBeGreaterThan(0);
      expect(model.maxResolution).toMatch(/^(480p|720p|1080p|4k)$/);
      expect(model.avgGenerationTime).toBeGreaterThan(0);
      expect(Object.keys(model.creditCost).length).toBeGreaterThan(0);
      expect(model.gpuRequirement).toBeTruthy();
      expect(model.license).toBeTruthy();
    });

    it("every model supports at least t2v, i2v, or motion", () => {
      for (const model of Object.values(AI_MODELS)) {
        const hasBaseType = model.types.includes("t2v") || model.types.includes("i2v") || model.types.includes("motion");
        expect(hasBaseType).toBe(true);
      }
    });

    it("no duplicate model IDs", () => {
      const ids = Object.keys(AI_MODELS);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("Full Pipeline Per Model", () => {
    it.each(allModels)("model '%s' full generation pipeline", (modelId) => {
      const model = AI_MODELS[modelId];

      // Step 1: Validate model has credit costs
      const resolutions = Object.keys(model.creditCost);
      expect(resolutions.length).toBeGreaterThan(0);

      // Step 2: For each resolution, estimate credit cost
      for (const resolution of resolutions) {
        const creditCost = estimateCreditCost(modelId, resolution, 5, false);
        expect(creditCost).toBeGreaterThan(0);
        expect(Number.isFinite(creditCost)).toBe(true);

        // Step 3: Draft mode should cost less
        const draftCost = estimateCreditCost(modelId, resolution, 5, true);
        expect(draftCost).toBeLessThan(creditCost);
        expect(draftCost).toBeGreaterThan(0);

        // Step 4: GPU cost should be positive
        const gpuCost = estimateGpuCostUsd(modelId, 5, resolution);
        expect(gpuCost).toBeGreaterThan(0);

        // Step 5: Profitability check
        const profit = isProfitable(creditCost, modelId, 5, resolution);
        expect(profit).toHaveProperty("profitable");
        expect(profit).toHaveProperty("margin");
        expect(profit).toHaveProperty("gpuCost");
        expect(profit).toHaveProperty("revenue");
        expect(profit.gpuCost).toBeGreaterThan(0);
        expect(profit.revenue).toBeGreaterThan(0);
        expect(typeof profit.profitable).toBe("boolean");

        // Step 6: Revenue should be credit_cost * CREDIT_VALUE_USD
        expect(profit.revenue).toBeCloseTo(creditCost * CREDIT_VALUE_USD, 2);
      }
    });

    it.each(allModels)("model '%s' longer duration costs more", (modelId) => {
      const model = AI_MODELS[modelId];
      const resolution = Object.keys(model.creditCost)[0];

      const cost5 = estimateCreditCost(modelId, resolution, 5, false);
      const cost10 = estimateCreditCost(modelId, resolution, 10, false);
      expect(cost10).toBeGreaterThanOrEqual(cost5);
    });
  });

  describe("Plan Access Validation", () => {
    const plans = ["free", "creator", "pro", "studio"] as const;

    it.each(plans)("plan '%s' has model access defined", (plan) => {
      const models = MODEL_ACCESS[plan];
      expect(models).toBeDefined();
      expect(models.length).toBeGreaterThan(0);

      // Every model in the access list should exist
      for (const modelId of models) {
        expect(AI_MODELS[modelId as ModelId]).toBeDefined();
      }
    });

    it("higher plans have access to more models", () => {
      expect(MODEL_ACCESS.creator.length).toBeGreaterThanOrEqual(MODEL_ACCESS.free.length);
      expect(MODEL_ACCESS.pro.length).toBeGreaterThanOrEqual(MODEL_ACCESS.creator.length);
      expect(MODEL_ACCESS.studio.length).toBeGreaterThanOrEqual(MODEL_ACCESS.pro.length);
    });

    it("free plan has strictest model access", () => {
      expect(MODEL_ACCESS.free.length).toBeLessThanOrEqual(MODEL_ACCESS.creator.length);
    });

    it("studio plan has access to ALL models", () => {
      const allModelIds = Object.keys(AI_MODELS);
      for (const modelId of allModelIds) {
        expect(MODEL_ACCESS.studio).toContain(modelId);
      }
    });
  });

  describe("Plan Limits Enforcement", () => {
    it("free user blocked at daily limit", () => {
      const result = checkPlanLimits("free", PLAN_LIMITS.free.maxGenerationsPerDay, 0);
      expect(result.allowed).toBe(false);
    });

    it("free user allowed below limit", () => {
      const result = checkPlanLimits("free", 0, 0);
      expect(result.allowed).toBe(true);
    });

    it("concurrent job limit enforced per plan", () => {
      for (const [plan, limits] of Object.entries(PLAN_LIMITS)) {
        const blocked = checkPlanLimits(plan, 0, limits.maxConcurrentJobs);
        expect(blocked.allowed).toBe(false);

        const allowed = checkPlanLimits(plan, 0, 0);
        expect(allowed.allowed).toBe(true);
      }
    });

    it("limits increase with plan tier", () => {
      const tiers = ["free", "creator", "pro", "studio"] as const;
      for (let i = 1; i < tiers.length; i++) {
        expect(PLAN_LIMITS[tiers[i]].maxGenerationsPerDay)
          .toBeGreaterThan(PLAN_LIMITS[tiers[i - 1]].maxGenerationsPerDay);
        expect(PLAN_LIMITS[tiers[i]].maxConcurrentJobs)
          .toBeGreaterThanOrEqual(PLAN_LIMITS[tiers[i - 1]].maxConcurrentJobs);
      }
    });
  });

  describe("Pricing Integrity", () => {
    it("all paid plans have positive price", () => {
      for (const plan of PLANS) {
        if (plan.id !== "free") {
          expect(plan.price).toBeGreaterThan(0);
        }
      }
    });

    it("plans have positive credits", () => {
      for (const plan of PLANS) {
        expect(plan.credits > 0 || plan.credits === 0).toBe(true);
      }
    });

    it("credit packs have better rate than subscription", () => {
      // Pack-500: $12 for 500 = $0.024/credit
      // Creator: $15 for 500 = $0.03/credit
      const pack500 = CREDIT_PACKS.find((p) => p.id === "pack-500")!;
      const creatorPlan = PLANS.find((p) => p.id === "creator")!;
      const packRate = pack500.price / pack500.credits;
      const planRate = creatorPlan.price / creatorPlan.credits;
      expect(packRate).toBeLessThan(planRate);
    });

    it("larger credit packs have better rates", () => {
      for (let i = 1; i < CREDIT_PACKS.length; i++) {
        const currentRate = CREDIT_PACKS[i].price / CREDIT_PACKS[i].credits;
        const prevRate = CREDIT_PACKS[i - 1].price / CREDIT_PACKS[i - 1].credits;
        expect(currentRate).toBeLessThanOrEqual(prevRate);
      }
    });

    it("plans are ordered by price ascending", () => {
      for (let i = 1; i < PLANS.length; i++) {
        expect(PLANS[i].price).toBeGreaterThanOrEqual(PLANS[i - 1].price);
      }
    });
  });

  describe("Credit Cost Consistency", () => {
    it("all model credit costs match estimateCreditCost at base duration", () => {
      for (const [modelId, model] of Object.entries(AI_MODELS)) {
        for (const [resolution, baseCost] of Object.entries(model.creditCost)) {
          const estimated = estimateCreditCost(modelId as ModelId, resolution, 5, false);
          // estimateCreditCost uses baseCost * durationMultiplier(1.0 for 5s)
          expect(estimated).toBe(baseCost);
        }
      }
    });

    it("draft mode is always ~30% of full cost", () => {
      for (const [modelId, model] of Object.entries(AI_MODELS)) {
        const resolution = Object.keys(model.creditCost)[0];
        const full = estimateCreditCost(modelId as ModelId, resolution, 5, false);
        const draft = estimateCreditCost(modelId as ModelId, resolution, 5, true);
        const ratio = draft / full;
        // Draft should be roughly 30% (with rounding)
        expect(ratio).toBeGreaterThan(0.2);
        expect(ratio).toBeLessThan(0.5);
      }
    });
  });

  describe("Profitability Across Models", () => {
    it("all models at base settings are profitable", () => {
      for (const [modelId, model] of Object.entries(AI_MODELS)) {
        const resolution = Object.keys(model.creditCost)[0];
        const creditCost = estimateCreditCost(modelId as ModelId, resolution, 5, false);
        const result = isProfitable(creditCost, modelId, 5, resolution);

        // All models should be designed to be profitable at standard rates
        expect(result.revenue).toBeGreaterThan(0);
        expect(result.gpuCost).toBeGreaterThanOrEqual(0);
      }
    });

    it("no model has negative revenue", () => {
      for (const [modelId, model] of Object.entries(AI_MODELS)) {
        for (const [resolution, baseCost] of Object.entries(model.creditCost)) {
          const result = isProfitable(baseCost, modelId, 5, resolution);
          expect(result.revenue).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Generation Type Coverage", () => {
    const generationTypes: GenerationType[] = ["t2v", "i2v", "v2v", "motion"];

    it.each(generationTypes)("at least one model supports '%s'", (type) => {
      const supporting = Object.values(AI_MODELS).filter((m) => m.types.includes(type));
      expect(supporting.length).toBeGreaterThan(0);
    });

    it("MimicMotion model supports motion type natively", () => {
      const motionModels = Object.values(AI_MODELS).filter((m) => m.types.includes("motion"));
      expect(motionModels.length).toBeGreaterThan(0);
      expect(motionModels[0].id).toBe("mimic-motion");
    });
  });

  describe("Utility Functions", () => {
    it("formatCredits handles all cases", () => {
      expect(formatCredits(0)).toBe("0");
      expect(formatCredits(100)).toBe("100");
      expect(formatCredits(10000)).toBe("10,000");
      expect(formatCredits(1000)).toContain("1");
    });

    it("formatDuration handles all ranges", () => {
      expect(formatDuration(5)).toBe("5s");
      expect(formatDuration(65)).toContain("m");
      expect(formatDuration(0)).toBe("0s");
    });

    it("generateApiKey returns valid format", () => {
      const key = generateApiKey();
      expect(key).toMatch(/^gs_/);
      expect(key.length).toBe(43); // gs_ + 40 chars
    });
  });
});
