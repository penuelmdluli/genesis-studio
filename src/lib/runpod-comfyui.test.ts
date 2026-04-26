import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("RunPod ComfyUI Provider", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.RUNPOD_API_KEY = "test-runpod-key";
    process.env.RUNPOD_COMFYUI_ENDPOINT_ID = "test-endpoint-id";
    process.env.COMFYUI_PROVIDER_ENABLED = "true";
    process.env.COMFYUI_TIER_ROUTING = "free,creator";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("isRunPodComfyUIAvailable returns true when fully configured", async () => {
    vi.resetModules();
    const { isRunPodComfyUIAvailable } = await import("./runpod-comfyui");
    expect(isRunPodComfyUIAvailable()).toBe(true);
  });

  it("isRunPodComfyUIAvailable returns false when disabled", async () => {
    process.env.COMFYUI_PROVIDER_ENABLED = "false";
    vi.resetModules();
    const { isRunPodComfyUIAvailable } = await import("./runpod-comfyui");
    expect(isRunPodComfyUIAvailable()).toBe(false);
  });

  it("isRunPodComfyUIAvailable returns false when endpoint ID missing", async () => {
    delete process.env.RUNPOD_COMFYUI_ENDPOINT_ID;
    vi.resetModules();
    const { isRunPodComfyUIAvailable } = await import("./runpod-comfyui");
    expect(isRunPodComfyUIAvailable()).toBe(false);
  });

  it("shouldUseRunPodComfyUI routes free/creator correctly", async () => {
    vi.resetModules();
    const { shouldUseRunPodComfyUI } = await import("./runpod-comfyui");
    expect(shouldUseRunPodComfyUI("free")).toBe(true);
    expect(shouldUseRunPodComfyUI("creator")).toBe(true);
    expect(shouldUseRunPodComfyUI("pro")).toBe(false);
    expect(shouldUseRunPodComfyUI("studio")).toBe(false);
  });

  it("shouldUseRunPodComfyUI respects custom tier routing", async () => {
    process.env.COMFYUI_TIER_ROUTING = "free";
    vi.resetModules();
    const { shouldUseRunPodComfyUI } = await import("./runpod-comfyui");
    expect(shouldUseRunPodComfyUI("free")).toBe(true);
    expect(shouldUseRunPodComfyUI("creator")).toBe(false);
  });

  it("uses RUNPOD_API_KEY as fallback when RUNPOD_COMFYUI_API_KEY not set", async () => {
    delete process.env.RUNPOD_COMFYUI_API_KEY;
    process.env.RUNPOD_API_KEY = "fallback-key";
    vi.resetModules();
    const { isRunPodComfyUIAvailable } = await import("./runpod-comfyui");
    expect(isRunPodComfyUIAvailable()).toBe(true);
  });
});

describe("Provider Router", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.RUNPOD_API_KEY = "test-key";
    process.env.RUNPOD_COMFYUI_ENDPOINT_ID = "test-endpoint";
    process.env.COMFYUI_PROVIDER_ENABLED = "true";
    process.env.COMFYUI_TIER_ROUTING = "free,creator";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("routes free users to runpod-comfyui first", async () => {
    vi.resetModules();
    const { selectProviderChain } = await import("./provider-router");
    const chain = await selectProviderChain("free");
    expect(chain[0]).toBe("runpod-comfyui");
    expect(chain[1]).toBe("runpod");
    expect(chain[2]).toBe("fal");
  });

  it("routes pro users to fal first", async () => {
    vi.resetModules();
    const { selectProviderChain } = await import("./provider-router");
    const chain = await selectProviderChain("pro");
    expect(chain[0]).toBe("fal");
  });

  it("falls back to fal when comfyui disabled", async () => {
    process.env.COMFYUI_PROVIDER_ENABLED = "false";
    vi.resetModules();
    const { selectProviderChain } = await import("./provider-router");
    const chain = await selectProviderChain("free");
    expect(chain[0]).toBe("fal");
  });
});
