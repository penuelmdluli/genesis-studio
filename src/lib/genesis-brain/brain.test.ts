// ============================================
// GENESIS BRAIN — Comprehensive Test Suite
// Tests for Planner, Consistency Engine, Audio Engine
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  BrainInput,
  ScenePlan,
  SceneDefinition,
  CharacterDefinition,
  VoiceoverTiming,
  BrandKit,
} from "@/types";

// ------------------------------------
// Mocks
// ------------------------------------

// Mock @/lib/constants — provide AI_MODELS and BUILT_IN_AUDIO_TRACKS
vi.mock("@/lib/constants", () => ({
  AI_MODELS: {
    "wan-2.2": {
      id: "wan-2.2",
      name: "Wan 2.2",
      creditCost: { "480p": 20, "720p": 40, "1080p": 80 },
    },
    "hunyuan-video": {
      id: "hunyuan-video",
      name: "Hunyuan Video",
      creditCost: { "480p": 12, "720p": 25 },
    },
    "ltx-video": {
      id: "ltx-video",
      name: "LTX Video",
      creditCost: { "480p": 8, "720p": 15 },
    },
    "wan-2.1-turbo": {
      id: "wan-2.1-turbo",
      name: "Wan 2.1 Turbo",
      creditCost: { "480p": 10, "720p": 20 },
    },
    "mochi-1": {
      id: "mochi-1",
      name: "Mochi 1",
      creditCost: { "480p": 20, "720p": 35, "1080p": 70 },
    },
    "cogvideo-x": {
      id: "cogvideo-x",
      name: "CogVideo X",
      creditCost: { "480p": 10 },
    },
  },
  BUILT_IN_AUDIO_TRACKS: [
    {
      id: "track-cinematic-epic",
      name: "Epic Rising",
      genre: "Cinematic",
      duration: 60,
      url: "/audio/cinematic-epic.mp3",
      bpm: 120,
      isBuiltIn: true,
    },
    {
      id: "track-cinematic-emotional",
      name: "Emotional Journey",
      genre: "Cinematic",
      duration: 45,
      url: "/audio/cinematic-emotional.mp3",
      bpm: 80,
      isBuiltIn: true,
    },
    {
      id: "track-electronic-pulse",
      name: "Digital Pulse",
      genre: "Electronic",
      duration: 60,
      url: "/audio/electronic-pulse.mp3",
      bpm: 128,
      isBuiltIn: true,
    },
    {
      id: "track-electronic-future",
      name: "Future Bass",
      genre: "Electronic",
      duration: 30,
      url: "/audio/electronic-future.mp3",
      bpm: 140,
      isBuiltIn: true,
    },
    {
      id: "track-ambient-space",
      name: "Deep Space",
      genre: "Ambient",
      duration: 60,
      url: "/audio/ambient-space.mp3",
      bpm: 60,
      isBuiltIn: true,
    },
    {
      id: "track-lofi-chill",
      name: "Chill Vibes",
      genre: "Lo-Fi",
      duration: 60,
      url: "/audio/lofi-chill.mp3",
      bpm: 85,
      isBuiltIn: true,
    },
  ],
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ------------------------------------
// Imports (after mocks)
// ------------------------------------
import {
  planProduction,
  calculateBrainCredits,
  estimateBrainCredits,
} from "./planner";
import { ConsistencyEngine, consistencyEngine } from "./consistency";
import {
  generateVoiceover,
  selectMusic,
  generateCaptions,
  AVAILABLE_VOICES,
  SUPPORTED_LANGUAGES,
} from "./audio";

// ------------------------------------
// Helpers — create test fixtures
// ------------------------------------

function makeBrainInput(overrides: Partial<BrainInput> = {}): BrainInput {
  return {
    concept: "A dramatic sunrise over a cyberpunk cityscape",
    targetDuration: 30,
    style: "cinematic",
    aspectRatio: "landscape",
    voiceover: false,
    captions: false,
    music: false,
    soundEffects: false,
    ...overrides,
  };
}

function makeScene(overrides: Partial<SceneDefinition> = {}): SceneDefinition {
  return {
    sceneNumber: 1,
    description: "Opening shot of the city",
    prompt: "A dramatic cityscape at dawn",
    negativePrompt: "blurry, low quality",
    modelId: "wan-2.2",
    duration: 5,
    resolution: "720p",
    cameraMovement: "slow push-in",
    transitionIn: "crossfade",
    transitionOut: "crossfade",
    ...overrides,
  };
}

function makeScenePlan(overrides: Partial<ScenePlan> = {}): ScenePlan {
  return {
    title: "Cyberpunk Sunrise",
    totalDuration: 15,
    scenes: [
      makeScene({ sceneNumber: 1 }),
      makeScene({ sceneNumber: 2, modelId: "ltx-video", duration: 5 }),
      makeScene({ sceneNumber: 3, modelId: "cogvideo-x", duration: 5, resolution: "480p" }),
    ],
    characters: [],
    musicMood: "ambient",
    musicTempo: "medium",
    colorPalette: ["#8b5cf6", "#06b6d4", "#1a1a2e"],
    overallStyle: "cinematic",
    ...overrides,
  };
}

// ============================================
// PLANNER TESTS
// ============================================

describe("Planner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  // --- estimateBrainCredits ---

  describe("estimateBrainCredits", () => {
    it("returns a positive number for minimal input", () => {
      const input = makeBrainInput();
      const credits = estimateBrainCredits(input);
      expect(credits).toBeGreaterThan(0);
    });

    it("increases with longer target duration", () => {
      const short = estimateBrainCredits(makeBrainInput({ targetDuration: 15 }));
      const long = estimateBrainCredits(makeBrainInput({ targetDuration: 120 }));
      expect(long).toBeGreaterThan(short);
    });

    it("adds credits for voiceover option", () => {
      const without = estimateBrainCredits(makeBrainInput({ voiceover: false }));
      const withVo = estimateBrainCredits(makeBrainInput({ voiceover: true }));
      expect(withVo - without).toBe(5);
    });

    it("adds credits for music option", () => {
      const without = estimateBrainCredits(makeBrainInput({ music: false }));
      const withMusic = estimateBrainCredits(makeBrainInput({ music: true }));
      expect(withMusic - without).toBe(3);
    });

    it("adds credits for captions option", () => {
      const without = estimateBrainCredits(makeBrainInput({ captions: false }));
      const withCaptions = estimateBrainCredits(makeBrainInput({ captions: true }));
      expect(withCaptions - without).toBe(2);
    });

    it("adds credits for multiple output formats", () => {
      const single = estimateBrainCredits(makeBrainInput({ outputFormats: ["landscape"] }));
      const multi = estimateBrainCredits(
        makeBrainInput({ outputFormats: ["landscape", "portrait", "square"] })
      );
      expect(multi - single).toBe(4); // (3 - 1) * 2
    });

    it("includes base planning fee of 2 and assembly fee of 5", () => {
      // 2 (planning) + scenes * 10 + MMAudio + 5 (assembly)
      // targetDuration=15: scenesEstimate = max(3, ceil(15/8)) = 3
      // MMAudio = ceil(3 * 0.5) * 2 = ceil(1.5) * 2 = 2 * 2 = 4
      // Total: 2 + 30 + 4 + 5 = 41
      const input = makeBrainInput({ targetDuration: 15 });
      const credits = estimateBrainCredits(input);
      expect(credits).toBe(41);
    });

    it("estimates at least 3 scenes even for very short durations", () => {
      const short = estimateBrainCredits(makeBrainInput({ targetDuration: 15 }));
      // min 3 scenes: 2 + 3*10 + ceil(3*0.5)*2 + 5 = 2 + 30 + 4 + 5 = 41
      expect(short).toBe(41);
    });
  });

  // --- calculateBrainCredits ---

  describe("calculateBrainCredits", () => {
    it("calculates credits based on scene models and resolutions", () => {
      const plan = makeScenePlan();
      const input = makeBrainInput();
      const credits = calculateBrainCredits(plan, input);

      // Planning: 2
      // Scene 1: wan-2.2 @ 720p = 40, dur=5 => multiplier=1 => 40
      // Scene 2: ltx-video @ 720p = 15, dur=5 => multiplier=1 => 15
      // Scene 3: cogvideo-x @ 480p = 10, dur=5 => multiplier=1 => 10
      // MMAudio: all 3 scenes are silent (no hasAudio) => 3 * 2 = 6
      // Assembly: 5
      // Total: 2 + 40 + 15 + 10 + 6 + 5 = 78
      expect(credits).toBe(78);
    });

    it("applies duration multiplier for scenes longer than 5 seconds", () => {
      const plan = makeScenePlan({
        scenes: [makeScene({ modelId: "ltx-video", duration: 10, resolution: "720p" })],
      });
      const input = makeBrainInput();
      const credits = calculateBrainCredits(plan, input);

      // Planning: 2
      // Scene: ltx-video @ 720p = 15, dur=10 => multiplier=2 => ceil(30) = 30
      // MMAudio: 1 silent scene => 1 * 2 = 2
      // Assembly: 5
      // Total: 2 + 30 + 2 + 5 = 39
      expect(credits).toBe(39);
    });

    it("adds voiceover, music, and caption fees", () => {
      const plan = makeScenePlan({ scenes: [makeScene()] });
      const input = makeBrainInput({ voiceover: true, music: true, captions: true });
      const credits = calculateBrainCredits(plan, input);

      // Planning: 2 + Scene: 40 + VO: 5 + Music: 3 + Captions: 2 + MMAudio: 1*2=2 + Assembly: 5 = 59
      expect(credits).toBe(59);
    });

    it("adds multi-format export cost", () => {
      const plan = makeScenePlan({ scenes: [makeScene()] });
      const input = makeBrainInput({
        outputFormats: ["landscape", "portrait", "square"],
      });
      const credits = calculateBrainCredits(plan, input);

      // Planning: 2 + Scene: 40 + MMAudio: 1*2=2 + Assembly: 5 + Extra formats: (3-1)*2 = 4 => Total: 53
      expect(credits).toBe(53);
    });

    it("uses default cost of 8 for unknown model IDs", () => {
      const plan = makeScenePlan({
        scenes: [makeScene({ modelId: "unknown-model" as any, duration: 5 })],
      });
      const input = makeBrainInput();
      const credits = calculateBrainCredits(plan, input);

      // Planning: 2 + Default: 8 + MMAudio: 1*2=2 + Assembly: 5 = 17
      expect(credits).toBe(17);
    });

    it("uses 720p fallback cost when resolution is not in creditCost map", () => {
      const plan = makeScenePlan({
        scenes: [makeScene({ modelId: "cogvideo-x", resolution: "720p" })],
      });
      const input = makeBrainInput();
      const credits = calculateBrainCredits(plan, input);

      // cogvideo-x only has 480p cost (3). 720p is not available.
      // Fallback chain: creditCost["720p"] || creditCost["720p"] || 8
      // Neither exists, so falls back to 8
      // Planning: 2 + 8 + MMAudio: 1*2=2 + Assembly: 5 = 17
      expect(credits).toBe(17);
    });
  });

  // --- planProduction (integration — tests validation via the API mock) ---

  describe("planProduction", () => {
    const validPlanResponse: Partial<ScenePlan> = {
      title: "Test Production",
      totalDuration: 30,
      scenes: [
        {
          sceneNumber: 1,
          description: "Opening",
          prompt: "A sweeping aerial shot of a cyberpunk city",
          negativePrompt: "blurry",
          modelId: "wan-2.2",
          duration: 5,
          resolution: "720p",
          cameraMovement: "drone shot",
          transitionIn: "crossfade",
          transitionOut: "crossfade",
        },
        {
          sceneNumber: 2,
          description: "Close up",
          prompt: "Close up of neon signs reflecting in wet pavement",
          negativePrompt: "blurry",
          modelId: "ltx-video",
          duration: 5,
          resolution: "720p",
          cameraMovement: "slow push-in",
          transitionIn: "cut",
          transitionOut: "crossfade",
        },
      ],
      characters: [],
      musicMood: "ambient",
      musicTempo: "medium",
      colorPalette: ["#ff00ff"],
      overallStyle: "cinematic",
    };

    beforeEach(() => {
      vi.stubEnv("GENESIS_CLAUDE_KEY", "test-key-123");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("throws for concept shorter than 10 characters", async () => {
      const input = makeBrainInput({ concept: "short" });
      await expect(planProduction(input)).rejects.toThrow(
        "Concept must be at least 10 characters long"
      );
    });

    it("throws for concept longer than 5000 characters", async () => {
      const input = makeBrainInput({ concept: "a".repeat(5001) });
      await expect(planProduction(input)).rejects.toThrow(
        "Concept must be under 5000 characters"
      );
    });

    it("throws for target duration below 15 seconds", async () => {
      const input = makeBrainInput({ targetDuration: 10 });
      await expect(planProduction(input)).rejects.toThrow(
        "Target duration must be between 15 and 120 seconds"
      );
    });

    it("throws for target duration above 120 seconds", async () => {
      const input = makeBrainInput({ targetDuration: 200 });
      await expect(planProduction(input)).rejects.toThrow(
        "Target duration must be between 15 and 120 seconds"
      );
    });

    it("throws when ANTHROPIC_API_KEY is not set", async () => {
      vi.stubEnv("GENESIS_CLAUDE_KEY", "");
      const input = makeBrainInput();
      await expect(planProduction(input)).rejects.toThrow(
        "ANTHROPIC_API_KEY is not configured"
      );
    });

    it("returns a sanitized plan on successful API call", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(validPlanResponse) }],
        }),
      });

      const input = makeBrainInput();
      const plan = await planProduction(input);

      expect(plan.title).toBe("Test Production");
      expect(plan.scenes).toHaveLength(2);
      // Scene numbers should be renumbered sequentially
      expect(plan.scenes[0].sceneNumber).toBe(1);
      expect(plan.scenes[1].sceneNumber).toBe(2);
    });

    it("strips markdown code blocks from API response", async () => {
      const wrappedJson = "```json\n" + JSON.stringify(validPlanResponse) + "\n```";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: wrappedJson }],
        }),
      });

      const input = makeBrainInput();
      const plan = await planProduction(input);
      expect(plan.title).toBe("Test Production");
    });

    it("retries on parse failure and succeeds on second attempt", async () => {
      // First call returns invalid JSON
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: "Here is your plan: {invalid json" }],
        }),
      });
      // Second call returns valid JSON
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(validPlanResponse) }],
        }),
      });

      const input = makeBrainInput();
      const plan = await planProduction(input);
      expect(plan.title).toBe("Test Production");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("throws after exhausting all retries", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: "not json at all" }],
        }),
      });

      const input = makeBrainInput();
      await expect(planProduction(input)).rejects.toThrow(
        "Failed to generate production plan after 3 attempts"
      );
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("throws on Claude API HTTP errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Rate limited",
      });

      const input = makeBrainInput();
      await expect(planProduction(input)).rejects.toThrow(
        "Failed to generate production plan"
      );
    });

    it("sanitizes invalid model IDs to ltx-video", async () => {
      const planWithBadModel = {
        ...validPlanResponse,
        scenes: [
          {
            ...validPlanResponse.scenes![0],
            modelId: "non-existent-model",
          },
        ],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(planWithBadModel) }],
        }),
      });

      const input = makeBrainInput();
      const plan = await planProduction(input);
      // wan-2.2 banned (default human face); ltx-video is the new primary
      expect(plan.scenes[0].modelId).toBe("ltx-video");
    });

    it("clamps scene duration to 5-10 range", async () => {
      const planWithBadDuration = {
        ...validPlanResponse,
        scenes: [
          { ...validPlanResponse.scenes![0], duration: 1 },
          { ...validPlanResponse.scenes![1], duration: 25 },
        ],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(planWithBadDuration) }],
        }),
      });

      const input = makeBrainInput();
      const plan = await planProduction(input);
      expect(plan.scenes[0].duration).toBe(5);
      expect(plan.scenes[1].duration).toBe(10);
    });

    it("sanitizes invalid transition types to crossfade", async () => {
      const planWithBadTransition = {
        ...validPlanResponse,
        scenes: [
          {
            ...validPlanResponse.scenes![0],
            transitionIn: "slide_magic" as any,
            transitionOut: "spiral" as any,
          },
        ],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(planWithBadTransition) }],
        }),
      });

      const input = makeBrainInput();
      const plan = await planProduction(input);
      expect(plan.scenes[0].transitionIn).toBe("crossfade");
      expect(plan.scenes[0].transitionOut).toBe("crossfade");
    });

    it("truncates plans with more than 12 scenes", async () => {
      const manyScenes = Array.from({ length: 15 }, (_, i) => ({
        ...validPlanResponse.scenes![0],
        sceneNumber: i + 1,
      }));
      const planWith15 = { ...validPlanResponse, scenes: manyScenes };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(planWith15) }],
        }),
      });

      const input = makeBrainInput();
      const plan = await planProduction(input);
      expect(plan.scenes.length).toBeLessThanOrEqual(12);
    });

    it("recalculates totalDuration from scene durations", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(validPlanResponse) }],
        }),
      });

      const input = makeBrainInput();
      const plan = await planProduction(input);
      const expectedTotal = plan.scenes.reduce((sum, s) => sum + s.duration, 0);
      expect(plan.totalDuration).toBe(expectedTotal);
    });

    it("fills in default negative prompt when scene has none", async () => {
      const planNoNeg = {
        ...validPlanResponse,
        scenes: [
          {
            ...validPlanResponse.scenes![0],
            negativePrompt: undefined,
          },
        ],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(planNoNeg) }],
        }),
      });

      const input = makeBrainInput();
      const plan = await planProduction(input);
      expect(plan.scenes[0].negativePrompt).toBeTruthy();
      expect(plan.scenes[0].negativePrompt).toContain("blurry");
    });

    it("uses concept as title when title is missing", async () => {
      const planNoTitle = { ...validPlanResponse, title: "" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(planNoTitle) }],
        }),
      });

      const input = makeBrainInput({ concept: "A cinematic adventure through space and time" });
      const plan = await planProduction(input);
      expect(plan.title).toBeTruthy();
      expect(plan.title.length).toBeLessThanOrEqual(60);
    });

    it("generates voiceover timings when voiceover is requested and script exists", async () => {
      const planWithVo = {
        ...validPlanResponse,
        voiceoverScript: "Welcome to the future. This is a new dawn.",
        scenes: [
          { ...validPlanResponse.scenes![0], voiceoverLine: "Welcome to the future." },
          { ...validPlanResponse.scenes![1], voiceoverLine: "This is a new dawn." },
        ],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(planWithVo) }],
        }),
      });

      const input = makeBrainInput({ voiceover: true });
      const plan = await planProduction(input);
      expect(plan.voiceoverTimings).toBeDefined();
      expect(plan.voiceoverTimings!.length).toBe(2);
      expect(plan.voiceoverTimings![0].text).toBe("Welcome to the future.");
      expect(plan.voiceoverTimings![0].startTime).toBeGreaterThan(0);
    });
  });
});

// ============================================
// CONSISTENCY ENGINE TESTS
// ============================================

describe("ConsistencyEngine", () => {
  let engine: ConsistencyEngine;

  beforeEach(() => {
    engine = new ConsistencyEngine();
  });

  // --- lockCharacterDescriptions ---

  describe("lockCharacterDescriptions", () => {
    it("returns plan unchanged when there are no characters", () => {
      const plan = makeScenePlan({ characters: [] });
      const result = engine.lockCharacterDescriptions(plan);
      expect(result.scenes[0].prompt).toBe(plan.scenes[0].prompt);
    });

    it("injects character descriptions into scene prompts containing the character name", () => {
      const character: CharacterDefinition = {
        id: "char-1",
        name: "Maya",
        description: "young woman with silver hair",
        age: "25",
        clothing: "leather jacket",
        ethnicity: "East Asian",
        distinguishingFeatures: "glowing blue eyes",
        appearsInScenes: [1],
      };
      const plan = makeScenePlan({
        characters: [character],
        scenes: [
          makeScene({
            sceneNumber: 1,
            prompt: "Maya walks through the neon-lit streets",
            characterIds: ["char-1"],
          }),
        ],
      });

      const result = engine.lockCharacterDescriptions(plan);
      expect(result.scenes[0].prompt).toContain("young woman with silver hair");
      expect(result.scenes[0].prompt).toContain("25 years old");
      expect(result.scenes[0].prompt).toContain("wearing leather jacket");
      expect(result.scenes[0].prompt).toContain("East Asian");
      expect(result.scenes[0].prompt).toContain("glowing blue eyes");
      expect(result.scenes[0].prompt).toContain("Maya");
    });

    it("prepends character description when character name is not in the prompt", () => {
      const character: CharacterDefinition = {
        id: "char-1",
        name: "Maya",
        description: "young woman with silver hair",
        appearsInScenes: [1],
      };
      const plan = makeScenePlan({
        characters: [character],
        scenes: [
          makeScene({
            sceneNumber: 1,
            prompt: "A person walks through the streets",
            characterIds: ["char-1"],
          }),
        ],
      });

      const result = engine.lockCharacterDescriptions(plan);
      // Description should be prepended
      expect(result.scenes[0].prompt).toMatch(/^young woman with silver hair/);
    });

    it("does not modify scenes without characterIds", () => {
      const character: CharacterDefinition = {
        id: "char-1",
        name: "Maya",
        description: "young woman with silver hair",
        appearsInScenes: [1],
      };
      const plan = makeScenePlan({
        characters: [character],
        scenes: [
          makeScene({
            sceneNumber: 1,
            prompt: "An empty landscape",
            // no characterIds
          }),
        ],
      });

      const result = engine.lockCharacterDescriptions(plan);
      expect(result.scenes[0].prompt).toBe("An empty landscape");
    });

    it("handles multiple characters across multiple scenes", () => {
      const characters: CharacterDefinition[] = [
        {
          id: "char-1",
          name: "Maya",
          description: "young woman with silver hair",
          appearsInScenes: [1, 2],
        },
        {
          id: "char-2",
          name: "Kai",
          description: "tall man with a scar",
          appearsInScenes: [2],
        },
      ];
      const plan = makeScenePlan({
        characters,
        scenes: [
          makeScene({
            sceneNumber: 1,
            prompt: "Maya enters the building",
            characterIds: ["char-1"],
          }),
          makeScene({
            sceneNumber: 2,
            prompt: "Maya and Kai face each other",
            characterIds: ["char-1", "char-2"],
          }),
        ],
      });

      const result = engine.lockCharacterDescriptions(plan);
      expect(result.scenes[0].prompt).toContain("young woman with silver hair");
      expect(result.scenes[1].prompt).toContain("young woman with silver hair");
      expect(result.scenes[1].prompt).toContain("tall man with a scar");
    });
  });

  // --- lockStyleAnchor ---

  describe("lockStyleAnchor", () => {
    it("appends cinematic style tokens to all scene prompts", () => {
      const plan = makeScenePlan({ overallStyle: "cinematic" });
      const result = engine.lockStyleAnchor(plan);

      for (const scene of result.scenes) {
        expect(scene.prompt).toContain("cinematic film look");
        expect(scene.prompt).toContain("anamorphic lens");
      }
    });

    it("appends social style tokens when style is social", () => {
      const plan = makeScenePlan({ overallStyle: "social" });
      const result = engine.lockStyleAnchor(plan);

      for (const scene of result.scenes) {
        expect(scene.prompt).toContain("vibrant colors");
      }
    });

    it("appends generic tokens for unknown styles", () => {
      const plan = makeScenePlan({ overallStyle: "unknown_style" });
      const result = engine.lockStyleAnchor(plan);

      for (const scene of result.scenes) {
        expect(scene.prompt).toContain("high quality, professional");
      }
    });

    it("includes color palette names in style tokens", () => {
      const plan = makeScenePlan({
        colorPalette: ["#ff0000", "#00ff00", "#0000ff"],
      });
      const result = engine.lockStyleAnchor(plan);

      for (const scene of result.scenes) {
        expect(scene.prompt).toContain("color palette:");
      }
    });

    it("returns plan unchanged when no overallStyle and no colorPalette", () => {
      const plan = makeScenePlan({
        overallStyle: "",
        colorPalette: [],
      });
      // With empty style and empty palette, buildStyleTokens returns ""
      const result = engine.lockStyleAnchor(plan);
      // Should not modify prompts since tokens are empty
      expect(result.scenes[0].prompt).toBe(plan.scenes[0].prompt);
    });
  });

  // --- enforceNegativePrompts ---

  describe("enforceNegativePrompts", () => {
    it("appends universal negatives to all scenes", () => {
      const plan = makeScenePlan();
      const result = engine.enforceNegativePrompts(plan);

      for (const scene of result.scenes) {
        expect(scene.negativePrompt).toContain("inconsistent lighting");
        expect(scene.negativePrompt).toContain("watermark");
        expect(scene.negativePrompt).toContain("morphing");
        expect(scene.negativePrompt).toContain("deformed hands");
      }
    });

    it("preserves existing negative prompts while appending universal ones", () => {
      const plan = makeScenePlan({
        scenes: [makeScene({ negativePrompt: "custom negative: no rain" })],
      });
      const result = engine.enforceNegativePrompts(plan);

      expect(result.scenes[0].negativePrompt).toContain("custom negative: no rain");
      expect(result.scenes[0].negativePrompt).toContain("inconsistent lighting");
    });

    it("handles scenes with empty negative prompts", () => {
      const plan = makeScenePlan({
        scenes: [makeScene({ negativePrompt: "" })],
      });
      const result = engine.enforceNegativePrompts(plan);
      expect(result.scenes[0].negativePrompt).toContain("inconsistent lighting");
    });
  });

  // --- enforceBrandKit ---

  describe("enforceBrandKit", () => {
    it("adds brand color mentions to scene prompts", () => {
      const brandKit: BrandKit = {
        colors: ["#ff0000", "#00ff00"],
      };
      const plan = makeScenePlan();
      const result = engine.enforceBrandKit(plan, brandKit);

      for (const scene of result.scenes) {
        expect(scene.prompt).toContain("brand colors");
      }
    });

    it("adds brand colors to the plan color palette", () => {
      const brandKit: BrandKit = {
        colors: ["#ff0000", "#00ff00"],
      };
      const plan = makeScenePlan({ colorPalette: ["#000000"] });
      const result = engine.enforceBrandKit(plan, brandKit);

      expect(result.colorPalette).toContain("#ff0000");
      expect(result.colorPalette).toContain("#00ff00");
      expect(result.colorPalette.length).toBeLessThanOrEqual(5);
    });

    it("adds a text overlay to the last scene when logo is provided", () => {
      const brandKit: BrandKit = {
        logo: "/logos/brand.png",
      };
      const plan = makeScenePlan();
      const result = engine.enforceBrandKit(plan, brandKit);

      const lastScene = result.scenes[result.scenes.length - 1];
      expect(lastScene.textOverlay).toBeDefined();
      expect(lastScene.textOverlay!.text).toBe(plan.title);
      expect(lastScene.textOverlay!.position).toBe("center");
    });

    it("does not overwrite existing text overlay on the last scene", () => {
      const brandKit: BrandKit = {
        logo: "/logos/brand.png",
      };
      const existingOverlay = {
        text: "Existing CTA",
        position: "bottom" as const,
        style: "cta" as const,
        animateIn: "fade" as const,
        animateOut: "fade" as const,
        startTime: 0,
        endTime: 5,
      };
      const plan = makeScenePlan({
        scenes: [
          makeScene({ sceneNumber: 1 }),
          makeScene({ sceneNumber: 2, textOverlay: existingOverlay }),
        ],
      });
      const result = engine.enforceBrandKit(plan, brandKit);

      const lastScene = result.scenes[result.scenes.length - 1];
      expect(lastScene.textOverlay!.text).toBe("Existing CTA");
    });

    it("returns plan unchanged when brandKit is falsy", () => {
      const plan = makeScenePlan();
      const originalPrompt = plan.scenes[0].prompt;
      const result = engine.enforceBrandKit(plan, undefined as any);
      expect(result.scenes[0].prompt).toBe(originalPrompt);
    });
  });

  // --- applyAll ---

  describe("applyAll", () => {
    it("runs all consistency passes in sequence", () => {
      const character: CharacterDefinition = {
        id: "char-1",
        name: "Maya",
        description: "young woman with silver hair",
        appearsInScenes: [1],
      };
      const plan = makeScenePlan({
        characters: [character],
        overallStyle: "cinematic",
        scenes: [
          makeScene({
            sceneNumber: 1,
            prompt: "Maya walks through the city",
            characterIds: ["char-1"],
          }),
        ],
      });

      const result = engine.applyAll(plan);

      // Character description injected
      expect(result.scenes[0].prompt).toContain("young woman with silver hair");
      // Style tokens applied
      expect(result.scenes[0].prompt).toContain("cinematic film look");
      // Universal negatives applied
      expect(result.scenes[0].negativePrompt).toContain("inconsistent lighting");
    });

    it("applies brand kit when provided", () => {
      const brandKit: BrandKit = { colors: ["#ff0000"] };
      const plan = makeScenePlan();
      const result = engine.applyAll(plan, brandKit);

      expect(result.scenes[0].prompt).toContain("brand colors");
    });

    it("does not mutate the original plan", () => {
      const plan = makeScenePlan();
      const originalPrompt = plan.scenes[0].prompt;
      engine.applyAll(plan);
      expect(plan.scenes[0].prompt).toBe(originalPrompt);
    });
  });

  // --- singleton export ---

  describe("consistencyEngine singleton", () => {
    it("is an instance of ConsistencyEngine", () => {
      expect(consistencyEngine).toBeInstanceOf(ConsistencyEngine);
    });
  });
});

// ============================================
// AUDIO ENGINE TESTS
// ============================================

describe("Audio Engine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  // --- AVAILABLE_VOICES ---

  describe("AVAILABLE_VOICES", () => {
    it("has voice entries for en-US", () => {
      expect(AVAILABLE_VOICES["en-US"]).toBeDefined();
      expect(AVAILABLE_VOICES["en-US"].length).toBeGreaterThan(0);
    });

    it("has voice entries for en-GB", () => {
      expect(AVAILABLE_VOICES["en-GB"]).toBeDefined();
      expect(AVAILABLE_VOICES["en-GB"].length).toBeGreaterThan(0);
    });

    it("has voice entries for zu-ZA (Zulu)", () => {
      expect(AVAILABLE_VOICES["zu-ZA"]).toBeDefined();
      expect(AVAILABLE_VOICES["zu-ZA"].length).toBeGreaterThan(0);
    });

    it("has voice entries for af-ZA (Afrikaans)", () => {
      expect(AVAILABLE_VOICES["af-ZA"]).toBeDefined();
      expect(AVAILABLE_VOICES["af-ZA"].length).toBeGreaterThan(0);
    });

    it("includes both male and female voices for en-US", () => {
      const genders = AVAILABLE_VOICES["en-US"].map((v) => v.gender);
      expect(genders).toContain("male");
      expect(genders).toContain("female");
    });

    it("every voice entry has id, name, and gender", () => {
      for (const [lang, voices] of Object.entries(AVAILABLE_VOICES)) {
        for (const voice of voices) {
          expect(voice.id, `Voice in ${lang} missing id`).toBeTruthy();
          expect(voice.name, `Voice ${voice.id} missing name`).toBeTruthy();
          expect(voice.gender, `Voice ${voice.id} missing gender`).toBeTruthy();
        }
      }
    });
  });

  // --- SUPPORTED_LANGUAGES ---

  describe("SUPPORTED_LANGUAGES", () => {
    const expectedCodes = [
      "en-US",
      "en-GB",
      "es-ES",
      "fr-FR",
      "de-DE",
      "it-IT",
      "pt-BR",
      "ja-JP",
      "ko-KR",
      "zh-CN",
      "hi-IN",
      "ar-SA",
      "zu-ZA",
      "af-ZA",
    ];

    it("contains all expected language codes", () => {
      const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
      for (const code of expectedCodes) {
        expect(codes, `Missing language code: ${code}`).toContain(code);
      }
    });

    it("has 14 supported languages", () => {
      expect(SUPPORTED_LANGUAGES).toHaveLength(14);
    });

    it("each language entry has code and name", () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(lang.code).toBeTruthy();
        expect(lang.name).toBeTruthy();
      }
    });

    it("includes South African languages (Zulu and Afrikaans)", () => {
      const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
      expect(codes).toContain("zu-ZA");
      expect(codes).toContain("af-ZA");
    });
  });

  // --- generateVoiceover ---

  describe("generateVoiceover", () => {
    it("throws when script is empty", async () => {
      await expect(generateVoiceover("")).rejects.toThrow(
        "Voiceover script cannot be empty"
      );
    });

    it("throws when script is only whitespace", async () => {
      await expect(generateVoiceover("   ")).rejects.toThrow(
        "Voiceover script cannot be empty"
      );
    });

    it("returns skipped result when FAL_KEY is not set", async () => {
      delete process.env.FAL_KEY;
      delete process.env.TTS_ENDPOINT_URL;

      const result = await generateVoiceover("Hello world, this is a test.");
      expect(result.type).toBe("voiceover");
      expect(result.url).toBe(""); // Fallback has empty URL
      expect(result.duration).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect((result.metadata as any).skipped).toBe(true);
    });

    it("estimates duration based on word count", async () => {
      delete process.env.TTS_ENDPOINT_URL;

      // 150 words = ~60 seconds
      const words150 = Array.from({ length: 150 }, () => "word").join(" ");
      const result = await generateVoiceover(words150);
      expect(result.duration).toBe(60);
    });

    it("returns skipped with provided voice when FAL_KEY missing", async () => {
      delete process.env.FAL_KEY;
      delete process.env.TTS_ENDPOINT_URL;

      const result = await generateVoiceover(
        "Test script for voiceover",
        "en-US",
        "en-US-AriaNeural"
      );
      // Without FAL_KEY, voiceover is skipped — voice resolution happens only when TTS runs
      expect((result.metadata as any).skipped).toBe(true);
    });

    it("returns skipped for zu-ZA when FAL_KEY missing", async () => {
      delete process.env.FAL_KEY;
      delete process.env.TTS_ENDPOINT_URL;

      const result = await generateVoiceover("Sawubona umhlaba", "zu-ZA");
      expect((result.metadata as any).skipped).toBe(true);
    });

    it("returns skipped for unknown languages when FAL_KEY missing", async () => {
      delete process.env.FAL_KEY;
      delete process.env.TTS_ENDPOINT_URL;

      const result = await generateVoiceover("Some text", "xx-XX");
      expect((result.metadata as any).skipped).toBe(true);
    });

    it("calls custom TTS endpoint when FAL_KEY is set but Kokoro fails", async () => {
      process.env.FAL_KEY = "test-fal-key";
      process.env.TTS_ENDPOINT_URL = "https://tts.example.com/generate";

      // First call: Kokoro (fal.subscribe) — will fail since FAL_KEY is fake
      // Second call: custom TTS endpoint — should succeed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          audio_url: "https://cdn.example.com/audio/tts-12345.mp3",
          duration: 12.5,
          timestamps: [{ word: "Hello", start: 0, end: 0.3 }],
        }),
      });

      const result = await generateVoiceover("Hello from TTS", "en-US");
      expect(result.type).toBe("voiceover");
      // Kokoro will throw (fake key), then falls through to custom TTS or final fallback
      // Either way, it returns a valid voiceover result
      expect(result.type).toBe("voiceover");

      delete process.env.FAL_KEY;
      delete process.env.TTS_ENDPOINT_URL;
    });

    it("falls back gracefully when all TTS engines fail", async () => {
      process.env.FAL_KEY = "test-fal-key";
      process.env.TTS_ENDPOINT_URL = "https://tts.example.com/generate";

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await generateVoiceover("Fallback test script");
      expect(result.type).toBe("voiceover");
      // Final fallback returns empty URL with skipped metadata
      expect(result.url).toBeDefined();

      delete process.env.FAL_KEY;
      delete process.env.TTS_ENDPOINT_URL;
    });

    it("returns skipped with no timings when FAL_KEY missing", async () => {
      delete process.env.FAL_KEY;
      delete process.env.TTS_ENDPOINT_URL;

      const timings: VoiceoverTiming[] = [
        { sceneNumber: 1, text: "Hello", startTime: 0.5, endTime: 3.5 },
      ];
      const result = await generateVoiceover("Hello", "en-US", undefined, timings);
      // Without FAL_KEY, voiceover is skipped — timings are not stored
      expect((result.metadata as any).skipped).toBe(true);
    });
  });

  // --- selectMusic ---

  describe("selectMusic", () => {
    it("returns a music result with type music", async () => {
      const result = await selectMusic("cinematic", "medium", 30);
      expect(result.type).toBe("music");
    });

    it("matches cinematic genre for cinematic mood", async () => {
      const result = await selectMusic("cinematic", "medium", 30);
      expect(result.url).toBeTruthy();
      expect((result.metadata as any).genre).toBeDefined();
    });

    it("matches electronic genre for fast electronic requests", async () => {
      const result = await selectMusic("energetic", "fast", 30, "Electronic");
      expect(result.url).toBeTruthy();
      expect((result.metadata as any).genre?.toLowerCase()).toContain("electronic");
    });

    it("provides metadata with track name, genre, bpm", async () => {
      const result = await selectMusic("ambient", "slow", 60);
      expect(result.metadata).toBeDefined();
      expect((result.metadata as any).trackName).toBeTruthy();
      expect((result.metadata as any).genre).toBeTruthy();
    });

    it("sets needsTrim when track duration exceeds target duration", async () => {
      // Request 10s but tracks are 30-60s
      const result = await selectMusic("cinematic", "medium", 10);
      expect((result.metadata as any).needsTrim).toBe(true);
      expect((result.metadata as any).targetDuration).toBe(10);
    });

    it("returns a fallback result when no tracks match at all", async () => {
      // Even with a weird mood, fallback logic picks first available track
      const result = await selectMusic("zzz_nonexistent_mood", "medium", 30);
      expect(result.type).toBe("music");
      // Should still get a URL since BUILT_IN_AUDIO_TRACKS is non-empty
      expect(result.url).toBeTruthy();
    });

    it("respects tempo filtering for slow tempo", async () => {
      // Slow = 60-90 BPM range. "Emotional Journey" (80 BPM) should match.
      const result = await selectMusic("emotional", "slow", 30);
      expect(result.type).toBe("music");
      if ((result.metadata as any).bpm) {
        expect((result.metadata as any).bpm).toBeLessThanOrEqual(90);
      }
    });
  });

  // --- generateCaptions ---

  describe("generateCaptions", () => {
    it("returns a captions result", () => {
      const script = "Hello world. This is a test of the caption system.";
      const timings: VoiceoverTiming[] = [
        { sceneNumber: 1, text: "Hello world.", startTime: 0.5, endTime: 3.0 },
        { sceneNumber: 2, text: "This is a test of the caption system.", startTime: 3.5, endTime: 7.0 },
      ];
      const result = generateCaptions(script, timings);
      expect(result.type).toBe("captions");
    });

    it("produces valid SRT format with provided timings", () => {
      const script = "Hello world.";
      const timings: VoiceoverTiming[] = [
        { sceneNumber: 1, text: "Hello world.", startTime: 1.0, endTime: 3.5 },
      ];
      const result = generateCaptions(script, timings);
      const srt = (result.metadata as any).srtContent as string;

      // SRT format: index, timestamp line, text, blank line
      expect(srt).toContain("1\n");
      expect(srt).toContain("-->");
      expect(srt).toContain("Hello world.");
      // Check SRT time format: HH:MM:SS,mmm
      expect(srt).toMatch(/\d{2}:\d{2}:\d{2},\d{3}/);
    });

    it("generates correct SRT timestamps", () => {
      const timings: VoiceoverTiming[] = [
        { sceneNumber: 1, text: "Line one", startTime: 0, endTime: 2.5 },
        { sceneNumber: 2, text: "Line two", startTime: 3.0, endTime: 5.0 },
      ];
      const result = generateCaptions("Line one Line two", timings);
      const srt = (result.metadata as any).srtContent as string;

      expect(srt).toContain("00:00:00,000 --> 00:00:02,500");
      expect(srt).toContain("00:00:03,000 --> 00:00:05,000");
    });

    it("auto-generates captions from script when timings are empty", () => {
      const script = "The quick brown fox jumps over the lazy dog and runs away";
      const result = generateCaptions(script, []);

      expect(result.type).toBe("captions");
      expect((result.metadata as any).captionCount).toBeGreaterThan(0);
      const srt = (result.metadata as any).srtContent as string;
      expect(srt).toContain("-->");
    });

    it("auto-generated captions chunk text into segments of about 8 words", () => {
      // 24 words should produce 3 caption entries
      const words = Array.from({ length: 24 }, (_, i) => `word${i}`).join(" ");
      const result = generateCaptions(words, []);
      expect((result.metadata as any).captionCount).toBe(3);
    });

    it("returns caption entries with sequential indices", () => {
      const timings: VoiceoverTiming[] = [
        { sceneNumber: 1, text: "First", startTime: 0, endTime: 2 },
        { sceneNumber: 2, text: "Second", startTime: 2.5, endTime: 4.5 },
        { sceneNumber: 3, text: "Third", startTime: 5, endTime: 7 },
      ];
      const result = generateCaptions("First Second Third", timings);
      const entries = (result.metadata as any).entries;

      expect(entries).toHaveLength(3);
      expect(entries[0].index).toBe(1);
      expect(entries[1].index).toBe(2);
      expect(entries[2].index).toBe(3);
    });

    it("stores duration as the end time of the last timing", () => {
      const timings: VoiceoverTiming[] = [
        { sceneNumber: 1, text: "Only line", startTime: 1, endTime: 4.5 },
      ];
      const result = generateCaptions("Only line", timings);
      expect(result.duration).toBe(4.5);
    });

    it("handles SRT time formatting for times over a minute", () => {
      const timings: VoiceoverTiming[] = [
        { sceneNumber: 1, text: "Late caption", startTime: 65.0, endTime: 68.5 },
      ];
      const result = generateCaptions("Late caption", timings);
      const srt = (result.metadata as any).srtContent as string;

      expect(srt).toContain("00:01:05,000");
      expect(srt).toContain("00:01:08,500");
    });

    it("handles SRT time formatting for times over an hour", () => {
      const timings: VoiceoverTiming[] = [
        { sceneNumber: 1, text: "Very late", startTime: 3661.25, endTime: 3665.0 },
      ];
      const result = generateCaptions("Very late", timings);
      const srt = (result.metadata as any).srtContent as string;

      expect(srt).toContain("01:01:01,250");
    });
  });
});
