import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// storage pulls in the Cloudflare R2 binding, which does not exist under vitest.
vi.mock("@/lib/storage", () => ({
  getSignedDownloadUrl: vi.fn(async (key: string) => `https://r2.example/${key}?X-Amz-Signature=stub`),
}));

import { getMotionJobStatus, getMotionJobResult } from "./motion-control";

/**
 * Motion jobs are persisted as "fal:<endpoint>:<requestId>" regardless of which
 * provider took them, and the pollers recover the endpoint with
 * parts.slice(1, -1).join(":"). A RunPod endpoint carries its own "rp:" prefix,
 * so the stored id has four colon-separated pieces rather than three — this is
 * the split that has to survive, since getting it wrong silently polls the
 * wrong provider forever.
 */
function parseStoredMotionId(stored: string) {
  const parts = stored.split(":");
  return { endpoint: parts.slice(1, -1).join(":"), requestId: parts[parts.length - 1] };
}

describe("stored motion job id", () => {
  it("round-trips a RunPod endpoint and its hyphenated request id", () => {
    const stored = "fal:rp:swy894a8qg145q:ee2d076f-bc24-4a08-bdfa-3958dd8eab21-e1";
    expect(parseStoredMotionId(stored)).toEqual({
      endpoint: "rp:swy894a8qg145q",
      requestId: "ee2d076f-bc24-4a08-bdfa-3958dd8eab21-e1",
    });
  });

  it("round-trips a FAL endpoint containing slashes", () => {
    const stored = "fal:fal-ai/kling-video/v3/standard/motion-control:abc-123";
    expect(parseStoredMotionId(stored)).toEqual({
      endpoint: "fal-ai/kling-video/v3/standard/motion-control",
      requestId: "abc-123",
    });
  });

  it("round-trips a WaveSpeed endpoint", () => {
    const stored = "fal:ws:kwaivgi/kling-v3.0-std/motion-control:req-9";
    expect(parseStoredMotionId(stored)).toEqual({
      endpoint: "ws:kwaivgi/kling-v3.0-std/motion-control",
      requestId: "req-9",
    });
  });
});

describe("RunPod motion polling", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.RUNPOD_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockRunpod(body: unknown) {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
    ) as unknown as typeof fetch;
  }

  it("maps RunPod lifecycle states onto the shared status vocabulary", async () => {
    mockRunpod({ status: "IN_QUEUE" });
    expect((await getMotionJobStatus("rp:endpoint123", "r1")).status).toBe("IN_QUEUE");

    mockRunpod({ status: "IN_PROGRESS" });
    expect((await getMotionJobStatus("rp:endpoint123", "r1")).status).toBe("IN_PROGRESS");

    mockRunpod({ status: "COMPLETED", output: { video_base64: "AAA=" } });
    expect((await getMotionJobStatus("rp:endpoint123", "r1")).status).toBe("COMPLETED");
  });

  it("treats a handler-reported error as a failure even though RunPod says COMPLETED", async () => {
    // The worker catches its own exceptions and returns them in the output, so
    // the job status alone does not tell us whether a video exists.
    mockRunpod({ status: "COMPLETED", output: { error: "generate.py failed" } });
    const status = await getMotionJobStatus("rp:endpoint123", "r1");
    expect(status.status).toBe("FAILED");
    expect(status.error).toContain("generate.py failed");
  });

  it("maps TIMED_OUT and CANCELLED to FAILED", async () => {
    mockRunpod({ status: "TIMED_OUT" });
    expect((await getMotionJobStatus("rp:endpoint123", "r1")).status).toBe("FAILED");

    mockRunpod({ status: "CANCELLED" });
    expect((await getMotionJobStatus("rp:endpoint123", "r1")).status).toBe("FAILED");
  });

  it("decodes the inline mp4 into bytes rather than a URL", async () => {
    const mp4 = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
    mockRunpod({ status: "COMPLETED", output: { video_base64: mp4.toString("base64") } });

    const result = await getMotionJobResult("rp:endpoint123", "r1");
    expect(result.videoUrl).toBeUndefined();
    expect(Buffer.from(result.videoBytes!)).toEqual(mp4);
  });

  it("throws when a completed job carries no video", async () => {
    // RunPod drops oversized outputs, so COMPLETED with no payload is possible
    // and must fail the job (and refund) rather than upload an empty file.
    mockRunpod({ status: "COMPLETED", output: {} });
    await expect(getMotionJobResult("rp:endpoint123", "r1")).rejects.toThrow(/no video/i);
  });
});
