import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolutionToSize, durationToFrames, buildRunPodInput } from "./runpod";

describe("resolutionToSize", () => {
  it("returns correct size for 480p", () => {
    expect(resolutionToSize("480p")).toEqual({ width: 854, height: 480 });
  });

  it("returns correct size for 720p", () => {
    expect(resolutionToSize("720p")).toEqual({ width: 1280, height: 720 });
  });

  it("returns correct size for 1080p", () => {
    expect(resolutionToSize("1080p")).toEqual({ width: 1920, height: 1080 });
  });

  it("returns correct size for 4k", () => {
    expect(resolutionToSize("4k")).toEqual({ width: 3840, height: 2160 });
  });

  it("defaults to 720p for unknown resolution", () => {
    expect(resolutionToSize("unknown")).toEqual({ width: 1280, height: 720 });
  });
});

describe("durationToFrames", () => {
  it("calculates frames from duration and fps", () => {
    expect(durationToFrames(5, 24)).toBe(120);
  });

  it("works with 30fps", () => {
    expect(durationToFrames(10, 30)).toBe(300);
  });

  it("handles fractional results", () => {
    expect(durationToFrames(3, 24)).toBe(72);
  });
});

describe("buildRunPodInput", () => {
  it("builds wan-2.2 input with prompt field", () => {
    const input = buildRunPodInput({
      modelId: "wan-2.2",
      type: "t2v",
      prompt: "A cat walking",
      resolution: "720p",
      duration: 5,
      fps: 24,
    });

    expect(input.prompt).toBe("A cat walking");
    expect(input.width).toBe(1280);
    expect(input.height).toBe(720);
    expect(input.num_frames).toBe(120);
    expect(input.fps).toBe(24);
    expect(input.guidance_scale).toBe(7.5);
    expect(input.num_inference_steps).toBe(30);
    expect(input.seed).toBeDefined();
  });

  it("builds mochi-1 input with positive_prompt field", () => {
    const input = buildRunPodInput({
      modelId: "mochi-1",
      type: "t2v",
      prompt: "A sunset over mountains",
      resolution: "720p",
      duration: 5,
      fps: 24,
    });

    expect(input.positive_prompt).toBe("A sunset over mountains");
    expect(input.prompt).toBeUndefined();
    expect(input.width).toBe(1280);
    expect(input.height).toBe(720);
  });

  it("caps mochi-1 frames at 163", () => {
    const input = buildRunPodInput({
      modelId: "mochi-1",
      type: "t2v",
      prompt: "Test",
      resolution: "720p",
      duration: 10,
      fps: 24,
    });

    expect(input.num_frames).toBe(163);
  });

  it("builds hunyuan-video input with video_length and infer_steps", () => {
    const input = buildRunPodInput({
      modelId: "hunyuan-video",
      type: "t2v",
      prompt: "A forest scene",
      resolution: "720p",
      duration: 5,
      fps: 24,
      numInferenceSteps: 40,
      guidanceScale: 6.0,
    });

    expect(input.video_length).toBe(120);
    expect(input.infer_steps).toBe(40);
    expect(input.cfg_scale).toBe(6.0);
    expect(input.num_frames).toBeUndefined();
  });

  it("builds ltx-video input with image and video URL support", () => {
    const input = buildRunPodInput({
      modelId: "ltx-video",
      type: "v2v",
      prompt: "Restyle",
      inputVideoUrl: "https://example.com/video.mp4",
      resolution: "720p",
      duration: 5,
      fps: 24,
    });

    expect(input.video_url).toBe("https://example.com/video.mp4");
    expect(input.prompt).toBe("Restyle");
  });

  it("builds wan-2.1-turbo input with capped inference steps", () => {
    const input = buildRunPodInput({
      modelId: "wan-2.1-turbo",
      type: "i2v",
      prompt: "Animate",
      inputImageUrl: "https://example.com/image.jpg",
      resolution: "720p",
      duration: 5,
      fps: 24,
      numInferenceSteps: 30,
    });

    expect(input.num_inference_steps).toBe(12);
    expect(input.image_url).toBe("https://example.com/image.jpg");
  });

  it("caps cogvideo-x frames at 49", () => {
    const input = buildRunPodInput({
      modelId: "cogvideo-x",
      type: "t2v",
      prompt: "Test",
      resolution: "480p",
      duration: 5,
      fps: 24,
    });

    expect(input.num_frames).toBe(49);
  });

  it("applies draft mode with fewer inference steps", () => {
    const input = buildRunPodInput({
      modelId: "wan-2.2",
      type: "t2v",
      prompt: "Test",
      resolution: "480p",
      duration: 3,
      fps: 24,
      isDraft: true,
    });

    expect(input.num_inference_steps).toBe(15);
  });

  it("includes negative prompt", () => {
    const input = buildRunPodInput({
      modelId: "wan-2.2",
      type: "t2v",
      prompt: "Test",
      negativePrompt: "blurry, low quality",
      resolution: "720p",
      duration: 5,
      fps: 24,
    });

    expect(input.negative_prompt).toBe("blurry, low quality");
  });
});
