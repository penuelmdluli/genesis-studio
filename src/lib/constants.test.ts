import { describe, it, expect } from "vitest";
import { AI_MODELS, PLANS, CREDIT_PACKS, RESOLUTIONS, DURATIONS, FPS_OPTIONS, MODEL_ACCESS } from "./constants";
import { generateSchema } from "./validation";

describe("AI_MODELS", () => {
  it("has every model defined", () => {
    const modelIds = Object.keys(AI_MODELS);
    for (const id of [
      "wan-2.2", "hunyuan-video", "ltx-video", "wan-2.1-turbo", "mochi-1", "mimic-motion",
      "kling-2.6", "kling-3.0", "veo-3.1", "seedance-1.5", "seedance-2.5", "ai-singer",
    ]) {
      expect(modelIds).toContain(id);
    }
    expect(modelIds).toHaveLength(12);
  });

  // 2026-10-18: a hardcoded Zod enum in validation.ts drifted from AI_MODELS —
  // it dropped seedance-2.5, so picking the current flagship 400'd with a cryptic
  // "Invalid option". The enum is now derived from AI_MODELS; this keeps it honest.
  it("generateSchema accepts every model id in AI_MODELS (no drift)", () => {
    for (const id of Object.keys(AI_MODELS)) {
      const r = generateSchema.safeParse({ prompt: "a lion on the beach at sunset", modelId: id });
      expect(r.success, `generateSchema should accept modelId "${id}"`).toBe(true);
    }
    expect(generateSchema.safeParse({ prompt: "a lion on the beach at sunset", modelId: "seedance-2.5" }).success).toBe(true);
    expect(generateSchema.safeParse({ prompt: "a lion on the beach at sunset", modelId: "not-a-real-model" }).success).toBe(false);
  });

  it("each model has required fields", () => {
    for (const model of Object.values(AI_MODELS)) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.tier).toBeTruthy();
      expect(model.types.length).toBeGreaterThan(0);
      expect(model.description).toBeTruthy();
      expect(model.maxResolution).toBeTruthy();
      expect(model.avgGenerationTime).toBeGreaterThan(0);
      expect(Object.keys(model.creditCost).length).toBeGreaterThan(0);
      expect(model.gpuRequirement).toBeTruthy();
      expect(model.license).toBeTruthy();
    }
  });

  it("credit costs are positive numbers", () => {
    for (const model of Object.values(AI_MODELS)) {
      for (const [, cost] of Object.entries(model.creditCost)) {
        expect(cost).toBeGreaterThan(0);
      }
    }
  });

  it("generation types are valid", () => {
    const validTypes = ["t2v", "i2v", "v2v", "motion"];
    for (const model of Object.values(AI_MODELS)) {
      for (const type of model.types) {
        expect(validTypes).toContain(type);
      }
    }
  });

  it("tiers are valid", () => {
    const validTiers = ["flagship", "workhorse", "speed", "turbo", "realism", "budget", "motion", "hollywood"];
    for (const model of Object.values(AI_MODELS)) {
      expect(validTiers).toContain(model.tier);
    }
  });
});

describe("PLANS", () => {
  it("has 4 plans", () => {
    expect(PLANS).toHaveLength(4);
  });

  it("has correct plan IDs in order", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["free", "creator", "pro", "studio"]);
  });

  it("free plan has 0 price and 20 taste credits", () => {
    const free = PLANS.find((p) => p.id === "free");
    expect(free?.price).toBe(0);
    // 2026-10-17: free grant cut to 20 (a taste of the tools; video needs a paid plan).
    expect(free?.credits).toBe(20);
  });

  it("studio plan has 8000 credits", () => {
    const studio = PLANS.find((p) => p.id === "studio");
    expect(studio?.credits).toBe(8000);
  });

  it("pro plan is marked as popular", () => {
    const pro = PLANS.find((p) => p.id === "pro");
    expect(pro?.popular).toBe(true);
  });

  it("all plans have features", () => {
    for (const plan of PLANS) {
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });

  it("paid plans have increasing prices", () => {
    const paidPlans = PLANS.filter((p) => p.price > 0);
    for (let i = 1; i < paidPlans.length; i++) {
      expect(paidPlans[i].price).toBeGreaterThan(paidPlans[i - 1].price);
    }
  });
});

describe("CREDIT_PACKS", () => {
  it("has 4 packs, starter first", () => {
    expect(CREDIT_PACKS).toHaveLength(4);
    expect(CREDIT_PACKS[0].id).toBe("pack-starter");
    expect(CREDIT_PACKS[0].priceZAR).toBeLessThanOrEqual(49);
  });

  it("each pack has credits and price", () => {
    for (const pack of CREDIT_PACKS) {
      expect(pack.id).toBeTruthy();
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.price).toBeGreaterThan(0);
    }
  });

  it("larger packs have better per-credit rate", () => {
    const rates = CREDIT_PACKS.map((p) => p.price / p.credits);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeLessThan(rates[i - 1]);
    }
  });
});

describe("RESOLUTIONS", () => {
  it("has 4 resolution options", () => {
    expect(RESOLUTIONS).toHaveLength(4);
  });

  it("each resolution has value, label, width, height", () => {
    for (const res of RESOLUTIONS) {
      expect(res.value).toBeTruthy();
      expect(res.label).toBeTruthy();
      expect(res.width).toBeGreaterThan(0);
      expect(res.height).toBeGreaterThan(0);
    }
  });
});

describe("DURATIONS", () => {
  it("has 5 duration options", () => {
    expect(DURATIONS).toHaveLength(5);
    expect(DURATIONS).toEqual([3, 5, 6, 8, 10]);
  });
});

describe("FPS_OPTIONS", () => {
  it("has 24 and 30 fps", () => {
    expect(FPS_OPTIONS).toEqual([24, 30]);
  });
});

describe("MODEL_ACCESS", () => {
  // seedance-1.5 was removed from free on 2026-09-09: 59 failed / 7 completed
  // in production, the worst path in the product, and it was what every new
  // signup landed on first. It stays on the paid tiers.
  it("free plan has no video models (2026-10-17: video needs a paid plan)", () => {
    expect(MODEL_ACCESS.free).toEqual([]);
    expect(MODEL_ACCESS.free).not.toContain("seedance-1.5");
  });

  it("paid tiers grant the reliable model set; none includes the retired seedance-1.5", () => {
    expect(MODEL_ACCESS.creator).toEqual(["kling-2.6", "mimic-motion"]);
    expect(MODEL_ACCESS.pro).toContain("seedance-2.5");
    expect(MODEL_ACCESS.studio).toContain("seedance-2.5");
    for (const tier of ["creator", "pro", "studio"] as const) {
      expect(MODEL_ACCESS[tier]).not.toContain("seedance-1.5");
    }
  });

  it("all model IDs in access lists are valid", () => {
    const validIds = Object.keys(AI_MODELS);
    for (const models of Object.values(MODEL_ACCESS)) {
      for (const modelId of models) {
        expect(validIds).toContain(modelId);
      }
    }
  });
});
