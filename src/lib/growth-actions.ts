// ============================================
// Signed approval links for the growth brain
// ============================================
// The owner approves work from an email on a phone, signed out. The signature
// in the link is the authorisation, so it must cover the action id AND the
// decision - otherwise an "approve" link could be edited into a "reject" one,
// or reused for a different action.

const SECRET = () => process.env.GROWTH_ACTION_SECRET || process.env.CRON_SECRET || "";

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`growth-action:${SECRET()}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(mac)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function actionToken(id: string, decision: string): Promise<string> {
  return sign(`${id}:${decision}`);
}

function sameToken(expected: string, token: string): boolean {
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export async function verifyActionToken(id: string, decision: string, token: string): Promise<boolean> {
  if (!id || !decision || !token || !SECRET()) return false;
  return sameToken(await actionToken(id, decision), token);
}

// A batch link covers an exact set of actions. The ids are sorted before
// signing, so the set cannot be widened by appending an id to the URL - any
// change to the list breaks the signature.
export async function batchToken(ids: string[], decision: string): Promise<string> {
  return sign(`batch:${[...ids].sort().join(",")}:${decision}`);
}

export async function verifyBatchToken(ids: string[], decision: string, token: string): Promise<boolean> {
  if (!ids.length || !decision || !token || !SECRET()) return false;
  return sameToken(await batchToken(ids, decision), token);
}
