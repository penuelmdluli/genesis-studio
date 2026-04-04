/**
 * Credit Protection Tests
 *
 * Verify that the IRON LAW is enforced:
 *   IF VIDEO DOES NOT PLAY → CREDITS MUST BE REFUNDED. PERIOD.
 *
 * These structural tests read source code to verify that every failure path
 * includes a refund, and that video verification happens before completion.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const pollingSource = readFileSync(
  resolve(__dirname, "../app/api/jobs/[jobId]/route.ts"),
  "utf-8"
);
const webhookSource = readFileSync(
  resolve(__dirname, "../app/api/webhooks/runpod/route.ts"),
  "utf-8"
);
const generatePageSource = readFileSync(
  resolve(__dirname, "../app/(dashboard)/generate/page.tsx"),
  "utf-8"
);
const storageSource = readFileSync(
  resolve(__dirname, "./storage.ts"),
  "utf-8"
);

describe("Credit refund on every failure path", () => {
  describe("Polling handler (/api/jobs/[jobId])", () => {
    it("refunds credits when storage upload fails", () => {
      expect(pollingSource).toContain("Video upload failed");
      expect(pollingSource).toContain("refundCredits");
      // Must refund BEFORE returning error response
      const uploadFailIdx = pollingSource.indexOf("Video upload failed");
      const refundAfterFail = pollingSource.indexOf("refundCredits", uploadFailIdx);
      expect(refundAfterFail).toBeGreaterThan(uploadFailIdx);
    });

    it("refunds credits when video verification fails", () => {
      expect(pollingSource).toContain("Video verification failed");
      const verifyFailIdx = pollingSource.indexOf("Video verification failed");
      const refundAfterVerify = pollingSource.indexOf("refundCredits", verifyFailIdx);
      expect(refundAfterVerify).toBeGreaterThan(verifyFailIdx);
    });

    it("refunds credits when RunPod reports FAILED", () => {
      const failedIdx = pollingSource.indexOf('"FAILED"');
      expect(failedIdx).toBeGreaterThan(-1);
      const refundAfterFailed = pollingSource.indexOf("refundCredits", failedIdx);
      expect(refundAfterFailed).toBeGreaterThan(failedIdx);
    });

    it("refunds credits on timeout", () => {
      expect(pollingSource).toContain("timed out");
      const timeoutIdx = pollingSource.indexOf("timed out");
      const refundAfterTimeout = pollingSource.indexOf("refundCredits", timeoutIdx);
      expect(refundAfterTimeout).toBeGreaterThan(timeoutIdx);
    });

    it("verifies R2 upload before creating video record", () => {
      expect(pollingSource).toContain("verifyR2Upload");
      // verifyR2Upload must come BEFORE createVideo
      const verifyIdx = pollingSource.indexOf("verifyR2Upload");
      const createVideoIdx = pollingSource.indexOf("await createVideo({", verifyIdx);
      expect(verifyIdx).toBeGreaterThan(-1);
      expect(createVideoIdx).toBeGreaterThan(verifyIdx);
    });
  });

  describe("Webhook handler (/api/webhooks/runpod)", () => {
    it("refunds credits when storage upload fails", () => {
      expect(webhookSource).toContain("Storage upload failed");
      const uploadFailIdx = webhookSource.indexOf("Storage upload failed");
      const refundAfterFail = webhookSource.indexOf("refundCredits", uploadFailIdx);
      expect(refundAfterFail).toBeGreaterThan(uploadFailIdx);
    });

    it("refunds credits when video verification fails", () => {
      expect(webhookSource).toContain("Video verification failed");
      const verifyFailIdx = webhookSource.indexOf("Video verification failed");
      const refundAfterVerify = webhookSource.indexOf("refundCredits", verifyFailIdx);
      expect(refundAfterVerify).toBeGreaterThan(verifyFailIdx);
    });

    it("refunds credits when RunPod reports FAILED", () => {
      const failedIdx = webhookSource.indexOf('"FAILED"');
      expect(failedIdx).toBeGreaterThan(-1);
      const refundAfterFailed = webhookSource.indexOf("refundCredits", failedIdx);
      expect(refundAfterFailed).toBeGreaterThan(failedIdx);
    });

    it("verifies R2 upload before creating video record", () => {
      expect(webhookSource).toContain("verifyR2Upload");
      const verifyIdx = webhookSource.indexOf("verifyR2Upload");
      const createVideoIdx = webhookSource.indexOf("await createVideo({", verifyIdx);
      expect(verifyIdx).toBeGreaterThan(-1);
      expect(createVideoIdx).toBeGreaterThan(verifyIdx);
    });
  });
});

describe("Video verification in storage layer", () => {
  it("verifyR2Upload function exists", () => {
    expect(storageSource).toContain("export async function verifyR2Upload");
  });

  it("verifyR2Upload checks minimum file size", () => {
    expect(storageSource).toContain("minBytes");
    expect(storageSource).toContain("R2 file too small");
  });

  it("verifyR2Upload checks content type", () => {
    expect(storageSource).toContain("wrong content type");
  });

  it("verifyR2Upload uses HeadObjectCommand", () => {
    expect(storageSource).toContain("HeadObjectCommand");
  });
});

describe("Double-click protection", () => {
  it("generate page uses a ref-based lock", () => {
    expect(generatePageSource).toContain("generateLockRef");
    expect(generatePageSource).toContain("useRef(false)");
  });

  it("handleGenerate checks lock before proceeding", () => {
    expect(generatePageSource).toContain("if (generateLockRef.current) return");
  });

  it("lock is released in finally block", () => {
    expect(generatePageSource).toContain("generateLockRef.current = false");
    // Must appear in finally
    const finallyIdx = generatePageSource.indexOf("} finally {");
    const unlockInFinally = generatePageSource.indexOf("generateLockRef.current = false", finallyIdx);
    expect(unlockInFinally).toBeGreaterThan(finallyIdx);
  });
});

describe("Duplicate video prevention", () => {
  it("polling handler checks for existing video before creating", () => {
    expect(pollingSource).toContain("existingVideo");
    expect(pollingSource).toContain("maybeSingle");
  });

  it("webhook handler checks for existing video before creating", () => {
    expect(webhookSource).toContain("existingVideo");
    expect(webhookSource).toContain("maybeSingle");
  });
});

describe("No broken video records possible", () => {
  it("polling handler: createVideo only happens AFTER successful upload AND verification", () => {
    // Upload error must return before createVideo
    const storageErrReturn = pollingSource.indexOf('errorMessage: "Video upload failed. Credits have been refunded."');
    expect(storageErrReturn).toBeGreaterThan(-1);

    // Verify error must return before createVideo
    const verifyErrReturn = pollingSource.indexOf('errorMessage: "Video verification failed. Credits have been refunded."');
    expect(verifyErrReturn).toBeGreaterThan(-1);

    // createVideo only after both checks pass
    const createVideoIdx = pollingSource.lastIndexOf("await createVideo({");
    expect(createVideoIdx).toBeGreaterThan(storageErrReturn);
    expect(createVideoIdx).toBeGreaterThan(verifyErrReturn);
  });

  it("webhook handler: createVideo only happens AFTER successful upload AND verification", () => {
    // Storage error returns before createVideo
    const storageErrReturn = webhookSource.indexOf("Storage upload failed");
    expect(storageErrReturn).toBeGreaterThan(-1);

    // Verify error returns before createVideo
    const verifyErrReturn = webhookSource.indexOf("Video verification failed");
    expect(verifyErrReturn).toBeGreaterThan(-1);

    // createVideo only after both checks pass
    const createVideoIdx = webhookSource.lastIndexOf("await createVideo({");
    expect(createVideoIdx).toBeGreaterThan(storageErrReturn);
    expect(createVideoIdx).toBeGreaterThan(verifyErrReturn);
  });
});
