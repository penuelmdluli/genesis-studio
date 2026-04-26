// ============================================
// GENESIS STUDIO — Defensive Env Var Helpers
// Immune to trailing newlines, whitespace, case
// mismatches, and missing vars.
// ============================================

export function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return raw.trim().toLowerCase() === "true";
}

export function envString(name: string): string | undefined {
  return process.env[name]?.trim();
}

export function envNumber(name: string, defaultValue: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return defaultValue;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : defaultValue;
}
