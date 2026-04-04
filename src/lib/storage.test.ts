import { describe, it, expect } from "vitest";
import { videoStorageKey, thumbnailStorageKey, inputImageStorageKey } from "./storage";

describe("videoStorageKey", () => {
  it("generates correct path", () => {
    expect(videoStorageKey("user-123", "job-456")).toBe(
      "videos/user-123/job-456.mp4"
    );
  });
});

describe("thumbnailStorageKey", () => {
  it("generates correct path", () => {
    expect(thumbnailStorageKey("user-123", "job-456")).toBe(
      "thumbnails/user-123/job-456.jpg"
    );
  });
});

describe("inputImageStorageKey", () => {
  it("generates path with timestamp", () => {
    const key = inputImageStorageKey("user-123", "photo.png");
    expect(key).toMatch(/^inputs\/user-123\/\d+-photo\.png$/);
  });
});
