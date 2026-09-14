import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyYocoSignature } from "./yoco";

// Mirrors Yoco's published verification sample exactly: secret is
// "whsec_" + base64, signed content is `${id}.${ts}.${body}`, HMAC-SHA256,
// base64, header "v1,<sig>".
function sign(secretB64: string, id: string, ts: string, body: string): string {
  return crypto
    .createHmac("sha256", Buffer.from(secretB64, "base64"))
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
}

const secretB64 = Buffer.from("a-32-byte-test-secret-for-yoco!!").toString("base64");
const secret = `whsec_${secretB64}`;
const body = JSON.stringify({ type: "payment.succeeded", payload: { id: "p_1", metadata: { checkoutId: "ch_1" } } });
const id = "msg_123";
const now = 1_800_000_000;
const ts = String(now);

describe("verifyYocoSignature", () => {
  it("accepts a correctly signed event", () => {
    const sig = sign(secretB64, id, ts, body);
    const r = verifyYocoSignature({ secret, rawBody: body, webhookId: id, timestamp: ts, signatureHeader: `v1,${sig}`, now });
    expect(r.ok).toBe(true);
  });

  it("accepts when the matching signature is not the first in the list", () => {
    const sig = sign(secretB64, id, ts, body);
    const r = verifyYocoSignature({ secret, rawBody: body, webhookId: id, timestamp: ts, signatureHeader: `v1,AAAA v1,${sig}`, now });
    expect(r.ok).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = sign(secretB64, id, ts, body);
    const r = verifyYocoSignature({ secret, rawBody: body.replace("ch_1", "ch_2"), webhookId: id, timestamp: ts, signatureHeader: `v1,${sig}`, now });
    expect(r.ok).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const sig = sign(Buffer.from("some-other-secret-entirely-1234").toString("base64"), id, ts, body);
    const r = verifyYocoSignature({ secret, rawBody: body, webhookId: id, timestamp: ts, signatureHeader: `v1,${sig}`, now });
    expect(r.ok).toBe(false);
  });

  it("rejects a stale timestamp (replay)", () => {
    const oldTs = String(now - 10 * 60);
    const sig = sign(secretB64, id, oldTs, body);
    const r = verifyYocoSignature({ secret, rawBody: body, webhookId: id, timestamp: oldTs, signatureHeader: `v1,${sig}`, now });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/timestamp/);
  });

  it("rejects missing headers", () => {
    const r = verifyYocoSignature({ secret, rawBody: body, webhookId: undefined, timestamp: ts, signatureHeader: "v1,x", now });
    expect(r.ok).toBe(false);
  });

  it("never matches the old (body-only, hex) scheme", () => {
    const legacy = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const r = verifyYocoSignature({ secret, rawBody: body, webhookId: id, timestamp: ts, signatureHeader: `v1,${legacy}`, now });
    expect(r.ok).toBe(false);
  });
});
