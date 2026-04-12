// ============================================
// GENESIS BRAIN — AI Director Planner
// Uses Claude API to create production plans
// ============================================

import { BrainInput, ScenePlan, SceneDefinition, CharacterDefinition, VoiceoverTiming, ModelId, TransitionType, VideoStyle } from "@/types";
import { AI_MODELS } from "@/lib/constants";
import { isAfricanLanguage } from "@/lib/africa/voice-config";
import { AFRICAN_SCRIPT_RULES } from "@/lib/africa/script-generator";

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

SUBJECT RULE — SHOW THE TOPIC, NOT A RANDOM PERSON:
  ⚠️ CRITICAL: Do NOT invent random human characters unless the topic is specifically about a person.
  For NEWS, TECH, POLITICS, SCIENCE, FINANCE topics → show ENVIRONMENTS, OBJECTS, LOCATIONS:
    WAR: "military convoy rolling through dust clouds, helicopter silhouette at sunset"
    TECH: "close-up of circuit board, blue LED reflections, data center server racks humming"
    POLITICS: "empty parliament chamber, flags, podium with microphone, dramatic shadows"
    SCIENCE: "laboratory glassware with glowing liquids, microscope lens racking focus"
    FINANCE: "stock trading screens, red and green numbers cascading, city skyline at dawn"
    AFRICA: "modern African city skyline, cranes and solar panels, bustling market streets"
  For PEOPLE-FOCUSED topics (celebrity, biography) → describe the SCENE around them, not a random face.
  The #1 rule: A viewer should understand the TOPIC from the visuals alone, even with sound off.

  When you DO include people (crowds, silhouettes, hands), keep them CONTEXTUAL:
    "A trader's hands grip a phone, knuckles white, screens reflected in glasses"
    "Silhouette of a soldier against orange smoke, no face visible"
    "A scientist's gloved hand adjusts equipment under blue UV light"
  NEVER invent a main character who appears in every scene like a presenter or host.

COMPOSITION RULES:
  - Rule of thirds: place subjects at intersection points, not dead center
  - Leading lines: use architecture, roads, light beams to guide the eye
  - Depth layers: foreground element (blurred) + subject (sharp) + background (atmospheric)
  - Negative space: use empty space to create tension or isolation
  - Frame within frame: doorways, windows, arches framing the subject

═══════════════════════════════════════════
 PRODUCTION RULES
═══════════════════════════════════════════

1. Break the concept into 4-8 scenes (target duration ±10%). Each scene: 5-10 seconds (target 8 seconds per scene for maximum quality). Prefer LONGER scenes (8-10s) over shorter ones to achieve total duration.

2. EVERY SCENE PROMPT must contain ALL of these layers (this is non-negotiable):
   a) SUBJECT — The TOPIC-RELEVANT visual: an object, environment, location, or action that DIRECTLY
      illustrates what the news story or concept is about. NOT a random person.
      - If topic is about AI → show servers, robots, neural network visualizations
      - If topic is about war → show military hardware, ruins, smoke, maps
      - If topic is about a product → show the product itself in detail
      - Only show humans when they are contextual (crowds, silhouettes, hands) — NEVER a main character/host/presenter
   b) ACTION — What is HAPPENING in the scene (movement, transformation, reveal, impact)
   c) CAMERA — Movement type + speed + lens + angle (e.g. "slow dolly push-in, 85mm f/1.4, low angle")
   d) LIGHTING — Specific setup (e.g. "Rembrandt key light from camera-left, warm fill, blue rim")
   e) ENVIRONMENT — Setting details with depth (foreground, midground, background)
   f) ATMOSPHERE — Particles, weather, haze, bokeh, lens effects
   g) QUALITY ANCHORS — "cinematic, 4K, film grain, shallow depth of field, photorealistic, no people, no faces, no avatars, no human figure, no talking head, no presenter, environment only"

   EXAMPLE of a GOOD news prompt:
   "Slow dolly push-in, 85mm f/1.4, low angle. Military convoy of armored vehicles rolling through desert dust at golden hour, headlights cutting through haze. Warm side-light from setting sun creates long shadows. Foreground: barbed wire fence, slightly out of focus. Background: distant city skyline with smoke columns. Volumetric dust particles. Cinematic, 4K, anamorphic, film grain, photorealistic, no people visible"

   EXAMPLE of a GOOD tech prompt:
   "Crane ascending reveal, 24mm wide-angle. A massive data center interior — rows of server racks extending to vanishing point, blue LED status lights blinking in sequence. Cool fluorescent overhead lighting with warm accent from warning indicators. Foreground: fiber optic cables, sharp focus. Background: fog/cold air from cooling system. Cinematic, 4K, deep focus, photorealistic"

   EXAMPLE of a BAD prompt (NEVER write this):
   "A man in a white shirt talks about AI in a studio" ← THIS IS WHAT WE ARE ELIMINATING

3. NO DEFAULT CHARACTERS: Do NOT create a characters[] array unless the topic is specifically about
   a named real person. For 95% of news/tech/politics content, characters should be an EMPTY array [].
   Never invent a presenter, host, narrator character, or random person to appear in scenes.

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
   - SCENE 1 (HOOK): The most ARRESTING visual. Punchy (5-6s). Grab attention in 1 second.
     Start in medias res — mid-action, mid-emotion. Never start with a static establishing shot.
   - MIDDLE: Alternate rhythm — shorter punchy (5-6s) then longer breathing (8-10s).
     Alternate shot scales: wide → close-up → medium → extreme close-up → wide.
     Alternate energy: fast movement → slow contemplative → burst of action.
   - FINAL SCENE: The RESOLVE — emotional payoff, callback, or cliffhanger. (6-8s).
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
Each scene MUST have specific camera movement, lens, lighting, and TOPIC-RELEVANT visuals in the prompt.
CRITICAL: characters array should be EMPTY [] for news/tech/politics topics. NO random people. NO presenters. NO talking heads. NO human faces. NO person wearing a shirt. Show the SUBJECT of the story.
ABSOLUTE RULE: Every prompt MUST end with "no human face, no person, no avatar" — the video model will generate a face in the opening frame unless explicitly blocked.`;

function buildUserPrompt(input: BrainInput): string {
  let prompt = `CONCEPT: "${input.concept}"
TARGET DURATION: ${input.targetDuration} seconds
STYLE: ${input.style}
ASPECT RATIO: ${input.aspectRatio === "landscape" ? "16:9" : input.aspectRatio === "portrait" ? "9:16" : "1:1"}`;

  if (input.voiceover) {
    const lang = input.voiceoverLanguage || "en-US";
    prompt += `\nVOICEOVER: Yes (language: ${lang})`;

    // Inject African narration rules when targeting African languages
    if (isAfricanLanguage(lang)) {
      const africanRules = AFRICAN_SCRIPT_RULES[lang] || AFRICAN_SCRIPT_RULES["en-ZA"];
      prompt += `\n\n═══ AFRICAN NARRATION RULES (MANDATORY) ═══
Write ALL voiceoverLine fields using these EXACT rules. The narrator must sound AUTHENTICALLY AFRICAN — not generic English.

${africanRules}

CRITICAL: Every voiceoverLine MUST follow these rules. Generic English narration will be REJECTED.
═══════════════════════════════════════════`;
    }
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
  } else {
    prompt += `\nNO CHARACTER REFERENCES — this is content-driven video. Do NOT create characters[]. Show ENVIRONMENTS, OBJECTS, and LOCATIONS that illustrate the topic. Zero talking heads, zero presenters, zero random people.`;
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

  // Premium, content-aware engagement CTA — dedicated Claude call with a
  // pattern rubric. Runs AFTER the main plan so it can study the actual
  // final scene's narration and match the tone exactly.
  if (input.voiceover && input.engagementCTA) {
    try {
      await applyPremiumEngagementCTA(plan, apiKey, input.ctaPatternHint);
    } catch (ctaErr) {
      console.warn("[BRAIN PLANNER] Premium CTA generation failed, using rotating fallback:", ctaErr);
      enforceEngagementCTA(plan);
    }
  }

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
      duration: Math.max(5, Math.min(10, scene.duration || 8)),
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

    // ANTI-FACE ENFORCEMENT: Ensure every scene prompt explicitly blocks human faces
    // and starts with environment/object visuals. The video model defaults to generating
    // a human face in the opening frame unless explicitly told not to.
    if (!s.prompt.toLowerCase().includes("no human face") && !s.prompt.toLowerCase().includes("no people")) {
      s.prompt = `${s.prompt}. No human face, no person, no avatar, no talking head. Show only environments, objects, and locations.`;
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

// ────────────────────────────────────────────────────────────
// PREMIUM ENGAGEMENT CTA
// Dedicated Claude call that studies the final scene and picks from
// a rubric of proven engagement patterns. This is the "smart" layer —
// content-aware, tonally matched, never canned.
// ────────────────────────────────────────────────────────────

const CTA_RUBRIC_SYSTEM_PROMPT = `You are a world-class short-form video engagement specialist.
Your ONLY job: write a single bespoke closing line for a video's narrator that earns likes, comments, and shares WITHOUT feeling like a cheap "smash that like button" plea.

You write in the NARRATOR'S voice as a natural continuation of the emotional beat they just delivered.
The line must invite the viewer to LIKE, COMMENT, and SHARE (all three actions), but the WORDING is varied and pattern-matched to the content's emotional tone.

OUTPUT FORMAT (strict):
First line: PATTERN=<one of: authority, intimacy, curiosity, community, fomo, gratitude>
Second line onward: the raw CTA line itself (no quotes, no markdown, no explanation).

ENGAGEMENT PATTERNS — pick the ONE that fits the content:

1. AUTHORITY
   Use when: breaking news, geopolitics, tech disruption, data-driven stories
   Tone: decisive, informed, "you need to know this"
   Sample beats: "the data doesn't lie", "you need to see this", "mark these words"

2. INTIMACY
   Use when: motivation, personal transformation, emotional stories, tributes
   Tone: warm, close, "just between us"
   Sample beats: "if this moved you", "we read every comment", "send this to someone who needs it"

3. CURIOSITY
   Use when: debate topics, open-ended questions, "what would you do" content
   Tone: provocative, inviting a take
   Sample beats: "so what would YOU do", "drop your take", "who's right here"

4. COMMUNITY / BELONGING
   Use when: African pride, cultural, tribal, identity content
   Tone: collective, "this is ours"
   Sample beats: "this is our story", "tag your tribe", "tell us where you're watching from"

5. FOMO / URGENCY
   Use when: trending, viral, time-sensitive, "before it blows up"
   Tone: urgent, now-or-never
   Sample beats: "don't sleep on this", "share before this blows up", "you'll regret missing this"

6. GRATITUDE / JOY
   Use when: wholesome, uplifting, babies, animals, feel-good
   Tone: light, joyful, thankful
   Sample beats: "if this made you smile", "pass the joy", "who else needed this today"

RULES:
- Always invite ALL THREE actions: like, comment, share (or natural synonyms — "tap", "drop", "pass it on", "send", etc.)
- Max 22 words. Under 18 is better.
- Must feel like the narrator's OWN voice continuing — not a jarring hard pivot
- Start with a short bridge phrase that connects to the narration's emotional beat (e.g. "If that hit home…", "So what's your take?", "Don't sleep on this…")
- Never use the exact phrase "smash that like button" or "like and subscribe" — that's cheap
- Vary phrasing completely between runs — no templates, no repeats
- NEVER start with "Remember to" or "Make sure to" — those kill engagement

OUTPUT (exact format, two parts):
PATTERN=<lowercase pattern name>
<the raw CTA line on the next line — no quotes, no markdown, no explanation>`;

async function applyPremiumEngagementCTA(
  plan: ScenePlan,
  apiKey: string,
  patternHint?: BrainInput["ctaPatternHint"],
): Promise<void> {
  if (!plan.scenes || plan.scenes.length === 0) return;
  const lastScene = plan.scenes[plan.scenes.length - 1];

  // Build rich context: the actual content the CTA needs to flow from
  const lastLine = (lastScene.voiceoverLine || "").trim();
  const openingLine = (plan.scenes[0]?.voiceoverLine || "").trim();
  const content = [
    `TITLE: ${plan.title || "(untitled)"}`,
    `STYLE: ${plan.overallStyle || "cinematic"}`,
    `OPENING HOOK: "${openingLine || "(no hook)"}"`,
    `FINAL SCENE NARRATION: "${lastLine || "(empty)"}"`,
    `FINAL SCENE DESCRIPTION: "${lastScene.description || ""}"`,
  ].join("\n");

  const hintLine = patternHint
    ? `\nLEARNED HINT: Past engagement data suggests the "${patternHint}" pattern performs best on this page. Prefer it IF the content emotionally fits — otherwise pick the best pattern for the content.\n`
    : "";

  const userPrompt = `Write ONE bespoke engagement CTA line to append to the narrator's closing.
It must flow as a natural continuation of the emotional beat of the final scene.
Pick the engagement pattern that best fits this content.
${hintLine}
${content}

Return in the exact format:
PATTERN=<pattern name>
<the CTA line>`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: CTA_RUBRIC_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`CTA Claude call failed: ${res.status}`);
  }
  const data = await res.json();
  const rawText = (data.content?.[0]?.text || "").trim();

  // Extract PATTERN= line + the actual CTA body
  let detectedPattern: ScenePlan["ctaPattern"] | undefined;
  let cta = rawText;
  const patternMatch = rawText.match(
    /PATTERN\s*=\s*(authority|intimacy|curiosity|community|fomo|gratitude)/i,
  );
  if (patternMatch) {
    detectedPattern = patternMatch[1].toLowerCase() as ScenePlan["ctaPattern"];
    // Remove the PATTERN= line (and any leading blank lines) from the CTA body
    cta = rawText.replace(/^.*PATTERN\s*=\s*[a-z]+\s*/i, "").trim();
  }

  // Strip any stray quotes or markdown
  cta = cta.replace(/^["'`]+|["'`]+$/g, "").replace(/^```[a-z]*\n?|```$/g, "").trim();

  // Sanity check: must contain at least 2 engagement signals
  const signals = [
    /\blike\b/i, /\bcomment/i, /\bshare\b/i, /\btap\b/i, /\bdrop\b/i,
    /\bpass\b/i, /\bsend\b/i, /\btag\b/i, /\btell us\b/i, /\bwhat('s| is) your\b/i,
  ];
  const hits = signals.filter((rx) => rx.test(cta)).length;
  if (!cta || cta.length < 15 || cta.length > 220 || hits < 2) {
    throw new Error(`CTA validation failed (length=${cta.length}, hits=${hits}): "${cta.slice(0, 80)}"`);
  }

  // Tag the plan with the detected pattern so produce/scheduler can persist it.
  if (detectedPattern) {
    plan.ctaPattern = detectedPattern;
  }

  // Append to final scene voiceoverLine with a soft separator so TTS pauses naturally
  const sep = lastLine && !/[.!?]$/.test(lastLine) ? ". " : lastLine ? " " : "";
  lastScene.voiceoverLine = `${lastLine}${sep}${cta}`;

  // Keep the overall script in sync for fallback TTS paths
  if (plan.voiceoverScript) {
    const script = plan.voiceoverScript.trim();
    const scriptHits = signals.filter((rx) => rx.test(script)).length;
    if (scriptHits < 2) {
      const scriptSep = script && !/[.!?]$/.test(script) ? ". " : script ? " " : "";
      plan.voiceoverScript = `${script}${scriptSep}${cta}`;
    }
  }

  console.log(`[BRAIN PLANNER] Premium CTA applied: "${cta.slice(0, 80)}..."`);
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
  return "human face, person, talking head, presenter, avatar, man in shirt, woman presenting, close-up face, face in first frame, human figure, portrait of person, inconsistent lighting, style change, color shift, different person, face change, warped features, blurry, low quality, watermark, text artifacts, morphing, deformed hands, extra fingers, duplicate subjects, floating objects";
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
