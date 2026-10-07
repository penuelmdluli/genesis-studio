// ============================================
// SERIES STUDIO — one way to ask Claude for writing
// ============================================
// The season plan, the episode script, the editor's pass and the subtitle
// translation all go through here, so the model and its settings are
// decided in one place.
//
// Claude Opus 5.5 (2026-10-07). The writing is the product: the owner's
// verdict on the Sonnet 4.5 episodes was "good, not something that makes you
// want the next one". Thinking is always on for this model, so the reply
// starts with a thinking block; the text is read by type, never by position.
//
// Server-side fallback is on: a drama about a kidnapping or a murder can
// trip a safety classifier, and a declined script should be retried on
// another model rather than leave the creator with an error.

import Anthropic from "@anthropic-ai/sdk";
import { envString } from "@/lib/env";

export const WRITER_MODEL = "claude-opus-5-5";

export class WriterUnavailable extends Error {}

export interface AskOptions {
  /** Thinking depth. "medium" is this model's default; the plan and the edit pass want "high". */
  effort?: "low" | "medium" | "high" | "xhigh";
  maxTokens?: number;
  system?: string;
}

/** Ask once and return the text of the reply. Throws WriterUnavailable on any API failure. */
export async function askClaude(prompt: string, opts: AskOptions = {}): Promise<string> {
  const apiKey = envString("ANTHROPIC_API_KEY");
  if (!apiKey) throw new WriterUnavailable("The writer is not configured");
  const client = new Anthropic({ apiKey });

  // The fallback and effort fields are newer than this SDK's types; they are
  // sent as-is to the API, which is what reads them.
  const params = {
    model: WRITER_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: opts.effort ?? "medium" },
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: "user", content: prompt }],
  } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming;

  let msg: Anthropic.Beta.BetaMessage;
  try {
    msg = (await client.beta.messages.create(params)) as Anthropic.Beta.BetaMessage;
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new WriterUnavailable("The writer is busy, try again in a minute");
    if (err instanceof Anthropic.APIError) {
      throw new WriterUnavailable(`Writer unavailable (${err.status}): ${String(err.message).slice(0, 200)}`);
    }
    throw new WriterUnavailable(`Writer unavailable: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (msg.stop_reason === "refusal") {
    throw new WriterUnavailable("The writer declined this story. Try softening the premise.");
  }
  const text = msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new WriterUnavailable("The writer returned nothing, please try again");
  return text;
}

/** The JSON inside a reply, with any ``` fence removed. */
export function parseJson<T>(raw: string): T {
  let t = raw.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  // A stray sentence before or after the object is cut away.
  const first = Math.min(...["{", "["].map((c) => t.indexOf(c)).filter((i) => i >= 0));
  const last = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (Number.isFinite(first) && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t) as T;
}
