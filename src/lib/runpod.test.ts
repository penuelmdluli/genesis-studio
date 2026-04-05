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
  // --- Wan 2.2: flat params format (wlsdml1114/generate_video handler) ---
  it("builds wan-2.2 input with flat prompt string", () => {
    const input = buildRunPodInput({
      modelId: "wan-2.2",
      type: "t2v",
      prompt: "A cat walking",
      resolution: "720p",
      duration: 5,
      fps: 24,
    });

    // Must be a flat string prompt, NOT a workflow object
    expect(input.prompt).toBe("A cat walking");
    expect(typeof input.prompt).toBe("string");

    // Frame count uses "length" field
    expect(input.length).toBe(120); // 5s * 24fps
    expect(input.width).toBe(1280);
    expect(input.height).toBe(720);
    expect(input.seed).toBeDefined();
    expect(input.cfg).toBe(2.0);
  });

  it("wan-2.2 includes negative prompt as flat field", () => {
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

    expect(input.steps).toBe(6);
  });

  it("wan-2.2 passes image_url for i2v mode", () => {
    const input = buildRunPodInput({
      modelId: "wan-2.2",
      type: "i2v",
      prompt: "Animate this",
      inputImageUrl: "https://example.com/photo.jpg",
      resolution: "720p",
      duration: 5,
      fps: 24,
    });

    expect(input.image_url).toBe("https://example.com/photo.jpg");
    expect(input.prompt).toBe("Animate this");
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

  // --- MimicMotion: ComfyUI workflow format ---
  it("builds mimic-motion input as ComfyUI workflow with motion transfer nodes", () => {
    const input = buildRunPodInput({
      modelId: "mimic-motion",
      type: "motion",
      prompt: "Dance motion transfer",
      inputVideoUrl: "https://example.com/dance.mp4",
      inputImageUrl: "https://example.com/character.jpg",
      resolution: "720p",
      duration: 5,
      fps: 24,
      numInferenceSteps: 25,
      guidanceScale: 2.5,
    });

    expect(input.prompt).toBeDefined();
    const wf = input.prompt as Record<string, { class_type: string; inputs: Record<string, unknown> }>;

    // LoadImage node for character reference
    expect(wf["1"].class_type).toBe("LoadImage");
    expect(wf["1"].inputs.image).toBe("https://example.com/character.jpg");

    // VHS_LoadVideo for motion reference
    expect(wf["2"].class_type).toBe("VHS_LoadVideo");
    expect(wf["2"].inputs.video).toBe("https://example.com/dance.mp4");

    // DWPose for pose extraction
    expect(wf["3"].class_type).toBe("DWPose");

    // MimicMotionSampler with correct params
    expect(wf["4"].class_type).toBe("MimicMotionSampler");
    expect(wf["4"].inputs.width).toBe(1280);
    expect(wf["4"].inputs.height).toBe(720);
    expect(wf["4"].inputs.num_frames).toBe(120);
    expect(wf["4"].inputs.num_inference_steps).toBe(25);
    expect(wf["4"].inputs.guidance_scale).toBe(2.5);
    expect(wf["4"].inputs.frames_overlap).toBe(6);
    expect(wf["4"].inputs.seed).toBeDefined();

    // VHS_VideoCombine output
    expect(wf["5"].class_type).toBe("VHS_VideoCombine");
  });

  it("mimic-motion caps inference steps at 25", () => {
    const input = buildRunPodInput({
      modelId: "mimic-motion",
      type: "motion",
      prompt: "Test",
      inputVideoUrl: "https://example.com/video.mp4",
      inputImageUrl: "https://example.com/image.jpg",
      resolution: "720p",
      duration: 5,
      fps: 24,
      numInferenceSteps: 50,
    });

    const wf = input.prompt as Record<string, { class_type: string; inputs: Record<string, unknown> }>;
    expect(wf["4"].inputs.num_inference_steps).toBe(25);
  });
});
