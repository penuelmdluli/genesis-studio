// ============================================
// GENESIS STUDIO — Password Hashing (Workers-compatible)
// ============================================
// Uses Web Crypto PBKDF2 — available in Cloudflare Workers,
// Node.js, and all modern browsers. No native module dependencies.

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const ALGORITHM = "PBKDF2";
const HASH_ALGORITHM = "SHA-256";

/**
 * Hash a plaintext password using PBKDF2 with a random salt.
 * Returns a storable string: `pbkdf2:iterations:salt_hex:hash_hex`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    ALGORITHM,
    false,
    ["deriveBits"]
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: ALGORITHM,
      salt,
      iterations: ITERATIONS,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  const saltHex = toHex(salt);
  const hashHex = toHex(new Uint8Array(hash));

  return `pbkdf2:${ITERATIONS}:${saltHex}:${hashHex}`;
}

/**
 * Verify a plaintext password against a stored hash string.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split(":");
  if (parts[0] !== "pbkdf2" || parts.length !== 4) return false;

  const iterations = parseInt(parts[1], 10);
  const salt = fromHex(parts[2]);
  const expectedHash = parts[3];

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    ALGORITHM,
    false,
    ["deriveBits"]
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: ALGORITHM,
      salt: salt as BufferSource,
      iterations,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  const hashHex = toHex(new Uint8Array(hash));
  return timingSafeEqual(hashHex, expectedHash);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/** Constant-time string comparison to prevent timing attacks */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
