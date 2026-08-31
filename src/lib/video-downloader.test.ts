import { describe, it, expect } from "vitest";
import { mp4DurationSec } from "./video-downloader";

/**
 * Builds the smallest thing our scanner cares about: an `mvhd` tag followed by
 * a version byte, flags, timestamps, timescale and duration. Real files bury
 * this inside a moov box, but the scanner searches for the tag rather than
 * walking the tree, so this exercises the same path.
 */
function mvhd(version: 0 | 1, timescale: number, duration: number, offset = 0): ArrayBuffer {
  const size = offset + (version === 0 ? 32 : 48);
  const buf = new ArrayBuffer(size);
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);

  bytes.set([0x6d, 0x76, 0x68, 0x64], offset); // "mvhd"
  bytes[offset + 4] = version;

  if (version === 0) {
    view.setUint32(offset + 16, timescale);
    view.setUint32(offset + 20, duration);
  } else {
    view.setUint32(offset + 24, timescale);
    view.setBigUint64(offset + 28, BigInt(duration));
  }
  return buf;
}

describe("mp4DurationSec", () => {
  it("reads a version 0 header", () => {
    // Verified against ffprobe on a real 5s driving video (timescale 600).
    expect(mp4DurationSec(mvhd(0, 600, 3000))).toBe(5);
  });

  it("reads a version 1 header with 64-bit fields", () => {
    expect(mp4DurationSec(mvhd(1, 1000, 25355))).toBeCloseTo(25.355, 3);
  });

  it("finds the header when moov sits away from the very start", () => {
    expect(mp4DurationSec(mvhd(0, 90000, 375000, 4096))).toBeCloseTo(4.167, 3);
  });

  it("returns null rather than zero when there is no mvhd to read", () => {
    // Callers treat null as "unknown" and let the video through, so confusing
    // this with a real 0 would silently wave every WebM past the length cap.
    expect(mp4DurationSec(new Uint8Array(2048).buffer)).toBeNull();
  });

  it("returns null for an mvhd with a zero timescale", () => {
    expect(mp4DurationSec(mvhd(0, 0, 3000))).toBeNull();
  });
});
