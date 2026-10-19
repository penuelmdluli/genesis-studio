import { describe, it, expect } from "vitest";
import { VIRAL_FORMATS, getViralFormat, modelForFormat } from "./viral-formats";
import { AI_MODELS, MODEL_ACCESS } from "./constants";

describe("viral formats", () => {
  it("has unique ids and both prompt variants", () => {
    const ids = VIRAL_FORMATS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of VIRAL_FORMATS) {
      expect(f.prompt.length).toBeGreaterThan(80);
      expect(f.promptNoPhoto).not.toContain("in the photo");
    }
  });

  it("only names models that can animate a photo", () => {
    for (const f of VIRAL_FORMATS) {
      for (const m of f.models) {
        expect(AI_MODELS[m], m).toBeTruthy();
        expect(AI_MODELS[m].types).toContain("i2v");
      }
    }
  });

  it("every plan gets a model it is allowed to use (free has none)", () => {
    for (const plan of Object.keys(MODEL_ACCESS)) {
      const models = MODEL_ACCESS[plan];
      for (const f of VIRAL_FORMATS) {
        const m = modelForFormat(f, models);
        if (models.length === 0) {
          // Free has no video models since 2026-10-17 — no format resolves to one.
          expect(m).toBeUndefined();
        } else {
          expect(models).toContain(m!);
        }
      }
    }
    expect(modelForFormat(VIRAL_FORMATS[0], MODEL_ACCESS.free)).toBeUndefined();
  });

  it("looks formats up by id", () => {
    expect(getViralFormat("giant-creature")?.title).toBe("Giant Creature Arrives");
    expect(getViralFormat("nope")).toBeUndefined();
  });
});
