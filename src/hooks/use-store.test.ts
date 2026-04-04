import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./use-store";
import { GenerationJob, Video } from "@/types";

describe("useStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useStore.setState({
      user: null,
      form: {
        type: "t2v",
        modelId: "wan-2.2",
        prompt: "",
        negativePrompt: "",
        resolution: "720p",
        duration: 5,
        fps: 24,
        guidanceScale: 7.5,
        numInferenceSteps: 30,
        isDraft: false,
        videoFormat: "standard",
        aspectRatio: "landscape",
      },
      activeJobs: [],
      videos: [],
      sidebarOpen: true,
    });
  });

  describe("user state", () => {
    it("starts with null user", () => {
      expect(useStore.getState().user).toBeNull();
    });

    it("sets user", () => {
      const user = {
        id: "1",
        clerkId: "clerk_123",
        email: "test@test.com",
        name: "Test",
        plan: "free" as const,
        creditBalance: 50,
        monthlyCreditsUsed: 0,
        monthlyCreditsLimit: 50,
      };
      useStore.getState().setUser(user);
      expect(useStore.getState().user).toEqual(user);
    });

    it("updates credit balance", () => {
      useStore.getState().setUser({
        id: "1",
        clerkId: "c",
        email: "e",
        name: "n",
        plan: "free",
        creditBalance: 50,
        monthlyCreditsUsed: 0,
        monthlyCreditsLimit: 50,
      });
      useStore.getState().updateCreditBalance(100);
      expect(useStore.getState().user?.creditBalance).toBe(100);
    });

    it("does nothing when updating balance with no user", () => {
      useStore.getState().updateCreditBalance(100);
      expect(useStore.getState().user).toBeNull();
    });
  });

  describe("form state", () => {
    it("has correct defaults", () => {
      const form = useStore.getState().form;
      expect(form.type).toBe("t2v");
      expect(form.modelId).toBe("wan-2.2");
      expect(form.prompt).toBe("");
      expect(form.resolution).toBe("720p");
      expect(form.duration).toBe(5);
      expect(form.fps).toBe(24);
      expect(form.isDraft).toBe(false);
      expect(form.videoFormat).toBe("standard");
      expect(form.aspectRatio).toBe("landscape");
      expect(form.audioTrackId).toBeUndefined();
    });

    it("updates individual form fields", () => {
      useStore.getState().setFormField("prompt", "A cat walking");
      expect(useStore.getState().form.prompt).toBe("A cat walking");

      useStore.getState().setFormField("modelId", "wan-2.2");
      expect(useStore.getState().form.modelId).toBe("wan-2.2");
    });

    it("resets form to defaults", () => {
      useStore.getState().setFormField("prompt", "Something");
      useStore.getState().setFormField("modelId", "wan-2.2");
      useStore.getState().resetForm();
      expect(useStore.getState().form.prompt).toBe("");
      expect(useStore.getState().form.modelId).toBe("wan-2.2");
    });

    it("updates video format and aspect ratio for reels", () => {
      useStore.getState().setFormField("videoFormat", "reel");
      useStore.getState().setFormField("aspectRatio", "portrait");
      expect(useStore.getState().form.videoFormat).toBe("reel");
      expect(useStore.getState().form.aspectRatio).toBe("portrait");
    });

    it("sets and clears audio track", () => {
      useStore.getState().setFormField("audioTrackId", "track-cinematic-epic");
      expect(useStore.getState().form.audioTrackId).toBe("track-cinematic-epic");

      useStore.getState().setFormField("audioTrackId", undefined as unknown as string);
      expect(useStore.getState().form.audioTrackId).toBeUndefined();
    });
  });

  describe("jobs state", () => {
    const mockJob: GenerationJob = {
      id: "job-1",
      userId: "user-1",
      status: "queued",
      type: "t2v",
      modelId: "wan-2.2",
      prompt: "Test",
      resolution: "720p",
      duration: 5,
      fps: 24,
      isDraft: false,
      creditsCost: 8,
      progress: 0,
      createdAt: "2024-01-01",
    };

    it("starts with empty jobs", () => {
      expect(useStore.getState().activeJobs).toEqual([]);
    });

    it("sets active jobs", () => {
      useStore.getState().setActiveJobs([mockJob]);
      expect(useStore.getState().activeJobs).toHaveLength(1);
    });

    it("adds a job to the beginning", () => {
      useStore.getState().setActiveJobs([mockJob]);
      const newJob = { ...mockJob, id: "job-2" };
      useStore.getState().addJob(newJob);
      expect(useStore.getState().activeJobs[0].id).toBe("job-2");
      expect(useStore.getState().activeJobs).toHaveLength(2);
    });

    it("updates a specific job", () => {
      useStore.getState().setActiveJobs([mockJob]);
      useStore.getState().updateJob("job-1", { status: "completed", progress: 100 });
      expect(useStore.getState().activeJobs[0].status).toBe("completed");
      expect(useStore.getState().activeJobs[0].progress).toBe(100);
    });

    it("does not affect other jobs on update", () => {
      const job2 = { ...mockJob, id: "job-2" };
      useStore.getState().setActiveJobs([mockJob, job2]);
      useStore.getState().updateJob("job-1", { status: "completed" });
      expect(useStore.getState().activeJobs[1].status).toBe("queued");
    });
  });

  describe("videos state", () => {
    const mockVideo: Video = {
      id: "vid-1",
      userId: "user-1",
      jobId: "job-1",
      title: "Test",
      url: "https://example.com/video.mp4",
      thumbnailUrl: "https://example.com/thumb.jpg",
      modelId: "wan-2.2",
      prompt: "Test",
      resolution: "720p",
      duration: 5,
      fps: 24,
      fileSize: 1024,
      isPublic: false,
      createdAt: "2024-01-01",
    };

    it("starts with empty videos", () => {
      expect(useStore.getState().videos).toEqual([]);
    });

    it("sets videos", () => {
      useStore.getState().setVideos([mockVideo]);
      expect(useStore.getState().videos).toHaveLength(1);
    });

    it("adds a video to the beginning", () => {
      useStore.getState().setVideos([mockVideo]);
      const newVideo = { ...mockVideo, id: "vid-2" };
      useStore.getState().addVideo(newVideo);
      expect(useStore.getState().videos[0].id).toBe("vid-2");
    });

    it("removes a video by id", () => {
      useStore.getState().setVideos([mockVideo, { ...mockVideo, id: "vid-2" }]);
      useStore.getState().removeVideo("vid-1");
      expect(useStore.getState().videos).toHaveLength(1);
      expect(useStore.getState().videos[0].id).toBe("vid-2");
    });
  });

  describe("UI state", () => {
    it("sidebar starts open", () => {
      expect(useStore.getState().sidebarOpen).toBe(true);
    });

    it("toggles sidebar", () => {
      useStore.getState().toggleSidebar();
      expect(useStore.getState().sidebarOpen).toBe(false);
      useStore.getState().toggleSidebar();
      expect(useStore.getState().sidebarOpen).toBe(true);
    });
  });
});
