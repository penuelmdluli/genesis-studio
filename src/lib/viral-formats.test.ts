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

  it("every plan gets a model it is allowed to use", () => {
    for (const plan of Object.keys(MODEL_ACCESS)) {
      for (const f of VIRAL_FORMATS) {
        expect(MODEL_ACCESS[plan]).toContain(modelForFormat(f, MODEL_ACCESS[plan])!);
      }
    }
    expect(modelForFormat(VIRAL_FORMATS[0], MODEL_ACCESS.free)).toBe("wan-2.2");
  });

  it("looks formats up by id", () => {
    expect(getViralFormat("giant-creature")?.title).toBe("Giant Creature Arrives");
    expect(getViralFormat("nope")).toBeUndefined();
  });
});
