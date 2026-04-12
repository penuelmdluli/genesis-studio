// ============================================
// AFRICA MODULE — Test Suite
// Tests pronunciation, formatting, validation,
// fallbacks, and voice config
// ============================================

import { describe, it, expect } from "vitest";
import { applyPronunciationCorrections } from "./pronunciation-guide";
import { formatScriptForTTS } from "./script-formatter";
import { validateAfricanScript } from "./script-validator";
import { getFallbackScript } from "./fallback-scripts";
import { getAfricanVoiceConfig, isAfricanLanguage } from "./voice-config";
import { buildAfricanScriptPrompt, languageToCountry } from "./script-generator";

// ---- PRONUNCIATION GUIDE ----

describe("applyPronunciationCorrections", () => {
  it("corrects Ramaphosa", () => {
    const result = applyPronunciationCorrections("President Ramaphosa spoke today");
    expect(result).toContain("Ra-ma-PO-sa");
    expect(result).not.toContain("Ramaphosa");
  });

  it("corrects Mzansi case-insensitively", () => {
    const result = applyPronunciationCorrections("Welcome to mzansi");
    expect(result).toContain("mZAN-si");
  });

  it("corrects multiple words in one pass", () => {
    const result = applyPronunciationCorrections("From Soweto to Pretoria, Ubuntu is real");
    expect(result).toContain("so-WEH-to");
    expect(result).toContain("preh-TOR-ia");
    expect(result).toContain("oo-BOON-too");
  });

  it("does not replace partial word matches", () => {
    const result = applyPronunciationCorrections("Eskom is essential");
    expect(result).toContain("ES-kom");
    // "essential" should NOT be affected
    expect(result).toContain("essential");
  });

  it("corrects Nigerian names", () => {
    const result = applyPronunciationCorrections("Tinubu and Dangote in Abuja");
    expect(result).toContain("ti-NOO-boo");
    expect(result).toContain("dan-GO-teh");
    expect(result).toContain("a-BOO-ja");
  });
});

// ---- SCRIPT FORMATTER ----

describe("formatScriptForTTS", () => {
  it("applies emphasis to key words for en-ZA", () => {
    const result = formatScriptForTTS("This is a breaking story that is huge", "en-ZA");
    expect(result).toContain("BREAKING");
    expect(result).toContain("HUGE");
  });

  it("applies emphasis for en-NG", () => {
    const result = formatScriptForTTS("This is big wahala for everyone", "en-NG");
    expect(result).toContain("BIG");
    expect(result).toContain("WAHALA");
  });

  it("formats rand amounts as words", () => {
    const result = formatScriptForTTS("The price is R500 today", "en-ZA");
    expect(result).toContain("five hundred rand");
    expect(result).not.toContain("R500");
  });

  it("formats dollar amounts", () => {
    const result = formatScriptForTTS("They raised $1000", "en-ZA");
    expect(result).toContain("one thousand dollars");
  });

  it("expands abbreviations", () => {
    const result = formatScriptForTTS("The ANC and EFCC announced today", "en-ZA");
    expect(result).toContain("the A-N-C");
    expect(result).toContain("the E-F-C-C");
  });

  it("applies pronunciation corrections", () => {
    const result = formatScriptForTTS("Ramaphosa visits Soweto today", "en-ZA");
    expect(result).toContain("Ra-ma-PO-sa");
    expect(result).toContain("so-WEH-to");
  });
});

// ---- SCRIPT VALIDATOR ----

describe("validateAfricanScript", () => {
  const validZAScript = `Eita Mzansi! Something big just happened in Joburg today. Yoh this is serious.

This is the news that changes everything for South Africa. The situation is real. Very real. From Pretoria to Cape Town, from Durban to Soweto, everyone is watching this one closely right now.

We are staying informed. Because that is what we do here in Mzansi. The people of South Africa deserve to know the truth. And we are right here to tell you what is happening on the ground.

Eish the pressure is on. But Mzansi does not back down. We stand together. We stay sharp. We keep moving forward no matter what comes our way.

Drop your thoughts below. Follow for more news from South Africa. Stay sharp Mzansi. Sharp sharp.`;

  it("passes valid en-ZA script", () => {
    const result = validateAfricanScript(validZAScript, "en-ZA", "ZA");
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects generic opener", () => {
    const generic = "Hello everyone, today we look at what happened in South Africa. " +
      "This is important news that affects millions. " +
      "The government has announced new measures. Things are changing fast. " +
      "We need to pay attention. Follow for more and share your thoughts below.";
    const result = validateAfricanScript(generic, "en-ZA", "ZA");
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes("Generic opener"))).toBe(true);
  });

  it("rejects script with no country reference", () => {
    const noCountry = "Eita! Something massive just happened today. " +
      "This is the news that changes everything. The situation is serious. " +
      "Very serious. Everyone is watching. " +
      "We are staying informed. Drop your thoughts below. Follow for more.";
    const result = validateAfricanScript(noCountry, "en-ZA", "ZA");
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes("country reference"))).toBe(true);
  });

  it("rejects script with no CTA", () => {
    const noCTA = "Eita Mzansi! Something huge in South Africa. " +
      "From Joburg to Cape Town this is the biggest story. " +
      "Everyone needs to know this. The situation is developing rapidly. " +
      "We will keep you updated. Mzansi is watching. That is the news.";
    const result = validateAfricanScript(noCTA, "en-ZA", "ZA");
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes("call to action"))).toBe(true);
  });

  it("validates en-NG scripts", () => {
    const ngScript = `Nigerians! E don happen again o! Big news from Lagos today. Abeg pay attention.

This one concern all of us. From Abuja to Kano, from Oshodi to Lekki, from Port Harcourt to Enugu. Na serious matter wey everybody need to hear right now.

No be small thing o. The situation dey very hot. Nigeria dey watch closely. We dey follow am well well. Because this is our country and our future.

Matter don burst for real. The whole of Nigeria is talking about this one today. Na so e be. We no go keep quiet when things dey happen for our land.

Drop your comment below. What una think about this? Follow for more Nigerian news every day. Nigeria we hail thee!`;
    const result = validateAfricanScript(ngScript, "en-NG", "NG");
    expect(result.valid).toBe(true);
  });
});

// ---- FALLBACK SCRIPTS ----

describe("getFallbackScript", () => {
  it("returns en-ZA fallback with topic inserted", () => {
    const script = getFallbackScript("en-ZA", "Eskom announces more loadshedding");
    expect(script).toContain("Eskom announces more loadshedding");
    expect(script).toContain("Mzansi");
    expect(script).toContain("Follow");
  });

  it("returns en-NG fallback", () => {
    const script = getFallbackScript("en-NG", "Naira crashes to record low");
    expect(script).toContain("Naira crashes to record low");
    expect(script).toContain("Nigeria");
  });

  it("returns Swahili fallback", () => {
    const script = getFallbackScript("sw", "East Africa drought crisis");
    expect(script).toContain("East Africa drought crisis");
    expect(script).toContain("Afrika");
  });

  it("falls back to en-ZA for unknown language", () => {
    const script = getFallbackScript("xx-XX", "Some topic");
    expect(script).toContain("Mzansi");
  });
});

// ---- VOICE CONFIG ----

describe("getAfricanVoiceConfig", () => {
  it("returns optimized config for en-ZA", () => {
    const config = getAfricanVoiceConfig("en-ZA");
    expect(config).toBeDefined();
    expect(config!.voice).toBe("af_sky");
    expect(config!.speed).toBe(1.05);
  });

  it("returns optimized config for en-NG", () => {
    const config = getAfricanVoiceConfig("en-NG");
    expect(config).toBeDefined();
    expect(config!.voice).toBe("af_bella");
    expect(config!.speed).toBe(1.1);
  });

  it("returns undefined for non-African language", () => {
    const config = getAfricanVoiceConfig("en-US");
    expect(config).toBeUndefined();
  });

  it("returns config for Zulu", () => {
    const config = getAfricanVoiceConfig("zu");
    expect(config).toBeDefined();
    expect(config!.speed).toBe(0.92);
  });
});

describe("isAfricanLanguage", () => {
  it("identifies African languages", () => {
    expect(isAfricanLanguage("en-ZA")).toBe(true);
    expect(isAfricanLanguage("en-NG")).toBe(true);
    expect(isAfricanLanguage("sw")).toBe(true);
    expect(isAfricanLanguage("zu")).toBe(true);
    expect(isAfricanLanguage("en-GH")).toBe(true);
  });

  it("rejects non-African languages", () => {
    expect(isAfricanLanguage("en-US")).toBe(false);
    expect(isAfricanLanguage("en-GB")).toBe(false);
    expect(isAfricanLanguage("fr-FR")).toBe(false);
  });
});

// ---- SCRIPT GENERATOR ----

describe("buildAfricanScriptPrompt", () => {
  it("includes language-specific rules for en-ZA", () => {
    const prompt = buildAfricanScriptPrompt("en-ZA", "ZA");
    expect(prompt).toContain("sharp sharp");
    expect(prompt).toContain("Mzansi");
    expect(prompt).toContain("Joburg");
  });

  it("includes Nigerian rules for en-NG", () => {
    const prompt = buildAfricanScriptPrompt("en-NG", "NG");
    expect(prompt).toContain("wahala");
    expect(prompt).toContain("Lagos");
  });

  it("falls back to en-ZA rules for unknown language", () => {
    const prompt = buildAfricanScriptPrompt("xx-XX", "ZA");
    expect(prompt).toContain("Mzansi");
  });
});

describe("languageToCountry", () => {
  it("maps language codes to countries", () => {
    expect(languageToCountry("en-ZA")).toBe("ZA");
    expect(languageToCountry("en-NG")).toBe("NG");
    expect(languageToCountry("sw")).toBe("KE");
    expect(languageToCountry("zu")).toBe("ZA");
    expect(languageToCountry("en-GH")).toBe("GH");
  });

  it("defaults to ZA for unknown", () => {
    expect(languageToCountry("xx-XX")).toBe("ZA");
  });
});
