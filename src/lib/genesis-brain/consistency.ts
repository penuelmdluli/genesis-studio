// ============================================
// GENESIS BRAIN — Consistency Engine
// Ensures visual continuity across scenes
// ============================================

import { ScenePlan, SceneDefinition, CharacterDefinition, BrandKit } from "@/types";

export class ConsistencyEngine {
  /**
   * Lock character descriptions — inject identical description strings across all scenes
   */
  lockCharacterDescriptions(plan: ScenePlan): ScenePlan {
    if (!plan.characters || plan.characters.length === 0) return plan;

    const charMap = new Map<string, string>();
    for (const char of plan.characters) {
      // Build master description
      const parts = [char.description];
      if (char.age) parts.push(`${char.age} years old`);
      if (char.ethnicity) parts.push(char.ethnicity);
      if (char.clothing) parts.push(`wearing ${char.clothing}`);
      if (char.distinguishingFeatures) parts.push(char.distinguishingFeatures);
      charMap.set(char.id, parts.join(", "));
    }

    // Inject into scene prompts
    plan.scenes = plan.scenes.map((scene) => {
      if (!scene.characterIds || scene.characterIds.length === 0) return scene;

      let enhancedPrompt = scene.prompt;
      for (const charId of scene.characterIds) {
        const masterDesc = charMap.get(charId);
        if (masterDesc) {
          // Find character name reference and replace/append full description
          const char = plan.characters.find((c) => c.id === charId);
          if (char && enhancedPrompt.includes(char.name)) {
            enhancedPrompt = enhancedPrompt.replace(
              char.name,
              `${char.name} (${masterDesc})`
            );
          } else if (char) {
            enhancedPrompt = `${masterDesc}, ${enhancedPrompt}`;
          }
        }
      }

      return { ...scene, prompt: enhancedPrompt };
    });

    return plan;
  }

  /**
   * Lock style anchor — append consistent style tokens to every scene
   */
  lockStyleAnchor(plan: ScenePlan): ScenePlan {
    const styleTokens = this.buildStyleTokens(plan);
    if (!styleTokens) return plan;

    plan.scenes = plan.scenes.map((scene) => ({
      ...scene,
      prompt: `${scene.prompt}, ${styleTokens}`,
    }));

    return plan;
  }

  /**
   * Build style tokens from plan metadata
   */
  private buildStyleTokens(plan: ScenePlan): string {
    const tokens: string[] = [];

    // Overall style
    if (plan.overallStyle) {
      const styleMap: Record<string, string> = {
        cinematic: "cinematic film look, anamorphic lens, shallow depth of field, dramatic lighting",
        social: "vibrant colors, clean modern look, high saturation, well-lit",
        commercial: "professional studio lighting, clean composition, brand-polished look",
        story: "warm natural tones, soft lighting, intimate atmosphere",
        meme: "bright punchy colors, bold contrast, dynamic energy",
        tutorial: "clean well-lit, neutral background, sharp focus",
        documentary: "natural lighting, realistic tones, handheld feel",
        music_video: "stylized lighting, creative angles, bold color grading",
        explainer: "clean minimal style, soft even lighting, professional",
        vlog: "natural daylight, authentic feel, slightly warm tones",
      };
      tokens.push(styleMap[plan.overallStyle] || "high quality, professional");
    }

    // Color palette
    if (plan.colorPalette?.length > 0) {
      const colorNames = plan.colorPalette.slice(0, 3).map((c) => {
        // Convert hex to approximate color name
        return hexToColorName(c);
      });
      tokens.push(`color palette: ${colorNames.join(", ")}`);
    }

    return tokens.join(", ");
  }

  /**
   * Enforce consistent negative prompts across all scenes
   */
  enforceNegativePrompts(plan: ScenePlan): ScenePlan {
    const universalNegatives = this.getUniversalNegatives();

    plan.scenes = plan.scenes.map((scene) => {
      const existing = scene.negativePrompt || "";
      const combined = existing
        ? `${existing}, ${universalNegatives}`
        : universalNegatives;

      return {
        ...scene,
        negativePrompt: combined,
      };
    });

    return plan;
  }

  /**
   * Universal negative prompts for consistency
   */
  getUniversalNegatives(): string {
    return [
      "inconsistent lighting",
      "style change",
      "color shift",
      "different person",
      "face change",
      "warped features",
      "blurry",
      "low quality",
      "watermark",
      "text artifacts",
      "aspect ratio change",
      "frame flickering",
      "morphing",
      "deformed hands",
      "extra fingers",
      "duplicate subjects",
      "floating objects",
    ].join(", ");
  }

  /**
   * Enforce brand kit: colors, logo placement, watermark
   */
  enforceBrandKit(plan: ScenePlan, brandKit: BrandKit): ScenePlan {
    if (!brandKit) return plan;

    // Add brand colors to palette
    if (brandKit.colors?.length) {
      plan.colorPalette = [...(brandKit.colors || []), ...(plan.colorPalette || [])].slice(0, 5);
    }

    // Add brand color mention to scene prompts
    if (brandKit.colors?.length) {
      const colorNames = brandKit.colors.slice(0, 2).map(hexToColorName);
      plan.scenes = plan.scenes.map((scene) => ({
        ...scene,
        prompt: `${scene.prompt}, featuring ${colorNames.join(" and ")} brand colors`,
      }));
    }

    // Add logo to last scene (end card) if logo exists
    if (brandKit.logo) {
      const lastScene = plan.scenes[plan.scenes.length - 1];
      if (lastScene && !lastScene.textOverlay) {
        lastScene.textOverlay = {
          text: plan.title,
          position: "center",
          style: "title",
          animateIn: "fade",
          animateOut: "fade",
          startTime: 0,
          endTime: lastScene.duration,
        };
      }
    }

    return plan;
  }

  /**
   * Harmonize visual style across all scenes using Claude.
   * Ensures consistent lighting, color palette, camera style, and quality keywords
   * so scenes look like they belong in the SAME film.
   */
  async harmonizeVisualStyle(plan: ScenePlan): Promise<ScenePlan> {
    const apiKey = process.env.GENESIS_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return plan;

    // Extract the visual style metadata from plan (if the planner provided it)
    const planAny = plan as unknown as Record<string, unknown>;
    const visualStyle = planAny.visualStyle as {
      lighting?: string;
      colorTemperature?: string;
      qualityKeywords?: string;
      cameraStyle?: string;
    } | undefined;

    // Build the consistency anchor from visual style or derive from plan
    const lightingStyle = visualStyle?.lighting || this.inferLighting(plan);
    const colorTemp = visualStyle?.colorTemperature || "warm";
    const qualityKW = visualStyle?.qualityKeywords || "cinematic, 4K, shallow depth of field";
    const cameraStyle = visualStyle?.cameraStyle || "cinematic";

    // Build compact scene data for Claude
    const sceneData = plan.scenes.map((s) => ({
      n: s.sceneNumber,
      prompt: s.prompt,
      camera: s.cameraMovement,
      duration: s.duration,
    }));

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
          max_tokens: 3000,
          system: `You ensure visual consistency across video scenes for professional film production.
Given scene prompts, adjust them so they ALL share:
- Same lighting: "${lightingStyle}"
- Same color temperature: "${colorTemp}"
- Same quality keywords: "${qualityKW}"
- Same camera style: "${cameraStyle}"
- Consistent color palette: ${plan.colorPalette?.join(", ") || "cinematic tones"}

RULES:
- DO NOT change what happens in each scene. Keep the action, subject, and composition.
- Only ADD or ADJUST style keywords for visual consistency.
- Each prompt must still be unique and specific to its scene.
- Append the style tokens at the END of each prompt, separated by a comma.
- Keep prompts under 200 words.

Return a JSON array of objects: [{ "n": 1, "prompt": "enhanced prompt" }, ...]
No markdown. No explanation. Just the JSON array.`,
          messages: [{ role: "user", content: JSON.stringify(sceneData) }],
        }),
      });

      if (!response.ok) {
        console.warn(`[CONSISTENCY] Claude harmonization failed: ${response.status}`);
        return plan;
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || "";
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      const harmonized = JSON.parse(jsonStr) as Array<{ n: number; prompt: string }>;

      // Apply harmonized prompts back to scenes
      plan.scenes = plan.scenes.map((scene) => {
        const enhanced = harmonized.find((h) => h.n === scene.sceneNumber);
        if (enhanced?.prompt) {
          return { ...scene, prompt: enhanced.prompt };
        }
        return scene;
      });

      console.log(`[CONSISTENCY] Visual style harmonized across ${plan.scenes.length} scenes`);
    } catch (err) {
      console.warn(`[CONSISTENCY] Visual harmonization failed, using original prompts:`, err);
    }

    return plan;
  }

  /**
   * Infer lighting style from the plan's overall style
   */
  private inferLighting(plan: ScenePlan): string {
    const lightingMap: Record<string, string> = {
      cinematic: "dramatic sidelight with deep shadows",
      social: "bright, well-lit, clean lighting",
      commercial: "professional studio lighting, even and polished",
      story: "warm natural light, soft and intimate",
      meme: "bright punchy lighting, high contrast",
      tutorial: "clean well-lit, neutral and sharp",
      documentary: "natural available light, realistic",
      music_video: "stylized colored lighting, creative gels",
      explainer: "clean soft lighting, minimal shadows",
      vlog: "natural daylight, slightly warm",
    };
    return lightingMap[plan.overallStyle] || "cinematic lighting";
  }

  /**
   * Apply all consistency passes in order
   */
  applyAll(plan: ScenePlan, brandKit?: BrandKit): ScenePlan {
    let result = { ...plan, scenes: plan.scenes.map((s) => ({ ...s })) };

    result = this.lockCharacterDescriptions(result);
    result = this.lockStyleAnchor(result);
    result = this.enforceNegativePrompts(result);

    if (brandKit) {
      result = this.enforceBrandKit(result, brandKit);
    }

    return result;
  }

  /**
   * Apply all consistency passes including async Claude harmonization
   */
  async applyAllWithHarmonization(plan: ScenePlan, brandKit?: BrandKit): Promise<ScenePlan> {
    let result = this.applyAll(plan, brandKit);
    result = await this.harmonizeVisualStyle(result);
    return result;
  }
}

/**
 * Convert hex color to approximate color name
 */
function hexToColorName(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;

  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);

  // Simple heuristic for color naming
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = (max + min) / 2;

  if (max - min < 30) {
    if (lum < 50) return "dark charcoal";
    if (lum < 128) return "gray";
    if (lum < 200) return "light gray";
    return "white";
  }

  if (r > g && r > b) {
    if (g > 150) return "warm golden";
    if (b > 100) return "magenta pink";
    return "rich red";
  }
  if (g > r && g > b) {
    if (r > 150) return "lime yellow";
    if (b > 100) return "teal cyan";
    return "emerald green";
  }
  if (b > r && b > g) {
    if (r > 100) return "royal purple";
    if (g > 100) return "ocean cyan";
    return "deep blue";
  }

  return "neutral tone";
}

export const consistencyEngine = new ConsistencyEngine();
