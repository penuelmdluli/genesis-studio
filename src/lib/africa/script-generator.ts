// ============================================
// AFRICAN SCRIPT GENERATOR
// Generates authentically African voiceover scripts
// using Claude with country-specific writing rules
// ============================================

import { validateAfricanScript } from "./script-validator";
import { getFallbackScript } from "./fallback-scripts";

/**
 * Language-specific script writing rules for Claude.
 * These are injected into the system prompt when generating African content.
 */
export const AFRICAN_SCRIPT_RULES: Record<string, string> = {
  "en-ZA": `SOUTH AFRICAN ENGLISH (en-ZA) SCRIPT RULES:
- Use SA slang naturally: "eish", "sharp sharp", "lekker", "joh", "yoh", "aikona", "now now", "just now", "sho't left"
- Reference local places: Joburg, Jozi, Cape Town, Durban, Pretoria, Soweto, Sandton, Khayelitsha, Hillbrow
- Reference local institutions: Eskom, SARS, SAPS, Springboks, Bafana Bafana, SuperSport, SABC
- Sentence rhythm: short punchy sentences. Never long. "This is big. Very big. South Africa is watching."
- NEVER say "Hello everyone" — say "Eita Mzansi!" or "Yoh South Africa!" or "Sharp sharp people!"
- End with: "Follow for more. Stay sharp Mzansi." or similar SA-flavoured CTA
- Energy: confident, street-smart, township pride
- Example openers: "Eita Mzansi! This one is big, yoh." / "Joh South Africa — you need to hear this right now."
- Example closers: "That's the story Mzansi. Follow for more. Sharp sharp." / "Drop your thoughts below. We want to hear from you."`,

  "en-NG": `NIGERIAN ENGLISH (en-NG) SCRIPT RULES:
- Use Naija expressions: "e don happen", "na so e be", "wahala", "abeg", "oga", "e don do", "matter don burst", "no be small thing", "e don hot"
- Reference local places: Lagos, Abuja, Kano, PH (Port Harcourt), Oshodi, Lekki, Victoria Island, Eko
- Reference local institutions: NNPC, CBN, EFCC, Super Eagles, Nollywood, Alaba market
- Energy: HIGH. Nigerian content is loud, confident, exciting. Never flat. Always building to something.
- NEVER say "Hello everyone" — say "Nigerians!" or "Abeg pay attention!" or "Oga sit down!"
- End with: "Follow us for more. Nigeria we hail thee!" or similar Nigerian CTA
- Example openers: "Nigerians! Something big don happen o!" / "E don burst! This is the news you need today."
- Example closers: "Drop your comment below. What una think?" / "Follow for more. Nigeria we move!"`,

  sw: `SWAHILI (sw) SCRIPT RULES — Kenya/Tanzania/Uganda:
- Mix Swahili and English naturally (code-switching)
- Use: "Habari!", "Mambo", "Sawa sawa", "Pole pole", "Hakuna matata" (real usage, not joke), "Asante", "Karibu"
- Reference: Nairobi, Dar es Salaam, Kampala, Uhuru Park, Westlands, Kibera, Makerere
- Tone: authoritative but warm. Like a respected community elder.
- Sentence rhythm: measured, clear, dignified.
- Example openers: "Habari Afrika! Leo tuna habari kubwa sana." / "Kenya — mambo makubwa yamefanyika."
- End with a Swahili CTA encouraging comments and follows.`,

  zu: `ZULU (zu) SCRIPT RULES:
- Write script in ENGLISH but with Zulu words naturally woven in — NOT full Zulu translation
- Use: "Sawubona", "Yebo", "Eish", "Haibo", "Siyabonga", "Ngiyabonga", "Mzansi", "Ubuntu"
- Reference: KZN, Durban, Umhlanga, Soweto, eGoli (Joburg)
- Tone: warm community voice, like telling a neighbour. Never aggressive.
- Community storytelling energy.
- Example openers: "Sawubona Mzansi! Indaba enkulu namuhla." / "Yebo! Lalelani — lezi izindaba zibalulekile."
- End with a warm community CTA.`,

  "en-GH": `GHANAIAN ENGLISH (en-GH) SCRIPT RULES:
- Use: "Charlie", "My brother/sister", "Ei", "Tweaa", "Chale", "Yoo", "Ebi so"
- Reference: Accra, Kumasi, Tema, Osu, East Legon, Kantanka, Black Stars, Azumah Nelson
- Tone: smooth, measured, confident. Ghana is proud. Never rushed. Clear diction.
- Example openers: "Charlie — big news from Accra today." / "My people — Ghana has something to say."
- End with dignified CTA.`,

  "en-KE": `KENYAN ENGLISH (en-KE) SCRIPT RULES:
- Use Kenyan expressions naturally: "sasa", "poa", "buda", "maze", "si you know"
- Reference: Nairobi, Mombasa, Kisumu, Nakuru, Westlands, Kibera, KICC, Uhuru Gardens
- Tone: authoritative, newsroom quality. Kenyan media has a distinctive voice.
- Energy: measured but urgent when needed. East African gravitas.
- Example openers: "Kenya! Breaking news that affects us all." / "Nairobi — something major has happened."
- End with: "Follow for more. Kenya forward." or similar.`,
};

/**
 * Build the African script generation system prompt for Claude.
 */
export function buildAfricanScriptPrompt(
  language: string,
  country: string,
): string {
  const rules = AFRICAN_SCRIPT_RULES[language] || AFRICAN_SCRIPT_RULES["en-ZA"];

  return `You are an expert African content scriptwriter. You write voiceover scripts for short-form video (30-60 seconds).
Your scripts sound AUTHENTICALLY AFRICAN — the words, rhythm, slang, and cultural references must be real and natural.

${rules}

UNIVERSAL RULES:
- Script length: 80-150 words (30-60 seconds of narration)
- All sentences under 20 words. Prefer punchy 5-10 word sentences.
- Start with a culturally authentic hook. NEVER start with "Hello everyone" or "Good morning".
- End with a call to action: follow, share, comment, or drop thoughts below.
- Include at least one reference to a real place in ${country}.
- Write like you LIVE in ${country}. Not like a foreigner imitating.
- Include phonetic cues for emphasis (CAPS for important words).
- Leave room for dramatic pauses (use "..." between sections).
- DO NOT mention any brand names, websites, or apps.
- DO NOT use hashtags in the script (those go in captions, not voiceover).

OUTPUT: Return ONLY the raw script text. No titles, no labels, no markdown, no formatting.`;
}

/**
 * Map language code to country code for validation.
 */
export function languageToCountry(language: string): string {
  const map: Record<string, string> = {
    "en-ZA": "ZA",
    "en-NG": "NG",
    "en-GH": "GH",
    "en-KE": "KE",
    zu: "ZA",
    xh: "ZA",
    st: "ZA",
    af: "ZA",
    sw: "KE",
    yo: "NG",
    ig: "NG",
    ha: "NG",
    am: "ET",
  };
  return map[language] || "ZA";
}

/**
 * Generate an authentic African voiceover script using Claude.
 * Validates the output and retries up to 3 times.
 * Falls back to templates if all retries fail.
 */
export async function generateAfricanScript(
  topic: string,
  language: string,
  apiKey: string,
): Promise<{ script: string; usedFallback: boolean; validationIssues: string[] }> {
  const country = languageToCountry(language);
  const systemPrompt = buildAfricanScriptPrompt(language, country);

  let lastIssues: string[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const fixHints =
        attempt > 0 && lastIssues.length > 0
          ? `\n\nIMPORTANT: The previous script had these issues — FIX THEM:\n${lastIssues.map((i) => `- ${i}`).join("\n")}`
          : "";

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Write a voiceover script about: ${topic}${fixHints}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        console.error(`[AFRICAN SCRIPT] Claude API error (attempt ${attempt + 1}): ${response.status}`);
        continue;
      }

      const data = await response.json();
      const script = (data.content?.[0]?.text || "").trim();

      if (!script) {
        console.warn(`[AFRICAN SCRIPT] Empty script (attempt ${attempt + 1})`);
        continue;
      }

      // Validate
      const validation = validateAfricanScript(script, language, country);
      if (validation.valid) {
        console.log(`[AFRICAN SCRIPT] Valid script generated (attempt ${attempt + 1}, ${script.split(/\s+/).length} words)`);
        return { script, usedFallback: false, validationIssues: [] };
      }

      console.warn(`[AFRICAN SCRIPT] Validation failed (attempt ${attempt + 1}):`, validation.issues);
      lastIssues = validation.issues;
    } catch (err) {
      console.error(`[AFRICAN SCRIPT] Generation error (attempt ${attempt + 1}):`, err);
    }
  }

  // All retries failed — use fallback template
  console.warn(`[AFRICAN SCRIPT] All 3 attempts failed. Using fallback template for ${language}.`);
  const fallbackScript = getFallbackScript(language, topic);
  return {
    script: fallbackScript,
    usedFallback: true,
    validationIssues: lastIssues,
  };
}
