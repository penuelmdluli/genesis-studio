import { describe, it, expect } from "vitest";
import { detectLang, promptSnippet, buildRecoveryEmail, supersededByCompletion } from "./checkout-recovery";

const nassimaPrompt = `"Créer une histoire éducatif animé pour enfants de 8 ans intitulé « Léo et la Forêt des Lettres », série « Les Petits Génies »`;
const base = {
  checkout_id: "c1", user_id: "u1", type: "credit_pack", product_id: "pack-2000", amount: 65000,
  created_at: "2026-10-06 09:00:00", email: "a@b.c", name: "Nassima Touil", clerk_id: "x", credit_balance: 20,
};

describe("checkout recovery", () => {
  it("reads French from what they wrote", () => {
    expect(detectLang(nassimaPrompt, null)).toBe("fr");
    expect(detectLang("a lion dancing on the beach at sunset", null)).toBe("en");
    expect(detectLang(null, "fr-FR,fr;q=0.9")).toBe("fr");
  });

  it("quotes the title of their project", () => {
    expect(promptSnippet(nassimaPrompt)).toBe("Léo et la Forêt des Lettres");
  });

  it("step 1 links back to the exact pack, in French, with the abroad note", () => {
    const m = buildRecoveryEmail(1, base, { lang: "fr", abroad: true, lastPrompt: "Léo et la Forêt des Lettres" }, "https://ivideostudio.ai");
    expect(m.subject).toMatch(/paiement/);
    expect(m.content).toContain("pack=pack-2000");
    expect(m.content).toContain("R650");
    expect(m.content).toContain("rands");
    expect(m.content).toContain("Léo et la Forêt des Lettres");
  });

  it("step 2 offers the R49 starter instead of repeating a big pack", () => {
    const m = buildRecoveryEmail(2, { ...base, name: "Sipho Dlamini" }, { lang: "en", abroad: false, lastPrompt: null }, "https://ivideostudio.ai");
    expect(m.subject).toContain("R49");
    expect(m.content).toContain("pack=pack-starter");
    expect(m.content).not.toContain("outside South Africa");
  });
});

// 2026-10-17: the reconcile watchdog emailed "money not settled" for abandoned
// retries that the same user had already completed (lumireceptionist: 3 pack-starter
// checkouts, the 3rd completed, the first two false-alarmed). Only genuinely stuck
// checkouts should escalate.
describe("supersededByCompletion", () => {
  const stuck = { user_id: "u1", product_id: "pack-starter", created_at: "2026-10-17 17:40:11" };

  it("is superseded by the same user's completed same-product checkout minutes later", () => {
    expect(supersededByCompletion(stuck, [
      { user_id: "u1", product_id: "pack-starter", created_at: "2026-10-17 17:45:44" },
    ])).toBe(true);
  });

  it("is NOT superseded by a completion of a different product", () => {
    expect(supersededByCompletion(stuck, [
      { user_id: "u1", product_id: "pack-2000", created_at: "2026-10-17 17:45:44" },
    ])).toBe(false);
  });

  it("is NOT superseded by another user's completion", () => {
    expect(supersededByCompletion(stuck, [
      { user_id: "u2", product_id: "pack-starter", created_at: "2026-10-17 17:45:44" },
    ])).toBe(false);
  });

  it("is NOT superseded by a completion far outside the window", () => {
    expect(supersededByCompletion(stuck, [
      { user_id: "u1", product_id: "pack-starter", created_at: "2026-10-24 10:00:00" },
    ])).toBe(false);
  });

  it("a genuinely stuck checkout (no completion) still escalates", () => {
    expect(supersededByCompletion(stuck, [])).toBe(false);
  });
});
