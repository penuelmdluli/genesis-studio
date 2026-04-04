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
  // --- Wan 2.2: ComfyUI workflow format ---
  it("builds wan-2.2 input as ComfyUI workflow", () => {
    const input = buildRunPodInput({
      modelId: "wan-2.2",
      type: "t2v",
      prompt: "A cat walking",
      resolution: "720p",
      duration: 5,
      fps: 24,
    });

    // Must return a workflow object, not flat params
    expect(input.prompt).toBeDefined();
    const wf = input.prompt as Record<string, { class_type: string; inputs: Record<string, unknown> }>;

    // Prompt is in CLIPTextEncode node
    expect(wf["4"].class_type).toBe("CLIPTextEncode");
    expect(wf["4"].inputs.text).toBe("A cat walking");

    // Latent dimensions
    expect(wf["6"].class_type).toBe("EmptyWanLatentVideo");
    expect(wf["6"].inputs.width).toBe(1280);
    expect(wf["6"].inputs.height).toBe(720);
    expect(wf["6"].inputs.length).toBe(120); // 5s * 24fps

    // KSampler params
    expect(wf["7"].class_type).toBe("KSampler");
    expect(wf["7"].inputs.steps).toBe(30);
    expect(wf["7"].inputs.cfg).toBe(7.5);
    expect(wf["7"].inputs.seed).toBeDefined();

    // Video output
    expect(wf["9"].class_type).toBe("VHS_VideoCombine");
    expect(wf["9"].inputs.frame_rate).toBe(24);
  });

  it("wan-2.2 includes negative prompt in workflow", () => {
    const input = buildRunPodInput({
      modelId: "wan-2.2",
      type: "t2v",
      prompt: "Test",
      negativePrompt: "blurry, low quality",
      resolution: "720p",
      duration: 5,
      fps: 24,
    });

    const wf = input.prompt as Record<string, { class_type: string; inputs: Record<string, unknown> }>;
    expect(wf["5"].class_type).toBe("CLIPTextEncode");
    expect(wf["5"].inputs.text).toBe("blurry, low quality");
  });

  it("wan-2.2 applies draft mode with fewer steps", () => {
    const input = buildRunPodInput({
      modelId: "wan-2.2",
      type: "t2v",
      prompt: "Test",
      resolution: "480p",
      duration: 3,
      fps: 24,
      isDraft: true,
    });

    const wf = input.prompt as Record<string, { class_type: string; inputs: Record<string, unknown> }>;
    expect(wf["7"].inputs.steps).toBe(15);
  });

  // --- Mochi-1: flat params format ---
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

  // --- Hunyuan Video: ComfyUI workflow format ---
  it("builds hunyuan-video input as ComfyUI workflow", () => {
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

    expect(input.prompt).toBeDefined();
    const wf = input.prompt as Record<string, { class_type: string; inputs: Record<string, unknown> }>;

    // HunyuanVideoSampler node
    expect(wf["1"].class_type).toBe("HunyuanVideoSampler");
    expect(wf["1"].inputs.prompt).toBe("A forest scene");
    expect(wf["1"].inputs.video_length).toBe(120);
    expect(wf["1"].inputs.infer_steps).toBe(40);
    expect(wf["1"].inputs.cfg_scale).toBe(6.0);

    // Video output
    expect(wf["2"].class_type).toBe("VHS_VideoCombine");
  });

  // --- LTX Video: ComfyUI workflow format ---
  it("builds ltx-video input as ComfyUI workflow", () => {
    const input = buildRunPodInput({
      modelId: "ltx-video",
      type: "v2v",
      prompt: "Restyle",
      inputVideoUrl: "https://example.com/video.mp4",
      resolution: "720p",
      duration: 5,
      fps: 24,
    });

    expect(input.prompt).toBeDefined();
    const wf = input.prompt as Record<string, { class_type: string; inputs: Record<string, unknown> }>;

    // Prompt in CLIPTextEncode
    expect(wf["2"].class_type).toBe("CLIPTextEncode");
    expect(wf["2"].inputs.text).toBe("Restyle");

    // Video input node
    expect(wf["9"]).toBeDefined();
    expect(wf["9"].class_type).toBe("VHS_LoadVideo");
    expect(wf["9"].inputs.video).toBe("https://example.com/video.mp4");
  });

  // --- Wan 2.1 Turbo: ComfyUI workflow format ---
  it("builds wan-2.1-turbo input as ComfyUI workflow with capped steps", () => {
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

    expect(input.prompt).toBeDefined();
    const wf = input.prompt as Record<string, { class_type: string; inputs: Record<string, unknown> }>;

    // Steps capped at 12 for turbo
    expect(wf["7"].inputs.steps).toBe(12);

    // Image input node
    expect(wf["10"]).toBeDefined();
    expect(wf["10"].class_type).toBe("LoadImage");
    expect(wf["10"].inputs.image).toBe("https://example.com/image.jpg");
  });

  // --- CogVideoX: flat params format ---
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
});
