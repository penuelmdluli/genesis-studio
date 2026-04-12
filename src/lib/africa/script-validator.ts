// ============================================
// AFRICAN SCRIPT VALIDATOR
// Validates scripts for authentic African content
// before sending to TTS. Rejects generic scripts.
// ============================================

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * Validate that a script sounds authentically African for its target language/country.
 */
export function validateAfricanScript(
  script: string,
  language: string,
  country: string,
): ValidationResult {
  const issues: string[] = [];
  const scriptLower = script.toLowerCase();

  // CHECK 1: Minimum/maximum word count
  const wordCount = script.split(/\s+/).filter(Boolean).length;
  if (wordCount < 80) {
    issues.push(`Script too short: ${wordCount} words. Need 80-150.`);
  }
  if (wordCount > 200) {
    issues.push(`Script too long: ${wordCount} words. Max 150 preferred.`);
  }

  // CHECK 2: Must start with country-specific opener
  const validOpeners: Record<string, string[]> = {
    "en-ZA": ["eita", "yoh", "joh", "sharp", "mzansi", "eish", "south africa"],
    "en-NG": ["nigeria", "nigerians", "e don", "abeg", "oga", "big news", "naija"],
    sw: ["habari", "leo", "taarifa", "kenya", "mambo", "afrika"],
    zu: ["sawubona", "yebo", "haibo", "indaba", "mzansi"],
    "en-GH": ["charlie", "ghana", "accra", "ei", "chale", "my people"],
    "en-KE": ["kenya", "kenyans", "nairobi", "habari", "breaking"],
  };

  const openers = validOpeners[language] || validOpeners["en-ZA"] || [];
  const scriptStart = scriptLower.substring(0, 80);
  const hasProperOpener = openers.some((o) => scriptStart.includes(o));
  if (!hasProperOpener) {
    issues.push(`Missing African opener for ${language}. Start: "${script.substring(0, 40)}..."`);
  }

  // CHECK 3: No sentences over 25 words
  const sentences = script.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  for (const sentence of sentences) {
    const sWords = sentence.trim().split(/\s+/).length;
    if (sWords > 25) {
      issues.push(`Sentence too long (${sWords} words): "${sentence.trim().substring(0, 50)}..."`);
    }
  }

  // CHECK 4: Must include country reference
  const countryKeywords: Record<string, string[]> = {
    ZA: ["south africa", "mzansi", "joburg", "cape town", "pretoria", "durban", "sa"],
    NG: ["nigeria", "lagos", "abuja", "naija", "nigerian"],
    KE: ["kenya", "nairobi", "kenyan", "east africa"],
    GH: ["ghana", "accra", "ghanaian", "kumasi"],
    TZ: ["tanzania", "dar es salaam", "dodoma"],
    UG: ["uganda", "kampala", "ugandan"],
  };

  const keywords = countryKeywords[country] || [];
  if (keywords.length > 0) {
    const hasCountryRef = keywords.some((k) => scriptLower.includes(k));
    if (!hasCountryRef) {
      issues.push(`No ${country} country reference found in script.`);
    }
  }

  // CHECK 5: Must have a CTA at end
  const scriptEnd = scriptLower.slice(-120);
  const hasCTA =
    scriptEnd.includes("follow") ||
    scriptEnd.includes("share") ||
    scriptEnd.includes("comment") ||
    scriptEnd.includes("subscribe") ||
    scriptEnd.includes("drop");
  if (!hasCTA) {
    issues.push("Missing call to action at end of script.");
  }

  // CHECK 6: No generic opener words
  const genericOpeners = [
    "hello everyone",
    "good morning",
    "welcome everyone",
    "today we",
    "in this video",
    "hi guys",
    "hey everyone",
  ];
  for (const generic of genericOpeners) {
    if (scriptLower.startsWith(generic)) {
      issues.push(`Generic opener detected: "${generic}". Use African opener.`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
