// ============================================
// GENESIS BRAIN — AI Director Planner
// Uses Claude API to create production plans
// ============================================

import { BrainInput, ScenePlan, SceneDefinition, CharacterDefinition, VoiceoverTiming, ModelId, TransitionType, VideoStyle } from "@/types";
import { AI_MODELS } from "@/lib/constants";

const BRAIN_SYSTEM_PROMPT = `You are Genesis Brain, the world's most advanced AI film director.
You take a user's creative concept and produce a production-ready shot list as a JSON object.

YOU ARE AN EXPERT AT:
- Cinematic storytelling and visual narrative structure
- Camera movements: dolly, pan, tilt, orbit, crane, handheld, drone, steadicam
- Lighting: golden hour, studio, natural, dramatic, neon, candlelight
- Color grading: warm, cool, vintage, modern, desaturated, vibrant
- Pacing: building tension, creating rhythm, delivering payoff
- Music selection: matching mood, tempo, and energy to visuals
- Typography: when and how to use text overlays effectively

RULES:
1. Break the concept into 3-8 scenes based on target duration
2. Each scene: 3-10 seconds (AI models generate best at 5s)
3. Prompts must be EXTREMELY specific and VISUAL:
   - Describe EXACTLY what the camera sees
   - Include lighting direction and quality
   - Include camera movement with speed
   - Include depth of field and focus
   - Include atmospheric details (fog, particles, bokeh)
4. CHARACTER CONSISTENCY: Use the EXACT same description string for any character across ALL scenes they appear in.
5. Pick optimal model per scene:
   - Hollywood scenes with dialogue/sound: "kling-2.6" (native audio, best for talking/sound)
   - Hero cinematic shots (no audio needed): "wan-2.2" (best open-source quality)
   - Scenes with important dialogue: "kling-3.0" (best character consistency + audio)
   - Budget/fast shots: "wan-2.2" (reliable, always works)
6. Transitions should feel PROFESSIONAL:
   - Default to "crossfade" for most cuts
   - Use "cut" for energy and impact
   - Use "fade_black" for time passage
7. Keep total scene duration within 10% of target
8. If voiceover requested: write NATURAL conversational script timed to scenes
9. Text overlays: use sparingly — opening hook, key stats, CTA at end

VALID MODELS: "wan-2.2", "kling-2.6", "kling-3.0", "veo-3.1", "seedance-1.5"
VALID TRANSITIONS: "cut", "crossfade", "fade_black", "fade_white", "wipe_left", "wipe_right", "zoom_in", "zoom_out", "glitch", "blur"
VALID RESOLUTIONS: "480p", "720p", "1080p"

OUTPUT: Return ONLY a valid JSON ScenePlan. No markdown. No explanation.`;

function buildUserPrompt(input: BrainInput): string {
  let prompt = `CONCEPT: "${input.concept}"
TARGET DURATION: ${input.targetDuration} seconds
STYLE: ${input.style}
ASPECT RATIO: ${input.aspectRatio === "landscape" ? "16:9" : input.aspectRatio === "portrait" ? "9:16" : "1:1"}`;

  if (input.voiceover) {
    prompt += `\nVOICEOVER: Yes (language: ${input.voiceoverLanguage || "en-US"})`;
  }
  if (input.music) {
    prompt += `\nMUSIC: Yes — select appropriate mood and tempo`;
  }
  if (input.captions) {
    prompt += `\nCAPTIONS: Yes — generate subtitle text from voiceover`;
  }
  if (input.brandKit?.colors?.length) {
    prompt += `\nBRAND COLORS: ${input.brandKit.colors.join(", ")}`;
  }
  if (input.characterRefs?.length) {
    prompt += `\nCHARACTER REFERENCES: ${input.characterRefs.length} reference image(s) provided — describe characters in detail`;
  }

  prompt += `\n\nGenerate the ScenePlan JSON now.`;
  return prompt;
}

export async function planProduction(input: BrainInput): Promise<ScenePlan> {
  // Validate input
  if (!input.concept || input.concept.trim().length < 10) {
    throw new Error("Concept must be at least 10 characters long");
  }
  if (input.concept.length > 5000) {
    throw new Error("Concept must be under 5000 characters");
  }
  if (input.targetDuration < 15 || input.targetDuration > 120) {
    throw new Error("Target duration must be between 15 and 120 seconds");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured. Brain features require a Claude API key.");
  }

  const userPrompt = buildUserPrompt(input);

  // Call Claude API
  let plan: ScenePlan;
  let retries = 0;
  const maxRetries = 2;

  while (retries <= maxRetries) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: BRAIN_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: retries > 0
                ? userPrompt + "\n\nIMPORTANT: Return ONLY valid JSON. No markdown code blocks. No explanation text. Just the raw JSON object."
                : userPrompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Claude API error (${response.status}): ${errorBody}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || "";

      // Parse JSON — strip markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      plan = JSON.parse(jsonStr);
      break;
    } catch (err) {
      retries++;
      if (retries > maxRetries) {
        throw new Error(`Failed to generate production plan after ${maxRetries + 1} attempts: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
  }

  // Validate and sanitize the plan
  plan = validateAndSanitizePlan(plan!, input);

  return plan;
}

function validateAndSanitizePlan(plan: ScenePlan, input: BrainInput): ScenePlan {
  // Ensure required fields
  if (!plan.title) plan.title = input.concept.slice(0, 60);
  if (!plan.scenes || plan.scenes.length === 0) {
    throw new Error("Plan must have at least one scene");
  }
  if (plan.scenes.length > 12) {
    plan.scenes = plan.scenes.slice(0, 12);
  }
  if (!plan.characters) plan.characters = [];
  if (!plan.colorPalette) plan.colorPalette = ["#8b5cf6", "#06b6d4", "#1a1a2e"];
  if (!plan.musicMood) plan.musicMood = "ambient";
  if (!plan.musicTempo) plan.musicTempo = "medium";
  if (!plan.overallStyle) plan.overallStyle = input.style;

  const validModels = Object.keys(AI_MODELS) as ModelId[];
  const validTransitions: TransitionType[] = ["cut", "crossfade", "fade_black", "fade_white", "wipe_left", "wipe_right", "zoom_in", "zoom_out", "glitch", "blur"];

  // Validate each scene
  plan.scenes = plan.scenes.map((scene, i) => {
    const s: SceneDefinition = {
      sceneNumber: i + 1,
      description: scene.description || `Scene ${i + 1}`,
      prompt: scene.prompt || scene.description || "",
      negativePrompt: scene.negativePrompt || getDefaultNegativePrompt(),
      modelId: validModels.includes(scene.modelId as ModelId) ? scene.modelId as ModelId : "wan-2.2",
      duration: Math.max(3, Math.min(10, scene.duration || 5)),
      resolution: scene.resolution || "720p",
      cameraMovement: scene.cameraMovement || "slow push-in",
      transitionIn: validTransitions.includes(scene.transitionIn) ? scene.transitionIn : "crossfade",
      transitionOut: validTransitions.includes(scene.transitionOut) ? scene.transitionOut : "crossfade",
      textOverlay: scene.textOverlay,
      voiceoverLine: scene.voiceoverLine,
      soundEffect: scene.soundEffect,
      characterIds: scene.characterIds,
      colorGrade: scene.colorGrade,
    };

    // Ensure prompt is not empty
    if (!s.prompt.trim()) {
      s.prompt = s.description;
    }

    return s;
  });

  // Calculate total duration
  plan.totalDuration = plan.scenes.reduce((sum, s) => sum + s.duration, 0);

  // Generate voiceover timings if needed
  if (input.voiceover && plan.voiceoverScript && !plan.voiceoverTimings) {
    plan.voiceoverTimings = generateTimings(plan);
  }

  return plan;
}

function generateTimings(plan: ScenePlan): VoiceoverTiming[] {
  const timings: VoiceoverTiming[] = [];
  let currentTime = 0;

  for (const scene of plan.scenes) {
    if (scene.voiceoverLine) {
      timings.push({
        sceneNumber: scene.sceneNumber,
        text: scene.voiceoverLine,
        startTime: currentTime + 0.5,
        endTime: currentTime + scene.duration - 0.5,
      });
    }
    currentTime += scene.duration;
  }

  return timings;
}

function getDefaultNegativePrompt(): string {
  return "inconsistent lighting, style change, color shift, different person, face change, warped features, blurry, low quality, watermark, text artifacts, morphing, deformed hands, extra fingers, duplicate subjects, floating objects";
}

/**
 * Calculate credits for a Brain production
 */
export function calculateBrainCredits(plan: ScenePlan, input: BrainInput): number {
  let total = 2; // Planning fee (Claude API call)

  // Scene generation credits
  for (const scene of plan.scenes) {
    const model = AI_MODELS[scene.modelId];
    if (model) {
      const baseCost = model.creditCost[scene.resolution] || model.creditCost["720p"] || 8;
      const durationMultiplier = Math.max(1, scene.duration / 5);
      total += Math.ceil(baseCost * durationMultiplier);
    } else {
      total += 8; // Default cost
    }
  }

  // Audio credits
  if (input.voiceover) total += 3;
  if (input.music) total += 2;
  if (input.captions) total += 1;

  // Assembly fee
  total += 3;

  // Multi-format export
  if (input.outputFormats && input.outputFormats.length > 1) {
    total += (input.outputFormats.length - 1) * 2;
  }

  return total;
}

/**
 * Estimate credits before planning (rough estimate based on input only)
 */
export function estimateBrainCredits(input: BrainInput): number {
  const scenesEstimate = Math.max(3, Math.ceil(input.targetDuration / 8));
  const avgCostPerScene = 10;

  let total = 2; // Planning
  total += scenesEstimate * avgCostPerScene;
  if (input.voiceover) total += 3;
  if (input.music) total += 2;
  if (input.captions) total += 1;
  total += 3; // Assembly
  if (input.outputFormats && input.outputFormats.length > 1) {
    total += (input.outputFormats.length - 1) * 2;
  }

  return total;
}
