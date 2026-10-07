import { describe, it, expect } from "vitest";
import { buildShotImagePrompt, buildShotMotionPrompt, type RenderContext } from "./render";
import type { Shot } from "./writer";

const ctx: RenderContext = {
  language: "en-ZA" as RenderContext["language"],
  characterDescription: "young man in navy overalls",
  characterName: "Sipho",
  aspectRatio: "9:16",
};

const base: Shot = {
  speaker: "Lerato",
  dialogue: "Then I will break it.",
  subtitle: "Then I will break it.",
  action: "Lerato leans on the desk towards Sipho",
  gender: "female",
  shotSize: "ots",
  listener: "Sipho",
  emotion: "angry",
  kind: "dialogue",
};

describe("film upgrade: two people in one frame", () => {
  it("over-the-shoulder names speaker, listener and set in reference order, listener's face hidden", () => {
    const p = buildShotImagePrompt(base, ctx, { person: true, listener: true, set: true });
    expect(p).toContain("Lerato is the person in the first reference image");
    expect(p).toContain("Sipho is the person in the second reference image");
    expect(p).toContain("room shown in the third reference image");
    expect(p).toContain("FROM BEHIND");
    expect(p).toContain("Only Lerato's face is visible");
    expect(p).not.toContain("completely alone in frame");
  });

  it("without a listener portrait the set is the second image", () => {
    const p = buildShotImagePrompt(base, ctx, { person: true, listener: false, set: true, listenerLook: "slim young man" });
    expect(p).toContain("room shown in the second reference image");
    expect(p).toContain("Sipho (slim young man)");
  });

  it("a single-person shot is unchanged: alone in frame", () => {
    const p = buildShotImagePrompt({ ...base, shotSize: "medium", listener: undefined }, ctx, { person: true, set: true });
    expect(p).toContain("completely alone in frame");
    expect(p).toContain("room shown in the second reference image");
  });

  it("the listener stays silent in the motion direction", () => {
    expect(buildShotMotionPrompt(base)).toContain("Sipho, seen from behind in the foreground, stays silent");
  });
});
