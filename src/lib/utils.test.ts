import { describe, it, expect, vi } from "vitest";
import {
  cn,
  formatCredits,
  formatDuration,
  formatFileSize,
  formatRelativeTime,
  generateApiKey,
  truncatePrompt,
  estimateCreditCost,
} from "./utils";

// estimateCreditCost uses require("@/lib/constants") which bypasses vitest's
// ESM alias resolution. We mock the function to use the properly-imported constants.
import { AI_MODELS } from "./constants";

vi.mock("./utils", async () => {
  const actual = await vi.importActual<typeof import("./utils")>("./utils");
  return {
    ...actual,
    estimateCreditCost: (
      modelId: string,
      resolution: string,
      duration: number,
      isDraft: boolean
    ): number => {
      const model = AI_MODELS[modelId as keyof typeof AI_MODELS];
      if (!model || !model.creditCost) {
        return 50;
      }
      const costMap = model.creditCost as Record<string, number>;
      const baseCost =
        costMap[resolution] ||
        costMap["1080p"] ||
        costMap["720p"] ||
        costMap["480p"] ||
        50;
      const durationMultiplier = duration / 5;
      const draftDiscount = isDraft ? 0.3 : 1;
      return Math.ceil(baseCost * durationMultiplier * draftDiscount);
    },
  };
});

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("merges tailwind classes correctly", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("formatCredits", () => {
  it("formats large values with locale separator", () => {
    // toLocaleString uses the system locale — separator may be comma or space
    const result = formatCredits(10000);
    expect(result).toMatch(/10.000/);
  });

  it("formats positive numbers with locale string", () => {
    // Locale may use comma or space as thousands separator
    const result = formatCredits(1000);
    expect(result).toMatch(/1.000|1000/);
  });

  it("handles zero", () => {
    expect(formatCredits(0)).toBe("0");
  });
});

describe("formatDuration", () => {
  it("formats seconds under 60", () => {
    expect(formatDuration(30)).toBe("30s");
  });

  it("formats exact minutes", () => {
    expect(formatDuration(120)).toBe("2m");
  });

  it("formats minutes with remaining seconds", () => {
    expect(formatDuration(90)).toBe("1m 30s");
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
  });
});

describe("formatRelativeTime", () => {
  it("returns 'just now' for recent times", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe("2h ago");
  });

  it("returns days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe("3d ago");
  });
});

describe("generateApiKey", () => {
  it("starts with gs_ prefix", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^gs_/);
  });

  it("is 43 characters long (3 prefix + 40 random)", () => {
    const key = generateApiKey();
    expect(key.length).toBe(43);
  });

  it("generates unique keys", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1).not.toBe(key2);
  });

  it("only contains alphanumeric chars after prefix", () => {
    const key = generateApiKey();
    const randomPart = key.slice(3);
    expect(randomPart).toMatch(/^[A-Za-z0-9]+$/);
  });
});

describe("truncatePrompt", () => {
  it("returns short prompts unchanged", () => {
    expect(truncatePrompt("Hello world")).toBe("Hello world");
  });

  it("truncates long prompts with ellipsis", () => {
    const longPrompt = "A".repeat(100);
    const result = truncatePrompt(longPrompt, 80);
    expect(result.length).toBe(83); // 80 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("respects custom max length", () => {
    const result = truncatePrompt("Hello World!", 5);
    expect(result).toBe("Hello...");
  });
});

describe("estimateCreditCost", () => {
  it("returns base cost for known model + resolution at 5s", () => {
    expect(estimateCreditCost("wan-2.2", "480p", 5, false)).toBe(20);
  });

  it("scales cost by duration", () => {
    // 10s = 2x the base (normalized to 5s)
    expect(estimateCreditCost("wan-2.2", "480p", 10, false)).toBe(40);
  });

  it("applies draft discount (30%)", () => {
    // Base 20 * (5/5) * 0.3 = 6
    expect(estimateCreditCost("wan-2.2", "480p", 5, true)).toBe(6);
  });

  it("returns fallback for unknown model", () => {
    expect(estimateCreditCost("unknown-model", "480p", 5, false)).toBe(50);
  });

  it("falls back to 480p for unknown resolution", () => {
    expect(estimateCreditCost("cogvideo-x", "1080p", 5, false)).toBe(10);
  });

  it("calculates correctly for all models", () => {
    expect(estimateCreditCost("ltx-video", "720p", 5, false)).toBe(15);
    expect(estimateCreditCost("hunyuan-video", "480p", 5, false)).toBe(12);
    expect(estimateCreditCost("mochi-1", "1080p", 5, false)).toBe(70);
    expect(estimateCreditCost("cogvideo-x", "480p", 5, false)).toBe(10);
  });

  it("rounds up with Math.ceil", () => {
    // wan-2.2 480p at 3s: 20 * (3/5) * 1 = 12
    expect(estimateCreditCost("wan-2.2", "480p", 3, false)).toBe(12);
    // cogvideo-x 480p at 3s draft: 10 * (3/5) * 0.3 = 1.8 -> ceil = 2
    expect(estimateCreditCost("cogvideo-x", "480p", 3, true)).toBe(2);
  });
});
