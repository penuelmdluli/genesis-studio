import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeReelCopy, makeGenesisNewsReel, type FoundClip } from "./genesis-news-reel";

const CLIPS: FoundClip[] = [
  {
    id: "a1",
    title: "Chiefs training at Naturena!!!",
    creator: "PSL Media",
    url: "https://www.youtube.com/watch?v=a1",
    license: "CC BY 3.0",
    durationSec: 120,
  },
  {
    id: "b2",
    title: "coach speaks to the press",
    creator: "Soccer Laduma",
    url: "https://www.youtube.com/watch?v=b2",
    license: "CC BY 3.0",
    durationSec: 240,
  },
];

type Reply = { status?: number; json: unknown };
let seen: { url: string; body: Record<string, unknown> | undefined }[] = [];

/** Answers by the first route fragment that the requested URL contains. */
function stubFetch(routes: Record<string, (body: Record<string, unknown> | undefined) => Reply>) {
  seen = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: { body?: unknown }) => {
      const url = String(input);
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
      seen.push({ url, body });
      const match = Object.keys(routes).find((fragment) => url.includes(fragment));
      if (!match) throw new Error(`unexpected fetch: ${url}`);
      const { status = 200, json } = routes[match](body);
      return { ok: status < 400, status, json: async () => json } as Response;
    })
  );
}

function gemini(copy: unknown): Reply {
  return { json: { candidates: [{ content: { parts: [{ text: JSON.stringify(copy) }] } }] } };
}

beforeEach(() => {
  process.env.SCRAPER_SERVICE_URL = "https://scraper.test";
  process.env.SCRAPER_SERVICE_SECRET = "s3cret";
  delete process.env.GEMINI_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("writeReelCopy", () => {
  it("writes the reel from the clips themselves when Gemini is not configured", async () => {
    const copy = await writeReelCopy("Chiefs sign new striker", undefined, CLIPS);

    // The banner is the story in two halves, and each caption is its clip's
    // own title: a reel with no copy at all is the one outcome to avoid.
    expect(copy.banner).toEqual(["CHIEFS SIGN", "NEW STRIKER"]);
    expect(copy.captions).toEqual(["Chiefs training at Naturena!!!", "Coach speaks to the press"]);
    expect(copy.postCaption).toContain("Chiefs sign new striker");
  });

  it("uses Gemini's copy and forces the banner to upper case", async () => {
    process.env.GEMINI_API_KEY = "gem-key";
    stubFetch({
      "generativelanguage.googleapis.com": () =>
        gemini({
          banner: ["Breaking", "Chiefs land Zwane"],
          captions: ["Inside the *deal*", "The coach *reacts*"],
          postCaption: "Done deal? 👀 #Chiefs #PSL #Bafana",
        }),
    });

    const copy = await writeReelCopy("Chiefs sign new striker", "Signed on a three-year deal", CLIPS);

    expect(copy.banner).toEqual(["BREAKING", "CHIEFS LAND ZWANE"]);
    expect(copy.captions).toEqual(["Inside the *deal*", "The coach *reacts*"]);
    expect(copy.postCaption).toBe("Done deal? 👀 #Chiefs #PSL #Bafana");
    // The clip titles and the story are what keep it from inventing transfers.
    const prompt = JSON.stringify(seen[0].body?.contents);
    expect(prompt).toContain("Signed on a three-year deal");
    expect(prompt).toContain("Chiefs training at Naturena");
  });

  it("fills in a caption Gemini left out", async () => {
    process.env.GEMINI_API_KEY = "gem-key";
    stubFetch({
      "generativelanguage.googleapis.com": () => gemini({ banner: ["BREAKING"], captions: ["Inside the *deal*"] }),
    });

    const copy = await writeReelCopy("Chiefs sign new striker", undefined, CLIPS);

    // One caption short would otherwise render a blank line over clip two.
    expect(copy.captions).toEqual(["Inside the *deal*", "Coach speaks to the press"]);
    expect(copy.banner[1]).toBe("NEW STRIKER");
  });

  it("still returns copy when Gemini is down", async () => {
    process.env.GEMINI_API_KEY = "gem-key";
    stubFetch({ "generativelanguage.googleapis.com": () => ({ status: 503, json: {} }) });

    const copy = await writeReelCopy("Chiefs sign new striker", undefined, CLIPS);

    expect(copy.captions).toEqual(["Chiefs training at Naturena!!!", "Coach speaks to the press"]);
  });
});

describe("makeGenesisNewsReel", () => {
  const found = { jobId: "gn-1", clips: CLIPS };
  const credits =
    "Footage credits — Creative Commons BY, reused with attribution:\n" +
    "• Chiefs training at Naturena!!! — PSL Media — https://youtu.be/a1\n" +
    "• coach speaks to the press — Soccer Laduma — https://youtu.be/b2";

  it("finds clips, starts a render, waits for it and credits the footage", async () => {
    let polls = 0;
    stubFetch({
      "/genesis-reel/find": () => ({ json: found }),
      "/genesis-reel/render/": () => {
        polls++;
        return polls < 2
          ? { json: { status: "running" } }
          : { json: { status: "done", r2Key: "genesis-news/2026-11-19/gn-1.mp4", credits, duration: 15.2 } };
      },
      "/genesis-reel/render": () => ({ status: 202, json: { jobId: "gn-1", status: "running" } }),
    });

    const reel = await makeGenesisNewsReel({ story: "Chiefs sign new striker", pollEveryMs: 1 });

    expect(reel.videoUrl).toBe("https://test-r2.example.com/genesis-news/2026-11-19/gn-1.mp4");
    expect(reel.durationSec).toBe(15.2);
    // The service's own "Footage credits" heading is dropped for the post's.
    expect(reel.caption).toContain("🎥 Footage credits:\n• Chiefs training");
    expect(reel.caption).not.toContain("reused with attribution");
    expect(reel.caption).toContain("• coach speaks to the press — Soccer Laduma");
    expect(polls).toBe(2);

    // Each clip reaches the render with the creator it has to credit, since
    // the service drops its own copy of that when it sleeps.
    const render = seen.find((c) => c.url.endsWith("/genesis-reel/render"));
    expect(render?.body?.clips).toEqual([
      { ...CLIPS[0], caption: "Chiefs training at Naturena!!!", seconds: 7.5 },
      { ...CLIPS[1], caption: "Coach speaks to the press", seconds: 7.5 },
    ]);
  });

  it("says so plainly when no Creative Commons footage exists for the story", async () => {
    stubFetch({ "/genesis-reel/find": () => ({ json: { jobId: null, clips: [] } }) });

    await expect(makeGenesisNewsReel({ story: "a story nobody filmed" })).rejects.toThrow(
      /No Creative Commons clips found/
    );
  });

  it("surfaces the render's own error", async () => {
    stubFetch({
      "/genesis-reel/find": () => ({ json: found }),
      "/genesis-reel/render/": () => ({ json: { status: "error", error: "every clip failed to download" } }),
      "/genesis-reel/render": () => ({ status: 202, json: { jobId: "gn-1" } }),
    });

    await expect(makeGenesisNewsReel({ story: "Chiefs sign new striker", pollEveryMs: 1 })).rejects.toThrow(
      "every clip failed to download"
    );
  });

  it("gives up rather than polling forever when the service lost the job", async () => {
    stubFetch({
      "/genesis-reel/find": () => ({ json: found }),
      "/genesis-reel/render/": () => ({ status: 404, json: { error: "unknown job" } }),
      "/genesis-reel/render": () => ({ status: 202, json: { jobId: "gn-1" } }),
    });

    await expect(makeGenesisNewsReel({ story: "Chiefs sign new striker", pollEveryMs: 1 })).rejects.toThrow(
      /interrupted/
    );
  });

  it("refuses to render without the video service configured", async () => {
    delete process.env.SCRAPER_SERVICE_SECRET;
    stubFetch({ "/genesis-reel": () => ({ json: found }) });

    await expect(makeGenesisNewsReel({ story: "Chiefs sign new striker" })).rejects.toThrow(/SCRAPER_SERVICE/);
  });
});
