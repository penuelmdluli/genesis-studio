import { z } from "zod";

export const generateSchema = z.object({
  prompt: z.string().min(5, "Prompt must be at least 5 characters").max(2000, "Prompt too long"),
  modelId: z.enum(["wan-2.2", "hunyuan-video", "ltx-video", "wan-2.1-turbo", "mochi-1", "cogvideo-x", "mimic-motion"]),
  type: z.enum(["t2v", "i2v", "v2v", "motion"]).default("t2v"),
  resolution: z.enum(["480p", "720p", "1080p", "4k"]).default("720p"),
  duration: z.number().int().min(1).max(60).default(5),
  fps: z.number().int().min(12).max(60).default(24),
  negativePrompt: z.string().max(1000).optional(),
  seed: z.number().int().optional(),
  guidanceScale: z.number().min(1).max(30).optional(),
  numInferenceSteps: z.number().int().min(1).max(100).optional(),
  isDraft: z.boolean().default(false),
  inputImageUrl: z.string().url().optional(),
  inputVideoUrl: z.string().url().optional(),
  aspectRatio: z.enum(["landscape", "portrait", "square"]).default("landscape"),
  audioTrackId: z.string().optional(),
});

export const brainInputSchema = z.object({
  concept: z.string().min(10, "Concept too short").max(5000),
  targetDuration: z.number().int().min(5).max(300).default(30),
  style: z.string().min(1).max(50).default("cinematic"),
  aspectRatio: z.enum(["landscape", "portrait", "square"]).default("landscape"),
  voiceover: z.boolean().default(false),
  voiceoverLanguage: z.string().max(10).optional(),
  voiceoverVoice: z.string().max(100).optional(),
  music: z.boolean().default(false),
  captions: z.boolean().default(false),
});

export const apiKeySchema = z.object({
  name: z.string().min(1, "Name required").max(100),
});

// Export types inferred from schemas
export type GenerateInput = z.infer<typeof generateSchema>;
export type BrainInput = z.infer<typeof brainInputSchema>;
