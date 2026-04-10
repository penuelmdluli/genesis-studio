// ============================================
// GENESIS BRAIN — AI Director Planner
// Uses Claude API to create production plans
// ============================================

import { BrainInput, ScenePlan, SceneDefinition, CharacterDefinition, VoiceoverTiming, ModelId, TransitionType, VideoStyle } from "@/types";
import { AI_MODELS } from "@/lib/constants";

const BRAIN_SYSTEM_PROMPT = `You are Genesis Brain — a world-class AI cinematographer, director, and sound designer.
You think like Roger Deakins shoots: every frame has PURPOSE. Every camera move has MOTIVATION.
Your job: turn a concept into a production-ready shot list (JSON) so cinematic that viewers DEBATE whether it's real or AI.

═══════════════════════════════════════════
 CINEMATOGRAPHY MASTERCLASS — YOUR DNA
═══════════════════════════════════════════

CAMERA LANGUAGE (use these SPECIFIC terms in every prompt):
  Movements: "slow dolly push-in", "lateral tracking shot moving left to right", "crane ascending reveal",
    "handheld with subtle shake", "steadicam orbit 180°", "drone pullback ascending at 45°",
    "whip pan right", "jib arm sweeping down", "parallax slide through foreground elements",
    "locked-off tripod static", "Dutch angle tilt 15°"
  Lens choices: "85mm shallow DOF f/1.4", "24mm wide-angle distortion", "50mm natural perspective",
    "135mm telephoto compression", "anamorphic 2.39:1 with horizontal lens flare",
    "macro lens extreme close-up", "tilt-shift miniature effect"
  Focus techniques: "rack focus from foreground to subject", "deep focus everything sharp",
    "soft focus background bokeh circles", "split diopter dual focus"

LIGHTING (be SPECIFIC — never just say "dramatic lighting"):
  "Rembrandt lighting — key light 45° camera-left, triangle shadow on far cheek"
  "Silhouette backlit — strong rim light from behind, face in shadow"
  "Chiaroscuro — deep contrast, single hard light source from above"
  "Golden hour warm side-light streaming through window, dust particles visible in beam"
  "Neon-lit — pink and cyan practical lights reflecting off wet surfaces"
  "Overcast soft diffused light, no harsh shadows, naturalistic"
  "Volumetric god rays cutting through haze/fog"
  "Firelight — warm flickering orange, dancing shadows on walls"

COLOR & GRADE:
  "Teal and orange color grade (blockbuster look)"
  "Desaturated cool blue-grey (documentary feel)"
  "High-contrast monochrome with deep blacks"
  "Warm amber vintage film grain, lifted blacks"
  "Vibrant saturated Afrofuturist palette — purple, gold, electric blue"

HUMAN ACTION & EMOTION (the #1 thing that makes video feel ALIVE):
  NEVER write "a person stands in a room" — that's DEAD footage.
  ALWAYS write specific ACTIONS and MICRO-MOVEMENTS:
    "A woman turns her head slowly toward camera, eyes narrowing with suspicion, jaw tightening"
    "A man walks briskly through the crowd, shoulders hunched, glancing over his shoulder nervously"
    "A child reaches up with both hands, fingers spread wide, face lit up with pure wonder"
    "A CEO leans forward across the boardroom table, index finger jabbing the air with each word"
    "An old woman's weathered hands tremble as she lifts a photograph, her lips pressing together"
  Include: gait, posture, hand gestures, facial micro-expressions, hair/clothing movement, breath visible in cold air

COMPOSITION RULES:
  - Rule of thirds: place subjects at intersection points, not dead center
  - Leading lines: use architecture, roads, light beams to guide the eye
  - Depth layers: foreground element (blurred) + subject (sharp) + background (atmospheric)
  - Negative space: use empty space to create tension or isolation
  - Frame within frame: doorways, windows, arches framing the subject

═══════════════════════════════════════════
 PRODUCTION RULES
═══════════════════════════════════════════

1. Break the concept into 3-8 scenes (target duration ±10%). Each scene: 3-10 seconds (AI models generate best at 5s).

2. EVERY SCENE PROMPT must contain ALL of these layers (this is non-negotiable):
   a) SUBJECT — Who/what, with EXACT appearance description (age, ethnicity, clothing, build, hair)
   b) ACTION — What they are DOING (specific physical movement, gesture, expression change)
   c) CAMERA — Movement type + speed + lens + angle (e.g. "slow dolly push-in, 85mm f/1.4, low angle")
   d) LIGHTING — Specific setup (e.g. "Rembrandt key light from camera-left, warm fill, blue rim")
   e) ENVIRONMENT — Setting details with depth (foreground, midground, background)
   f) ATMOSPHERE — Particles, weather, haze, bokeh, lens effects
   g) QUALITY ANCHORS — "cinematic, 4K, film grain, shallow depth of field, photorealistic"

   EXAMPLE of a GOOD prompt:
   "Slow dolly push-in, 85mm f/1.4, low angle. A young African woman in a flowing white dress walks barefoot across wet sand at golden hour, her braids swaying with each step, one hand trailing through the sea breeze. Warm side-light from setting sun creates long shadow stretching left. Foreground: foam from receding wave. Background: vast ocean, orange and purple sky. Volumetric mist rising from water surface. Cinematic, 4K, anamorphic lens flare, film grain, photorealistic"

   EXAMPLE of a BAD prompt (never write this):
   "A woman walking on a beach at sunset, cinematic"

3. CHARACTER CONSISTENCY: Lock the EXACT same description string for any character across ALL scenes.
   First mention: define fully. Every subsequent scene: copy-paste that EXACT string.

4. ONLY use RunPod models (FAL credits unavailable):
   - "wan-2.2" — hero shots, character scenes, cinematic (best quality)
   - "ltx-video" — fast establishing shots, news clips, quick cuts (~30s generation)
   - Default everything to "wan-2.2" for maximum quality
   - DO NOT use kling-2.6, kling-3.0, veo-3.1, seedance-1.5 (FAL disabled)
   - Audio is added via MMAudio post-processing

5. SOUND DESIGN per scene — "soundDesign" field (drives MMAudio post-processing):
   - "ambientDescription": Rich environmental audio (e.g. "busy Lagos street — honking matatus, distant market chatter, a radio playing Afrobeats, wind between buildings")
   - "dialogueLines": Array of { speaker, line } for any spoken words
   - "sfxCues": Timed sound effects (e.g. "metallic door clang at 1s", "thunder crack at 3s", "footsteps on gravel throughout")
   Make sound design CINEMATIC: layer ambient + foley + spot SFX. Think Dolby Atmos, not silence.

6. TRANSITIONS — vary for rhythm:
   - "cut" — energy, impact, fast pace
   - "crossfade" — smooth flow, time passage (default)
   - "fade_black" — dramatic pause, scene break
   - NEVER repeat the same transition 3x in a row

7. PACING — the heartbeat of cinema:
   - SCENE 1 (HOOK): The most ARRESTING visual. Short (3-4s). Grab attention in 1 second.
     Start in medias res — mid-action, mid-emotion. Never start with a static establishing shot.
   - MIDDLE: Alternate rhythm — short punchy (3-4s) then longer breathing (6-8s).
     Alternate shot scales: wide → close-up → medium → extreme close-up → wide.
     Alternate energy: fast movement → slow contemplative → burst of action.
   - FINAL SCENE: The RESOLVE — emotional payoff, callback, or cliffhanger. (4-6s).
   - NEVER make all scenes the same length or same shot scale.

8. VOICEOVER (if requested):
   - Write voiceoverScript filling ENTIRE duration (~2.5 words/sec). 15s=~37 words, 30s=~75 words.
   - Set "voiceoverLine" per scene — MUST match what's visually shown in that scene.
   - Write like a CINEMATIC NARRATOR: evocative, emotional, rhythmic. Not a news anchor.
   - Use power words: "witness", "unleash", "transform", "shatter", "ignite", "reveal"
   - Vary sentence length. Short punch. Then a longer, flowing descriptive passage that builds.
   - ENGAGEMENT CTA (if "ENGAGEMENT CTA: Yes" is set in input): The FINAL scene's voiceoverLine
     MUST end with a natural, in-voice call-to-action asking viewers to like, comment, and share.
     Weave it into the narrator's emotional climax — don't break the fourth wall jarringly.
     Vary the phrasing every time (never the same CTA twice). Examples of tone:
       • "…if this moved you, tap that like, share it with someone who needs to hear this, and drop your thoughts below."
       • "…smash the like, share this with a friend who'd get it, and tell us in the comments what you felt."
       • "…hit like if this hit home, share it forward, and let us know what stood out in the comments."
     Keep it under 18 words. Make it feel earned, not bolted on.

9. VISUAL CONSISTENCY:
   - ALL scenes share: same lighting setup, color temperature, quality keywords, camera style
   - Set "visualStyle": { lighting, colorTemperature, qualityKeywords, cameraStyle }
   - This ensures scenes feel like ONE FILM, not random clips

10. Text overlays: opening hook only, key stat if relevant, CTA at end. Sparingly.

VALID MODELS: "wan-2.2", "ltx-video"
VALID TRANSITIONS: "cut", "crossfade", "fade_black", "fade_white", "wipe_left", "wipe_right", "zoom_in", "zoom_out", "glitch", "blur"
VALID RESOLUTIONS: "480p", "720p", "1080p"

OUTPUT FORMAT: Return ONLY valid JSON ScenePlan. No markdown. No explanation.
Each scene MUST have "soundDesign": { ambientDescription, dialogueLines, sfxCues }.
Each scene MUST have specific camera movement, lens, lighting, and human action in the prompt.`;

function buildUserPrompt(input: BrainInput): string {
  let prompt = `CONCEPT: "${input.concept}"
TARGET DURATION: ${input.targetDuration} seconds
STYLE: ${input.style}
ASPECT RATIO: ${input.aspectRatio === "landscape" ? "16:9" : input.aspectRatio === "portrait" ? "9:16" : "1:1"}`;

  if (input.voiceover) {
    prompt += `\nVOICEOVER: Yes (language: ${input.voiceoverLanguage || "en-US"})`;
  }
  if (input.voiceover && input.engagementCTA) {
    prompt += `\nENGAGEMENT CTA: Yes — final scene voiceoverLine MUST end with a varied like/comment/share CTA (see rule 8)`;
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

  const apiKey = process.env.GENESIS_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY;
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

  // FAL models to force-swap to RunPod (FAL credits exhausted)
  const FAL_MODELS: string[] = ["kling-2.6", "kling-3.0", "veo-3.1", "seedance-1.5"];
  const RUNPOD_MODELS: ModelId[] = ["wan-2.2", "ltx-video", "hunyuan-video", "mochi-1", "wan-2.1-turbo"];

  // Validate each scene
  plan.scenes = plan.scenes.map((scene, i) => {
    // Force-swap FAL models to wan-2.2 (RunPod)
    let selectedModel: ModelId = "wan-2.2";
    if (validModels.includes(scene.modelId as ModelId)) {
      if (FAL_MODELS.includes(scene.modelId as string)) {
        console.log(`[BRAIN PLANNER] Swapping FAL model ${scene.modelId} → wan-2.2 (FAL credits exhausted)`);
        selectedModel = "wan-2.2";
      } else if (RUNPOD_MODELS.includes(scene.modelId as ModelId)) {
        selectedModel = scene.modelId as ModelId;
      } else {
        selectedModel = "wan-2.2"; // Default fallback
      }
    }

    const s: SceneDefinition = {
      sceneNumber: i + 1,
      description: scene.description || `Scene ${i + 1}`,
      prompt: scene.prompt || scene.description || "",
      negativePrompt: scene.negativePrompt || getDefaultNegativePrompt(),
      modelId: selectedModel,
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
      soundDesign: scene.soundDesign || {
        ambientDescription: "",
        dialogueLines: [],
        sfxCues: [],
      },
    };

    // Ensure prompt is not empty
    if (!s.prompt.trim()) {
      s.prompt = s.description;
    }

    return s;
  });

  // Calculate total duration
  plan.totalDuration = plan.scenes.reduce((sum, s) => sum + s.duration, 0);

  // Enforce engagement CTA on the final scene's voiceoverLine (belt-and-suspenders
  // guarantee in case Claude forgets the rule).
  if (input.voiceover && input.engagementCTA) {
    enforceEngagementCTA(plan);
  }

  // Generate voiceover timings if needed
  if (input.voiceover && plan.voiceoverScript && !plan.voiceoverTimings) {
    plan.voiceoverTimings = generateTimings(plan);
  }

  return plan;
}

/**
 * Ensure the final scene's voiceoverLine contains a like/comment/share CTA.
 * If Claude already wrote one, leave it alone. Otherwise append a rotating fallback
 * so the narrator always closes with an engagement prompt.
 */
function enforceEngagementCTA(plan: ScenePlan): void {
  if (!plan.scenes || plan.scenes.length === 0) return;

  const lastScene = plan.scenes[plan.scenes.length - 1];
  const existing = (lastScene.voiceoverLine || "").trim();

  // CTA detection — look for two or more engagement verbs/nouns within the line.
  // This avoids false positives on a single casual "like" and guarantees a real CTA.
  const engagementSignals = [
    /\blike\b/i,
    /\bcomment/i,
    /\bshare\b/i,
    /\bsubscribe\b/i,
    /\bfollow\b/i,
    /\btap\b/i,
    /\bsmash\b/i,
    /\bdrop a /i,
    /\blet us know\b/i,
  ];
  const matches = engagementSignals.filter((rx) => rx.test(existing)).length;
  if (matches >= 2) {
    // Claude already wrote a proper CTA — trust it.
    return;
  }

  // Rotating fallback pool — picked pseudo-randomly by plan title hash so the same
  // concept doesn't drift between runs, but the pipeline as a whole varies naturally.
  const fallbacks = [
    "If this moved you, tap like, share it with someone who needs to hear it, and drop your thoughts below.",
    "Smash the like, share with a friend who'd get it, and tell us what hit hardest in the comments.",
    "Hit like if this landed, share it forward, and let us know what stood out in the comments.",
    "Like if you felt that. Share with someone who needs it. Comment your favourite moment below.",
    "Tap like, share with your people, and drop a comment — we read every single one.",
    "If this spoke to you, leave a like, send it to a friend, and tell us your story in the comments.",
  ];
  const hash = Array.from(plan.title || "genesis").reduce(
    (acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0,
    0
  );
  const cta = fallbacks[hash % fallbacks.length];

  // Append to the final voiceoverLine. Add a soft separator so TTS pauses naturally.
  const separator = existing && !/[.!?]$/.test(existing) ? ". " : existing ? " " : "";
  lastScene.voiceoverLine = `${existing}${separator}${cta}`;

  // Keep the overall voiceoverScript in sync so fallback TTS paths see the CTA too.
  if (plan.voiceoverScript) {
    const scriptTrim = plan.voiceoverScript.trim();
    const scriptMatches = engagementSignals.filter((rx) => rx.test(scriptTrim)).length;
    if (scriptMatches < 2) {
      const scriptSep = scriptTrim && !/[.!?]$/.test(scriptTrim) ? ". " : scriptTrim ? " " : "";
      plan.voiceoverScript = `${scriptTrim}${scriptSep}${cta}`;
    }
  }

  console.log(`[BRAIN PLANNER] Appended engagement CTA to final scene voiceoverLine`);
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
  if (input.voiceover) total += 5; // TTS generation
  if (input.music) total += 3; // Music selection/generation
  if (input.captions) total += 2; // Caption generation

  // Hollywood Sound Design: ambient + SFX + foley per scene (ElevenLabs SFX API)
  if (input.soundEffects) {
    // ~30 credits per scene: Claude design + ElevenLabs ambient + 2-3 SFX + foley
    total += plan.scenes.length * 30;
  }

  // MMAudio post-processing for silent models (wan-2.2, ltx-video, etc.)
  const silentScenes = plan.scenes.filter((s) => {
    const m = AI_MODELS[s.modelId];
    return !m?.hasAudio; // No native audio = needs MMAudio
  });
  if (silentScenes.length > 0) {
    // MMAudio V2 cost: ~2 credits per silent scene
    total += silentScenes.length * 2;
  }

  // Assembly fee (FFmpeg concatenation + audio mixing)
  total += 5;

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
  if (input.voiceover) total += 5;
  if (input.music) total += 3;
  if (input.captions) total += 2;
  if (input.soundEffects) total += scenesEstimate * 30; // Hollywood Sound Design
  total += Math.ceil(scenesEstimate * 0.5) * 2; // MMAudio for ~half the scenes
  total += 5; // Assembly (FFmpeg)
  if (input.outputFormats && input.outputFormats.length > 1) {
    total += (input.outputFormats.length - 1) * 2;
  }

  return total;
}
