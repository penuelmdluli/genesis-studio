// ============================================
// GENESIS BRAIN — Hollywood Sound Design Engine
// AI Sound Designer + ElevenLabs SFX Generation
// Layers: Ambient, SFX, Foley per scene
// ============================================

import { EnhancedSoundDesign, SceneSoundAssets, SceneDefinition, SoundDesign } from "@/types";
import { uploadAudio, audioStorageKey } from "@/lib/storage";
import { randomUUID } from "crypto";

// ---- SOUND DESIGNER — Claude analyzes scenes and creates sound maps ----

/**
 * Use Claude to design a detailed sound map for a scene.
 * Returns ambient, SFX, and foley layers with precise timestamps.
 */
export async function designSceneSounds(
  scene: SceneDefinition,
  existingSoundDesign?: SoundDesign
): Promise<EnhancedSoundDesign> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: convert existing basic soundDesign to enhanced format
    return convertBasicSoundDesign(scene, existingSoundDesign);
  }

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
        max_tokens: 600,
        system: `You are a Hollywood sound designer. For each video scene, create a detailed sound design plan.

Analyze the scene description and identify:
1. AMBIENT: The continuous background sound of the environment. This plays for the ENTIRE scene and loops. Be SPECIFIC: "Heavy rain on a tin roof with occasional thunder" not just "rain".
2. SFX: Specific action sounds at specific moments. Include the exact TIMESTAMP (seconds from scene start). Match them to when the action happens in the video.
3. FOLEY: Character movement sounds at specific moments. Footsteps, clothing rustle, breathing, impacts.

Rules:
- Every scene needs at least ambient
- If the scene has dialogue, keep ambient subtle
- SFX timestamps must be within the scene duration
- Be descriptive — the AI needs detail to generate accurate sounds
- Keep SFX/foley to 2-3 items max (quality over quantity)
- Duration of each effect should be realistic (footsteps 2-3s, door slam 1s, etc.)

Return ONLY valid JSON. No explanation. No markdown.`,
        messages: [{
          role: "user",
          content: `Scene ${scene.sceneNumber}: "${scene.prompt}" (${scene.duration}s)${
            scene.voiceoverLine ? `, narration: "${scene.voiceoverLine}"` : ""
          }${
            existingSoundDesign?.ambientDescription ? `, ambient hint: "${existingSoundDesign.ambientDescription}"` : ""
          }${
            existingSoundDesign?.sfxCues?.length ? `, sfx hints: ${existingSoundDesign.sfxCues.join(", ")}` : ""
          }`,
        }],
      }),
    });

    if (!response.ok) {
      console.warn(`[SOUND DESIGN] Claude API error: ${response.status}`);
      return convertBasicSoundDesign(scene, existingSoundDesign);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and clamp timestamps to scene duration
    const design: EnhancedSoundDesign = {
      sceneNumber: scene.sceneNumber,
      ambient: {
        description: parsed.ambient?.description || "natural ambient audio",
        duration: scene.duration,
        loop: parsed.ambient?.loop !== false,
      },
      sfx: (parsed.sfx || []).slice(0, 3).map((s: { description: string; timestamp: number; duration: number }) => ({
        description: s.description || "impact sound",
        timestamp: Math.min(Math.max(s.timestamp || 0, 0), scene.duration - 0.5),
        duration: Math.min(s.duration || 1, scene.duration),
      })),
      foley: (parsed.foley || []).slice(0, 2).map((f: { description: string; timestamp: number; duration: number }) => ({
        description: f.description || "movement sound",
        timestamp: Math.min(Math.max(f.timestamp || 0, 0), scene.duration - 0.5),
        duration: Math.min(f.duration || 1, scene.duration),
      })),
    };

    console.log(`[SOUND DESIGN] Scene ${scene.sceneNumber}: ambient + ${design.sfx.length} SFX + ${design.foley.length} foley`);
    return design;
  } catch (err) {
    console.warn(`[SOUND DESIGN] Claude design failed for scene ${scene.sceneNumber}:`, err);
    return convertBasicSoundDesign(scene, existingSoundDesign);
  }
}

/**
 * Convert existing basic SoundDesign to enhanced format (fallback)
 */
function convertBasicSoundDesign(
  scene: SceneDefinition,
  sd?: SoundDesign
): EnhancedSoundDesign {
  return {
    sceneNumber: scene.sceneNumber,
    ambient: {
      description: sd?.ambientDescription || "natural ambient audio matching the environment",
      duration: scene.duration,
      loop: true,
    },
    sfx: (sd?.sfxCues || []).slice(0, 3).map((cue, i) => {
      // Try to parse timestamp from cue string like "door slam at 2s"
      const timeMatch = cue.match(/at\s+(\d+(?:\.\d+)?)\s*s/i);
      return {
        description: cue.replace(/at\s+\d+(?:\.\d+)?\s*s/i, "").trim(),
        timestamp: timeMatch ? parseFloat(timeMatch[1]) : (i + 1) * (scene.duration / 4),
        duration: 1.5,
      };
    }),
    foley: [],
  };
}

// ---- ELEVENLABS SFX GENERATION ----

/**
 * Generate a sound effect using ElevenLabs Sound Generation API.
 * Returns the URL to the generated audio file (persisted to R2).
 */
export async function generateSoundEffect(params: {
  description: string;
  duration: number;   // 0.5-22 seconds
  userId?: string;
}): Promise<{ url: string; durationMs: number }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY not configured");
  }

  const durationSec = Math.min(Math.max(params.duration, 0.5), 22);

  console.log(`[SFX] Generating: "${params.description.slice(0, 50)}..." (${durationSec}s)`);

  const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: params.description,
      duration_seconds: durationSec,
      prompt_influence: 0.5,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error(`[SFX] ElevenLabs error (${response.status}):`, errorText);
    throw new Error(`ElevenLabs SFX API error: ${response.status}`);
  }

  // Response is raw audio bytes (mp3)
  const audioBuffer = Buffer.from(await response.arrayBuffer());

  if (audioBuffer.length < 100) {
    throw new Error("ElevenLabs returned empty audio");
  }

  // Persist to R2 so the URL doesn't expire
  const sfxId = randomUUID();
  const key = `sfx/${params.userId || "system"}/${sfxId}.mp3`;

  try {
    const persistedUrl = await uploadAudio(key, audioBuffer, "audio/mpeg");
    console.log(`[SFX] Generated and persisted: ${key} (${(audioBuffer.length / 1024).toFixed(1)} KB)`);
    return { url: persistedUrl, durationMs: durationSec * 1000 };
  } catch (uploadErr) {
    // If R2 upload fails, convert to data URL as fallback (temporary)
    console.warn(`[SFX] R2 upload failed, using base64 fallback:`, uploadErr);
    const base64 = audioBuffer.toString("base64");
    return { url: `data:audio/mpeg;base64,${base64}`, durationMs: durationSec * 1000 };
  }
}

// ---- GENERATE ALL SOUNDS FOR A SCENE ----

/**
 * Generate all sound effect assets for a scene from its EnhancedSoundDesign.
 * Generates ambient + SFX + foley in parallel.
 */
export async function generateSceneSoundAssets(
  design: EnhancedSoundDesign,
  userId?: string
): Promise<SceneSoundAssets> {
  const assets: SceneSoundAssets = {
    sceneNumber: design.sceneNumber,
    sfxClips: [],
    foleyClips: [],
  };

  const promises: Promise<void>[] = [];

  // Generate ambient (continuous background)
  if (design.ambient?.description) {
    promises.push(
      generateSoundEffect({
        description: design.ambient.description,
        duration: Math.min(design.ambient.duration, 22),
        userId,
      })
        .then((result) => {
          assets.ambientUrl = result.url;
          assets.ambientDurationMs = result.durationMs;
          console.log(`[SFX] Ambient for scene ${design.sceneNumber}: "${design.ambient.description.slice(0, 40)}..."`);
        })
        .catch((err) => {
          console.warn(`[SFX] Ambient failed for scene ${design.sceneNumber}:`, err);
        })
    );
  }

  // Generate SFX clips (action sounds at specific timestamps)
  for (const sfx of design.sfx) {
    promises.push(
      generateSoundEffect({
        description: sfx.description,
        duration: Math.min(sfx.duration, 10),
        userId,
      })
        .then((result) => {
          assets.sfxClips.push({
            url: result.url,
            timestampMs: sfx.timestamp * 1000,
            durationMs: result.durationMs,
            description: sfx.description,
          });
          console.log(`[SFX] SFX for scene ${design.sceneNumber} at ${sfx.timestamp}s: "${sfx.description.slice(0, 40)}..."`);
        })
        .catch((err) => {
          console.warn(`[SFX] SFX failed: "${sfx.description}":`, err);
        })
    );
  }

  // Generate foley clips (character movement sounds)
  for (const foley of design.foley) {
    promises.push(
      generateSoundEffect({
        description: foley.description,
        duration: Math.min(foley.duration, 8),
        userId,
      })
        .then((result) => {
          assets.foleyClips.push({
            url: result.url,
            timestampMs: foley.timestamp * 1000,
            durationMs: result.durationMs,
            description: foley.description,
          });
          console.log(`[SFX] Foley for scene ${design.sceneNumber} at ${foley.timestamp}s: "${foley.description.slice(0, 40)}..."`);
        })
        .catch((err) => {
          console.warn(`[SFX] Foley failed: "${foley.description}":`, err);
        })
    );
  }

  await Promise.allSettled(promises);

  const totalClips = (assets.ambientUrl ? 1 : 0) + assets.sfxClips.length + assets.foleyClips.length;
  console.log(`[SFX] Scene ${design.sceneNumber} complete: ${totalClips} audio clips generated`);

  return assets;
}

// ---- DESIGN + GENERATE ALL SCENES ----

/**
 * Full pipeline: design sounds for all scenes and generate audio assets.
 * This is the main entry point called from the orchestrator.
 */
export async function generateAllSceneSounds(
  scenes: SceneDefinition[],
  userId?: string
): Promise<SceneSoundAssets[]> {
  console.log(`[SOUND DESIGN] Starting Hollywood Sound Design for ${scenes.length} scenes...`);

  // Step 1: Design sounds for all scenes in parallel (Claude)
  const designPromises = scenes.map((scene) =>
    designSceneSounds(scene, scene.soundDesign)
  );
  const designs = await Promise.all(designPromises);

  // Step 2: Generate audio assets for all scenes in parallel (ElevenLabs)
  const assetPromises = designs.map((design) =>
    generateSceneSoundAssets(design, userId)
  );
  const allAssets = await Promise.all(assetPromises);

  const totalClips = allAssets.reduce(
    (sum, a) => sum + (a.ambientUrl ? 1 : 0) + a.sfxClips.length + a.foleyClips.length,
    0
  );
  console.log(`[SOUND DESIGN] Complete: ${totalClips} total audio clips across ${scenes.length} scenes`);

  return allAssets;
}
