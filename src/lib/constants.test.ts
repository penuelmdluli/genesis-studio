import { describe, it, expect } from "vitest";
import { AI_MODELS, PLANS, CREDIT_PACKS, RESOLUTIONS, DURATIONS, FPS_OPTIONS, MODEL_ACCESS } from "./constants";

describe("AI_MODELS", () => {
  it("has all 6 models defined", () => {
    const modelIds = Object.keys(AI_MODELS);
    expect(modelIds).toHaveLength(6);
    expect(modelIds).toContain("wan-2.2");
    expect(modelIds).toContain("hunyuan-video");
    expect(modelIds).toContain("ltx-video");
    expect(modelIds).toContain("wan-2.1-turbo");
    expect(modelIds).toContain("mochi-1");
    expect(modelIds).toContain("cogvideo-x");
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
    const validTypes = ["t2v", "i2v", "v2v"];
    for (const model of Object.values(AI_MODELS)) {
      for (const type of model.types) {
        expect(validTypes).toContain(type);
      }
    }
  });

  it("tiers are valid", () => {
    const validTiers = ["flagship", "workhorse", "speed", "turbo", "realism", "budget"];
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

  it("free plan has 0 price", () => {
    const free = PLANS.find((p) => p.id === "free");
    expect(free?.price).toBe(0);
    expect(free?.credits).toBe(50);
  });

  it("studio plan has unlimited credits (-1)", () => {
    const studio = PLANS.find((p) => p.id === "studio");
    expect(studio?.credits).toBe(-1);
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
  it("has 3 packs", () => {
    expect(CREDIT_PACKS).toHaveLength(3);
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
  it("free plan only has cogvideo-x", () => {
    expect(MODEL_ACCESS.free).toEqual(["cogvideo-x"]);
  });

  it("creator, pro, studio have all 6 models", () => {
    expect(MODEL_ACCESS.creator).toHaveLength(6);
    expect(MODEL_ACCESS.pro).toHaveLength(6);
    expect(MODEL_ACCESS.studio).toHaveLength(6);
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
