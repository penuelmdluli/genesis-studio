import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("./supabase", () => ({
  createSupabaseAdmin: vi.fn(() => ({
    from: mockFrom,
  })),
}));

function setupMockChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(resolvedValue),
    single: vi.fn().mockResolvedValue(resolvedValue),
  };
  // Make chaining work
  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  mockFrom.mockReturnValue(chain);
  return chain;
}

import {
  getUserByClerkId,
  createUser,
  updateUserPlan,
  createJob,
  updateJobStatus,
  getJob,
  getUserJobs,
  createVideo,
  getUserVideos,
  deleteVideo,
  createApiKey,
  getUserApiKeys,
  validateApiKey,
  revokeApiKey,
} from "./db";

describe("User Operations", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getUserByClerkId", () => {
    it("returns user data", async () => {
      const mockUser = { id: "1", clerk_id: "clerk_123", email: "test@test.com" };
      setupMockChain({ data: mockUser, error: null });

      const result = await getUserByClerkId("clerk_123");
      expect(result).toEqual(mockUser);
    });

    it("returns null when user not found (PGRST116)", async () => {
      setupMockChain({ data: null, error: { code: "PGRST116", message: "Not found" } });

      const result = await getUserByClerkId("nonexistent");
      expect(result).toBeNull();
    });

    it("throws on other errors", async () => {
      setupMockChain({ data: null, error: { code: "OTHER", message: "DB error" } });

      await expect(getUserByClerkId("clerk_123")).rejects.toThrow("Failed to get user");
    });
  });

  describe("createUser", () => {
    it("creates a user with free plan defaults", async () => {
      const chain = setupMockChain({
        data: { id: "1", plan: "free", credit_balance: 50 },
        error: null,
      });

      const result = await createUser({
        clerkId: "clerk_123",
        email: "test@test.com",
        name: "Test User",
      });

      expect(result).toEqual({ id: "1", plan: "free", credit_balance: 50 });
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          clerk_id: "clerk_123",
          plan: "free",
          credit_balance: 50,
          monthly_credits_used: 0,
          monthly_credits_limit: 50,
        })
      );
    });
  });

  describe("updateUserPlan", () => {
    it("updates plan and credit limits", async () => {
      const chain = setupMockChain({ data: null, error: null });

      await updateUserPlan("user-1", "pro", "cus_123", "sub_456");

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: "pro",
          monthly_credits_limit: 2000,
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_456",
        })
      );
    });
  });
});

describe("Job Operations", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("createJob", () => {
    it("creates a job with queued status", async () => {
      const chain = setupMockChain({
        data: { id: "job-1", status: "queued" },
        error: null,
      });

      const result = await createJob({
        userId: "user-1",
        type: "t2v",
        modelId: "ltx-video",
        prompt: "A cat",
        resolution: "720p",
        duration: 5,
        fps: 24,
        isDraft: false,
        creditsCost: 8,
      });

      expect(result).toEqual({ id: "job-1", status: "queued" });
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-1",
          status: "queued",
          model_id: "ltx-video",
          progress: 0,
        })
      );
    });
  });

  describe("getJob", () => {
    it("returns a job", async () => {
      const job = { id: "job-1", status: "completed" };
      setupMockChain({ data: job, error: null });

      const result = await getJob("job-1");
      expect(result).toEqual(job);
    });

    it("throws when job not found", async () => {
      setupMockChain({ data: null, error: { message: "Not found" } });

      await expect(getJob("nonexistent")).rejects.toThrow("Failed to get job");
    });
  });

  describe("updateJobStatus", () => {
    it("maps camelCase to snake_case fields", async () => {
      const chain = setupMockChain({ data: null, error: null });

      await updateJobStatus("job-1", {
        status: "completed",
        outputVideoUrl: "https://example.com/video.mp4",
        thumbnailUrl: "https://example.com/thumb.jpg",
        gpuTime: 42,
        completedAt: "2024-01-01T00:00:00Z",
      });

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          output_video_url: "https://example.com/video.mp4",
          thumbnail_url: "https://example.com/thumb.jpg",
          gpu_time: 42,
          completed_at: "2024-01-01T00:00:00Z",
        })
      );
    });
  });
});

describe("Video Operations", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("createVideo", () => {
    it("creates a video record", async () => {
      const chain = setupMockChain({
        data: { id: "vid-1", title: "Test" },
        error: null,
      });

      const result = await createVideo({
        userId: "user-1",
        jobId: "job-1",
        title: "Test Video",
        url: "https://example.com/video.mp4",
        thumbnailUrl: "https://example.com/thumb.jpg",
        modelId: "ltx-video",
        prompt: "A cat",
        resolution: "720p",
        duration: 5,
        fps: 24,
        fileSize: 1024000,
      });

      expect(result).toEqual({ id: "vid-1", title: "Test" });
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          is_public: false,
        })
      );
    });
  });

  describe("deleteVideo", () => {
    it("deletes a video by id and user", async () => {
      // Need eq to return an object with eq that resolves
      const innerEq = vi.fn().mockResolvedValue({ error: null });
      const outerEq = vi.fn().mockReturnValue({ eq: innerEq });
      const mockDelete = vi.fn().mockReturnValue({ eq: outerEq });
      mockFrom.mockReturnValue({
        delete: mockDelete,
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn(),
      });

      await deleteVideo("vid-1", "user-1");
      expect(mockDelete).toHaveBeenCalled();
      expect(outerEq).toHaveBeenCalledWith("id", "vid-1");
      expect(innerEq).toHaveBeenCalledWith("user_id", "user-1");
    });
  });
});

describe("API Key Operations", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("createApiKey", () => {
    it("creates an active API key", async () => {
      const chain = setupMockChain({
        data: { id: "key-1", name: "My Key" },
        error: null,
      });

      const result = await createApiKey({
        userId: "user-1",
        name: "My Key",
        keyPrefix: "gs_abcdef",
        keyHash: "hash123",
      });

      expect(result).toEqual({ id: "key-1", name: "My Key" });
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: true,
        })
      );
    });
  });

  describe("validateApiKey", () => {
    it("returns key record with user for valid key", async () => {
      const keyData = {
        id: "key-1",
        users: { id: "user-1", plan: "pro" },
      };
      const chain = setupMockChain({ data: keyData, error: null });
      // validateApiKey does a second update call
      chain.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await validateApiKey("valid-hash");
      expect(result).toEqual(keyData);
    });

    it("returns null for invalid key", async () => {
      setupMockChain({ data: null, error: { message: "Not found" } });

      const result = await validateApiKey("invalid-hash");
      expect(result).toBeNull();
    });
  });

  describe("revokeApiKey", () => {
    it("sets is_active to false", async () => {
      const innerEq = vi.fn().mockResolvedValue({ error: null });
      const outerEq = vi.fn().mockReturnValue({ eq: innerEq });
      const mockUpdate = vi.fn().mockReturnValue({ eq: outerEq });
      mockFrom.mockReturnValue({
        update: mockUpdate,
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn(),
      });

      await revokeApiKey("key-1", "user-1");
      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
      expect(outerEq).toHaveBeenCalledWith("id", "key-1");
      expect(innerEq).toHaveBeenCalledWith("user_id", "user-1");
    });
  });
});
