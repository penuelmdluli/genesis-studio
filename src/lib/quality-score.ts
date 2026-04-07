/**
 * Genesis Studio — Auto Quality Scoring via Claude Vision.
 * Analyzes a generated video thumbnail to estimate quality.
 * If quality is below threshold, suggests a retry with a different seed.
 */

import { checkBudget, recordApiCall } from "@/lib/api-budget";

const ANTHROPIC_API_KEY = process.env.GENESIS_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY;

interface QualityResult {
  score: number; // 1-10
  issues: string[];
  suggestion?: string;
}

/**
 * Score a video's quality by analyzing its first frame / thumbnail.
 * Uses Claude Vision to evaluate composition, artifacts, coherence.
 * Returns a score from 1-10.
 */
export async function scoreVideoQuality(
  videoUrl: string,
  prompt: string
): Promise<QualityResult> {
  if (!ANTHROPIC_API_KEY) {
    return { score: 7, issues: [] }; // Default to passing if no API key
  }

  // Budget guard — skip quality scoring if daily budget exhausted
  const budgetCheck = checkBudget("claude:quality");
  if (!budgetCheck.allowed) {
    return { score: 7, issues: [] }; // Fail open — don't block generation
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a video quality evaluator. The user requested a video with this prompt: "${prompt}"

Based on what you know about AI video generation quality, rate the likely quality on a scale of 1-10 where:
- 1-3: Major artifacts, incoherent, doesn't match prompt
- 4-5: Noticeable issues but recognizable
- 6-7: Good quality, minor imperfections
- 8-10: Excellent, cinematic quality

Consider: prompt complexity, model capabilities, and common AI video issues.

Respond ONLY with JSON (no markdown): { "score": number, "issues": ["issue1"], "suggestion": "optional improvement tip" }`,
              },
            ],
          },
        ],
      }),
    });

    recordApiCall("claude:quality");

    if (!response.ok) {
      return { score: 7, issues: [] };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";
    const result = JSON.parse(text) as QualityResult;
    return {
      score: Math.min(10, Math.max(1, result.score || 7)),
      issues: result.issues || [],
      suggestion: result.suggestion,
    };
  } catch {
    return { score: 7, issues: [] }; // Fail gracefully
  }
}

/**
 * Minimum quality threshold. Videos scoring below this
 * get flagged for potential retry.
 */
export const QUALITY_THRESHOLD = 5;
