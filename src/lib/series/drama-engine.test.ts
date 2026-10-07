import { describe, it, expect } from "vitest";
import { episodeBrief, type SeasonPlan } from "./season";
import { renderCost, isHeroShot, shotCredits } from "./pricing";
import { parseJson } from "./claude";

const plan: SeasonPlan = {
  dramaticIrony: "Sipho is Themba's son; only the audience and Zodwa know.",
  heroWant: "Respect, and to protect his mother.",
  villain: "Lerato, who has run the company in her father's shadow.",
  seasonQuestion: "Who is Sipho's father, and who wants him dead?",
  paywallAfter: 5,
  episodes: [
    { n: 1, beat: "Accused of theft at the funeral", compress: "Lerato has him searched in front of the guests", payoff: "The will names him", drop: "His car's brakes are cut", cliffhangerType: "revelation-on-a-face", cliffhanger: "Zodwa: 'Burn it.'" },
    { n: 2, beat: "The photo", compress: "c", payoff: "p", drop: "d", cliffhangerType: "betrayal", cliffhanger: "x" },
    { n: 5, beat: "Last free", compress: "c", payoff: "p", drop: "d", cliffhangerType: "identity-reversal", cliffhanger: "x" },
  ],
};

describe("drama engine", () => {
  it("briefs the writer with the secret, this episode's spring and the next beat", () => {
    const b = episodeBrief(plan, 1);
    expect(b).toContain("only the audience and Zodwa know");
    expect(b).toContain("Payoff (the face-slap): The will names him");
    expect(b).toContain('type "revelation-on-a-face"');
    expect(b).toContain("Next episode will be: The photo");
  });

  it("forbids repeating last episode's cliffhanger type and marks the last free episode", () => {
    expect(episodeBrief(plan, 2)).toContain('Last episode\'s cliffhanger was "revelation-on-a-face"');
    expect(episodeBrief(plan, 5)).toContain("THIS IS THE LAST FREE EPISODE");
    expect(episodeBrief(null, 1)).toBe("");
  });

  it("prices the hook, slap and cliffhanger as best-model shots", () => {
    expect(isHeroShot({ beat: "slap" })).toBe(true);
    expect(isHeroShot({ beat: "reaction" })).toBe(false);
    const shots = [
      { kind: "dialogue" as const, beat: "hook" },
      { kind: "dialogue" as const, beat: "squeeze" },
      { kind: "action" as const, beat: "cliff" },
    ];
    expect(renderCost(shots)).toBe(shotCredits("dialogue", true) + shotCredits("dialogue") + shotCredits("action", true));
  });

  it("reads JSON even with a fence or a stray sentence around it", () => {
    expect(parseJson<{ a: number }>('Here it is:\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });
});
