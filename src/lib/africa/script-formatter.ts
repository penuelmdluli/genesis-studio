// ============================================
// AFRICAN SCRIPT FORMATTER FOR TTS
// Formats raw scripts so Kokoro reads them
// the way a real African narrator would
// ============================================

import { applyPronunciationCorrections } from "./pronunciation-guide";

/**
 * Format a script for natural-sounding African TTS output.
 * Adds pauses, emphasis, number formatting, and pronunciation corrections.
 */
export function formatScriptForTTS(
  script: string,
  language: string,
): string {
  let formatted = script;

  // 1. Break long sentences into short ones
  formatted = breakLongSentences(formatted);

  // 2. Add strategic pauses
  formatted = addStrategicPauses(formatted);

  // 3. Add emphasis on key words
  formatted = addEmphasis(formatted, language);

  // 4. Format numbers for natural speech
  formatted = formatNumbers(formatted, language);

  // 5. Expand abbreviations
  formatted = expandAbbreviations(formatted);

  // 6. Apply pronunciation corrections (LAST — after all text transforms)
  formatted = applyPronunciationCorrections(formatted);

  return formatted;
}

function addStrategicPauses(text: string): string {
  return text
    .replace(/\. ([A-Z])/g, ". ... $1") // pause between sentences
    .replace(/! ([A-Z])/g, "! ... $1") // pause after exclamation
    .replace(/ But /g, ", but ")
    .replace(/ However /g, ", however, ")
    .replace(/ Now, /g, " Now... ");
}

function addEmphasis(text: string, language: string): string {
  const emphasisWords: Record<string, string[]> = {
    "en-ZA": [
      "breaking", "major", "huge", "crisis", "collapsed",
      "record", "historic", "shocking", "millions",
    ],
    "en-NG": [
      "big", "massive", "serious", "wahala", "burst", "hot", "done",
    ],
    sw: ["kubwa", "muhimu", "hatari", "leo"],
    zu: ["enkulu", "ebalulekile", "namuhla"],
    "en-GH": ["big", "massive", "critical", "historic"],
    "en-KE": ["major", "critical", "breaking", "historic"],
  };

  const words = emphasisWords[language] || emphasisWords["en-ZA"] || [];
  let result = text;
  for (const word of words) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(regex, word.toUpperCase());
  }
  return result;
}

function breakLongSentences(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const result: string[] = [];

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    if (words.length > 20) {
      // Find a natural break point near the middle
      const midpoint = Math.floor(words.length / 2);
      const breakWords = ["and", "but", "which", "that", "because", "while", "where", "when", "so"];
      let breakIndex = -1;

      // Search around midpoint for a natural break word
      for (let offset = 0; offset <= 5; offset++) {
        for (const dir of [0, 1]) {
          const idx = dir === 0 ? midpoint - offset : midpoint + offset;
          if (idx > 3 && idx < words.length - 3 && breakWords.includes(words[idx].toLowerCase())) {
            breakIndex = idx;
            break;
          }
        }
        if (breakIndex !== -1) break;
      }

      if (breakIndex !== -1) {
        const first = words.slice(0, breakIndex).join(" ");
        const second = words.slice(breakIndex).join(" ");
        result.push(first + ".");
        result.push(second.charAt(0).toUpperCase() + second.slice(1));
      } else {
        result.push(sentence);
      }
    } else {
      result.push(sentence);
    }
  }

  return result.join(" ");
}

function formatNumbers(text: string, language: string): string {
  // South African Rand amounts
  let result = text.replace(/R\s?(\d[\d,]*)/g, (_match, num: string) => {
    const clean = num.replace(/,/g, "");
    const n = parseInt(clean, 10);
    if (isNaN(n)) return _match;
    return `${numberToWords(n)} rand`;
  });

  // Dollar amounts
  result = result.replace(/\$(\d[\d,]*)/g, (_match, num: string) => {
    const clean = num.replace(/,/g, "");
    const n = parseInt(clean, 10);
    if (isNaN(n)) return _match;
    return `${numberToWords(n)} dollars`;
  });

  // Percentages
  result = result.replace(/(\d+(?:\.\d+)?)\s*%/g, "$1 percent");

  return result;
}

function numberToWords(n: number): string {
  if (n === 0) return "zero";
  if (n >= 1_000_000_000) {
    const b = Math.floor(n / 1_000_000_000);
    const rem = n % 1_000_000_000;
    return `${numberToWords(b)} billion${rem > 0 ? ` ${numberToWords(rem)}` : ""}`;
  }
  if (n >= 1_000_000) {
    const m = Math.floor(n / 1_000_000);
    const rem = n % 1_000_000;
    return `${numberToWords(m)} million${rem > 0 ? ` ${numberToWords(rem)}` : ""}`;
  }
  if (n >= 1000) {
    const t = Math.floor(n / 1000);
    const rem = n % 1000;
    return `${numberToWords(t)} thousand${rem > 0 ? ` ${numberToWords(rem)}` : ""}`;
  }
  if (n >= 100) {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    return `${numberToWords(h)} hundred${rem > 0 ? ` and ${numberToWords(rem)}` : ""}`;
  }

  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  if (n < 20) return ones[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return tens[t] + (o > 0 ? `-${ones[o]}` : "");
}

function expandAbbreviations(text: string): string {
  const expansions: Record<string, string> = {
    "ANC": "the A-N-C",
    "DA": "the D-A",
    "EFF": "the E-F-F",
    "GDP": "the G-D-P",
    "SAPS": "the S-A-P-S",
    "SARS": "S-A-R-S",
    "CBN": "the C-B-N",
    "EFCC": "the E-F-C-C",
    "NNPC": "the N-N-P-C",
    "IMF": "the I-M-F",
    "AU": "the A-U",
    "UN": "the U-N",
    "WHO": "the W-H-O",
    "FIFA": "FEE-fa",
    "VAR": "V-A-R",
  };

  let result = text;
  for (const [abbr, expanded] of Object.entries(expansions)) {
    const regex = new RegExp(`\\b${abbr}\\b`, "g");
    result = result.replace(regex, expanded);
  }
  return result;
}
