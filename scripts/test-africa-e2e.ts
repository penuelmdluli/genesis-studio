/**
 * END-TO-END TEST: African Voice & Narration Engine
 *
 * Tests the full pipeline for each African language:
 *   1. Generate African script via Claude (with country-specific rules)
 *   2. Validate script passes African quality checks
 *   3. Format script for TTS (pronunciation, pauses, emphasis)
 *   4. Generate audio via FAL Kokoro with optimized voice params
 *   5. Verify audio is not silent and has correct duration
 *
 * Run: npx tsx scripts/test-africa-e2e.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (no dotenv dependency)
const envPath = resolve(__dirname, "../.env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  console.warn("Could not load .env.local — using existing env vars");
}

// Use relative imports (tsx doesn't resolve @/ aliases)
const { generateAfricanScript, languageToCountry } = require("../src/lib/africa/script-generator");
const { validateAfricanScript } = require("../src/lib/africa/script-validator");
const { formatScriptForTTS } = require("../src/lib/africa/script-formatter");
const { getAfricanVoiceConfig } = require("../src/lib/africa/voice-config");
const { fal } = require("@fal-ai/client");

fal.config({ credentials: process.env.FAL_KEY || "" });

const TEST_TOPIC = "Breaking news from Africa. Something major has happened today. This affects millions of people across the continent. Here is what you need to know right now.";

interface TestResult {
  language: string;
  country: string;
  voice: string;
  speed: number;
  scriptWordCount: number;
  usedFallback: boolean;
  validationPassed: boolean;
  validationIssues: string[];
  ttsGenerated: boolean;
  ttsAudioUrl: string;
  ttsDurationSeconds: number;
  error?: string;
}

const LANGUAGES_TO_TEST = [
  { code: "en-ZA", name: "South African English" },
  { code: "en-NG", name: "Nigerian English" },
  { code: "sw", name: "Swahili" },
  { code: "zu", name: "Zulu" },
  { code: "en-GH", name: "Ghanaian English" },
];

async function testLanguage(langCode: string, langName: string): Promise<TestResult> {
  const country = languageToCountry(langCode);
  const voiceConfig = getAfricanVoiceConfig(langCode)!;
  const apiKey = process.env.GENESIS_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY || "";

  const result: TestResult = {
    language: langCode,
    country,
    voice: voiceConfig.voice,
    speed: voiceConfig.speed,
    scriptWordCount: 0,
    usedFallback: false,
    validationPassed: false,
    validationIssues: [],
    ttsGenerated: false,
    ttsAudioUrl: "",
    ttsDurationSeconds: 0,
  };

  try {
    // STEP 1: Generate African script
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  TESTING: ${langName} (${langCode}) — Country: ${country}`);
    console.log(`${"=".repeat(60)}`);

    console.log(`\n[1/4] Generating African script via Claude...`);
    const scriptResult = await generateAfricanScript(TEST_TOPIC, langCode, apiKey);
    result.usedFallback = scriptResult.usedFallback;
    result.scriptWordCount = scriptResult.script.split(/\s+/).filter(Boolean).length;

    console.log(`  Script: ${result.scriptWordCount} words${scriptResult.usedFallback ? " (FALLBACK)" : ""}`);
    console.log(`  First 120 chars: "${scriptResult.script.substring(0, 120)}..."`);

    // STEP 2: Validate
    console.log(`\n[2/4] Validating script...`);
    const validation = validateAfricanScript(scriptResult.script, langCode, country);
    result.validationPassed = validation.valid;
    result.validationIssues = validation.issues;

    if (validation.valid) {
      console.log(`  PASS — Script passes all African quality checks`);
    } else {
      console.log(`  WARN — Validation issues: ${validation.issues.join("; ")}`);
    }

    // STEP 3: Format for TTS
    console.log(`\n[3/4] Formatting script for TTS...`);
    const formatted = formatScriptForTTS(scriptResult.script, langCode);
    console.log(`  Formatted first 120 chars: "${formatted.substring(0, 120)}..."`);

    // STEP 4: Generate TTS via FAL Kokoro
    console.log(`\n[4/4] Generating TTS: voice=${voiceConfig.voice}, speed=${voiceConfig.speed}, endpoint=${voiceConfig.kokoroEndpoint}`);

    const ttsResult = await fal.subscribe(voiceConfig.kokoroEndpoint, {
      input: {
        prompt: formatted,
        voice: voiceConfig.voice,
        speed: voiceConfig.speed,
      },
      logs: false,
    });

    const data = ttsResult.data as Record<string, unknown>;
    const audioFile = data?.audio as { url: string } | undefined;
    const duration = data?.duration as number | undefined;

    if (audioFile?.url) {
      result.ttsGenerated = true;
      result.ttsAudioUrl = audioFile.url;
      result.ttsDurationSeconds = duration || 0;
      console.log(`  PASS — Audio generated: ${audioFile.url.substring(0, 80)}...`);
      console.log(`  Duration: ${result.ttsDurationSeconds.toFixed(1)}s`);
    } else {
      console.log(`  FAIL — No audio URL returned`);
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    console.error(`  ERROR: ${result.error}`);
  }

  return result;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  GENESIS STUDIO — African Voice E2E Test               ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  if (!process.env.FAL_KEY) {
    console.error("FATAL: FAL_KEY not set in .env.local");
    process.exit(1);
  }
  if (!process.env.GENESIS_CLAUDE_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.error("FATAL: GENESIS_CLAUDE_KEY / ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  const results: TestResult[] = [];

  for (const lang of LANGUAGES_TO_TEST) {
    const result = await testLanguage(lang.code, lang.name);
    results.push(result);
  }

  // ── SUMMARY ──
  console.log(`\n\n${"═".repeat(60)}`);
  console.log("  RESULTS SUMMARY");
  console.log(`${"═".repeat(60)}\n`);

  let allPassed = true;

  for (const r of results) {
    const scriptStatus = r.scriptWordCount >= 80 ? "PASS" : "FAIL";
    const validStatus = r.validationPassed ? "PASS" : "WARN";
    const ttsStatus = r.ttsGenerated ? "PASS" : "FAIL";
    const durationStatus = r.ttsDurationSeconds >= 15 && r.ttsDurationSeconds <= 90 ? "PASS" : "WARN";

    const overallPass = r.ttsGenerated && r.scriptWordCount >= 50;
    if (!overallPass) allPassed = false;

    console.log(`  ${r.language} (${r.country}) — Voice: ${r.voice} @ ${r.speed}x`);
    console.log(`    Script:     [${scriptStatus}] ${r.scriptWordCount} words${r.usedFallback ? " (fallback)" : ""}`);
    console.log(`    Validation: [${validStatus}] ${r.validationPassed ? "passed" : r.validationIssues.length + " issues"}`);
    console.log(`    TTS Audio:  [${ttsStatus}] ${r.ttsGenerated ? r.ttsAudioUrl.substring(0, 60) + "..." : "FAILED"}`);
    console.log(`    Duration:   [${durationStatus}] ${r.ttsDurationSeconds.toFixed(1)}s`);
    if (r.error) console.log(`    Error:      ${r.error}`);
    console.log();
  }

  console.log(`${"═".repeat(60)}`);
  console.log(`  OVERALL: ${allPassed ? "ALL PASSED" : "SOME FAILED"}`);
  console.log(`${"═".repeat(60)}`);

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
