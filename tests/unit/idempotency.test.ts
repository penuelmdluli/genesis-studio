import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildIdempotencyKey } from "@/lib/idempotency";

// The data layer was refactored from @/lib/supabase to @/lib/db-driver (getDb);
// idempotency.ts imports getDb from there. Mock that module, not the old one.
vi.mock("@/lib/db-driver", () => ({
  getDb: vi.fn(),
}));

describe("buildIdempotencyKey", () => {
  it("returns a deterministic key for same inputs", () => {
    const input = {
      userId: "user-1",
      prompt: "a cat",
      modelId: "seedance-1.5",
      duration: 5,
      resolution: "720p",
    };
    const key1 = buildIdempotencyKey(input);
    const key2 = buildIdempotencyKey(input);
    expect(key1).toBe(key2);
    // buildIdempotencyKey uses a simple deterministic 32-bit hash → 8 hex chars
    // (padStart(8)); the full SHA is done at the KV layer. Per-user + 1h window
    // makes an 8-hex space ample for dedupe.
    expect(key1).toMatch(/^idem:user-1:[a-f0-9]{8}$/);
  });

  it("returns different keys for different prompts", () => {
    const base = {
      userId: "user-1",
      modelId: "seedance-1.5",
      duration: 5,
      resolution: "720p",
    };
    const key1 = buildIdempotencyKey({ ...base, prompt: "a cat" });
    const key2 = buildIdempotencyKey({ ...base, prompt: "a dog" });
    expect(key1).not.toBe(key2);
  });

  it("returns different keys for different users", () => {
    const base = {
      prompt: "a cat",
      modelId: "seedance-1.5",
      duration: 5,
      resolution: "720p",
    };
    const key1 = buildIdempotencyKey({ ...base, userId: "user-1" });
    const key2 = buildIdempotencyKey({ ...base, userId: "user-2" });
    expect(key1).not.toBe(key2);
  });

  it("key is order-independent for object properties", () => {
    const key1 = buildIdempotencyKey({
      userId: "u1",
      prompt: "cat",
      modelId: "m1",
      duration: 5,
      resolution: "720p",
    });
    // Same data, different property order shouldn't matter since we sort keys
    const key2 = buildIdempotencyKey({
      resolution: "720p",
      duration: 5,
      modelId: "m1",
      prompt: "cat",
      userId: "u1",
    });
    expect(key1).toBe(key2);
  });
});

describe("checkIdempotencyKey", () => {
  let checkIdempotencyKey: typeof import("@/lib/idempotency").checkIdempotencyKey;

  beforeEach(async () => {
    vi.resetModules();
  });

  it("returns exists: false when no matching job found", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    vi.doMock("@/lib/db-driver", () => ({
      getDb: () => mockSupabase,
    }));

    const mod = await import("@/lib/idempotency");
    checkIdempotencyKey = mod.checkIdempotencyKey;

    const result = await checkIdempotencyKey("user-1", "key-1");
    expect(result).toEqual({ exists: false });
  });

  it("returns exists: true with jobId when match found", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "job-123" },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    vi.doMock("@/lib/db-driver", () => ({
      getDb: () => mockSupabase,
    }));

    const mod = await import("@/lib/idempotency");
    checkIdempotencyKey = mod.checkIdempotencyKey;

    const result = await checkIdempotencyKey("user-1", "key-1");
    expect(result).toEqual({ exists: true, jobId: "job-123" });
  });
});
