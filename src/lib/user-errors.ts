// ============================================
// GENESIS STUDIO — User-facing error copy
// ============================================
// Provider errors are useful in logs and Slack. Shown to a customer they are
// noise at best ("No FAL.AI model ID configured for wan-2.2 (t2v)") and at
// worst they expose which vendors sit behind the product. Everything that
// reaches a job's error_message or an API response goes through here.

const VENDOR_WORDS = /\b(wavespeed|wave\s*speed|fal\.ai|fal|runpod|replicate|comfy(ui|deploy)?|kling|bytedance|seedance)\b/gi;

export type ProviderErrorKind = "capacity" | "rejected" | "timeout" | "unknown";

export function classifyProviderError(raw: string): ProviderErrorKind {
  const m = raw.toLowerCase();
  if (
    /insufficient credits|top up|balance|out of balance|forbidden|403|402|account locked|quota|exhausted/.test(m)
  ) {
    return "capacity";
  }
  if (/timed? ?out|longer than expected/.test(m)) return "timeout";
  if (/must be one of|invalid|unsupported|not allowed|too (long|large|short)|400/.test(m)) {
    return "rejected";
  }
  return "unknown";
}

/**
 * Turn a raw provider error into something a customer can act on. Never
 * names a vendor; always says what happened to their credits.
 */
export function toUserFacingProviderError(raw: string): string {
  switch (classifyProviderError(raw)) {
    case "capacity":
      return "Our video engine is temporarily at capacity. Please try again in a few minutes — your credits have been refunded.";
    case "timeout":
      return "This generation took longer than expected and was stopped. Your credits have been returned.";
    case "rejected": {
      // Keep the useful part (e.g. duration must be one of [5, 8]) but strip
      // vendor names and internal identifiers.
      const cleaned = raw
        .replace(/^Submission failed:\s*/i, "")
        .replace(/Both providers refused this job\.?/i, "")
        .replace(VENDOR_WORDS, "the video engine")
        .replace(/\bsubmit failed \(\d+\):?/gi, "")
        .replace(/\{.*?\}/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return `${cleaned || "The request was not accepted"}. Your credits have been refunded.`;
    }
    default:
      return "Something went wrong while starting this generation. Your credits have been refunded.";
  }
}

/** True when the failure means the OPERATOR must act (top up a provider). */
export function isOperatorActionable(raw: string): boolean {
  return classifyProviderError(raw) === "capacity";
}
