/**
 * Exponential backoff retry helper with jitter.
 *
 * Usage:
 *   const result = await retry(() => fetch(url), { maxAttempts: 3 });
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Return true to abort retries early (e.g., on 404 or auth errors). */
  shouldAbort?: (error: unknown) => boolean;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 8000,
    shouldAbort,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (shouldAbort?.(err)) throw err;
      if (attempt >= maxAttempts) break;

      const delay = Math.min(
        baseDelayMs * 2 ** (attempt - 1) + Math.random() * 500,
        maxDelayMs
      );

      if (attempt > 1) {
        console.warn(
          `[RETRY] Attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(delay)}ms:`,
          err instanceof Error ? err.message : err
        );
      }

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

/** Abort on HTTP status codes that won't succeed on retry. */
export function isNonRetryableStatus(status: number): boolean {
  return status === 400 || status === 401 || status === 403 || status === 404 || status === 410 || status === 422;
}
