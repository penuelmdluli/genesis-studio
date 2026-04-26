// ============================================
// MBS Brand Safety Vetting
// Uses Claude vision to score candidates on
// child-brand safety before generation.
// ============================================

import { envString } from "@/lib/env";
import { pickCharacterForStyle } from "./character-picker";
import { buildCaption } from "./caption-template";

export interface SafetyScore {
  singleSubject: number;
  fullBody: number;
  brandSafe: number;
  danceQuality: number;
  lightingQuality: number;
  overall: number;
  flags: string[];
  reasoning: string;
  suggestedDanceStyle: string;
}

export async function vetCandidate(thumbnailUrl: string): Promise<SafetyScore> {
  const apiKey = envString("GENESIS_CLAUDE_KEY") || envString("ANTHROPIC_API_KEY");

  if (!apiKey) {
    console.warn("[Brand Safety] No Claude API key — auto-approving with score 70");
    return {
      singleSubject: 70, fullBody: 70, brandSafe: 70,
      danceQuality: 70, lightingQuality: 70, overall: 70,
      flags: ["no_vision_check"], reasoning: "Claude API key not configured",
      suggestedDanceStyle: "amapiano",
    };
  }

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
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "url", url: thumbnailUrl },
          },
          {
            type: "text",
            text: `Analyze this thumbnail from a dance video. We want to use it as a motion reference for a children's character animation brand called Mzansi Baby Stars (South African baby characters dancing).

Score 0-100 on each:
1. SINGLE_SUBJECT: One clear human dancing? (vs multiple, partial, occluded)
2. FULL_BODY: Full body visible? (critical for motion transfer)
3. BRAND_SAFE: Appropriate for children's brand? Score LOW if: sexually suggestive, twerking-focused, revealing clothing, alcohol/drugs, profane gestures, violence.
4. DANCE_QUALITY: Clear, rhythmic dance suitable for a baby character?
5. LIGHTING_QUALITY: Clear enough for good motion transfer?

Return ONLY valid JSON:
{
  "single_subject": <0-100>,
  "full_body": <0-100>,
  "brand_safe": <0-100>,
  "dance_quality": <0-100>,
  "lighting_quality": <0-100>,
  "flags": [<list of concerns>],
  "reasoning": "<one sentence>",
  "suggested_dance_style": "<amapiano|gqom|pantsula|bacardi|hiphop|other>"
}`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    console.error("[Brand Safety] Claude API failed:", response.status);
    return {
      singleSubject: 60, fullBody: 60, brandSafe: 60,
      danceQuality: 60, lightingQuality: 60, overall: 60,
      flags: ["api_failed"], reasoning: `Claude API returned ${response.status}`,
      suggestedDanceStyle: "amapiano",
    };
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";

  try {
    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const result = JSON.parse(jsonStr);

    const overall =
      result.single_subject * 0.20 +
      result.full_body * 0.20 +
      result.brand_safe * 0.35 +
      result.dance_quality * 0.15 +
      result.lighting_quality * 0.10;

    return {
      singleSubject: result.single_subject,
      fullBody: result.full_body,
      brandSafe: result.brand_safe,
      danceQuality: result.dance_quality,
      lightingQuality: result.lighting_quality,
      overall,
      flags: result.flags ?? [],
      reasoning: result.reasoning ?? "",
      suggestedDanceStyle: result.suggested_dance_style ?? "amapiano",
    };
  } catch {
    return {
      singleSubject: 60, fullBody: 60, brandSafe: 60,
      danceQuality: 60, lightingQuality: 60, overall: 60,
      flags: ["parse_failed"], reasoning: "Could not parse Claude response",
      suggestedDanceStyle: "amapiano",
    };
  }
}

/**
 * Generate auto-suggestions for a candidate based on safety check results.
 */
export async function generateSuggestions(danceStyle: string, creatorHandle?: string) {
  const character = await pickCharacterForStyle(danceStyle);

  const settings: Record<string, string> = {
    amapiano: "vibrant Soweto street, golden hour, township party atmosphere",
    gqom: "Durban beachfront, sunset, energetic crowd",
    pantsula: "Johannesburg CBD, morning light, urban setting",
    bacardi: "Cape Town colorful Bo-Kaap, bright day",
    hiphop: "studio with neon lights, urban vibes",
    other: "South African township, golden hour, joyful atmosphere",
  };

  const setting = settings[danceStyle] ?? settings.other;

  const caption = buildCaption({
    character: character.name,
    setting,
    hook: creatorHandle ? `Inspired by @${creatorHandle}` : undefined,
  });

  return { character, setting, caption };
}
