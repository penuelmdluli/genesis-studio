/**
 * Genesis Studio — Error Monitoring
 * Lightweight wrapper that works with or without Sentry installed.
 * Install Sentry: npx @sentry/wizard@latest -i nextjs
 * Then set SENTRY_DSN in env vars.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let sentryModule: any = null;

// Lazy-load Sentry to avoid breaking if not installed.
// Use a variable for the module name so TypeScript doesn't resolve it at compile time.
async function getSentry(): Promise<any> {
  if (sentryModule) return sentryModule;
  try {
    const mod = "@sentry/nextjs";
    sentryModule = await (Function('m', 'return import(m)')(mod));
    return sentryModule;
  } catch {
    return null;
  }
}

/**
 * Capture an error to Sentry (or console if Sentry not installed).
 */
export async function captureError(error: Error | string, context?: Record<string, unknown>) {
  const sentry = await getSentry();
  const err = typeof error === "string" ? new Error(error) : error;

  if (sentry?.captureException) {
    sentry.captureException(err, { extra: context });
  } else {
    console.error("[ERROR]", err.message, context || "");
  }
}

/**
 * Capture a message to Sentry (or console).
 */
export async function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
  const sentry = await getSentry();

  if (sentry?.captureMessage) {
    sentry.captureMessage(message, level);
  } else {
    const logFn = level === "error" ? console.error : level === "warning" ? console.warn : console.info;
    logFn(`[${level.toUpperCase()}]`, message);
  }
}

/**
 * Set user context for Sentry.
 */
export async function setUser(userId: string, email?: string) {
  const sentry = await getSentry();
  if (sentry?.setUser) {
    sentry.setUser({ id: userId, email });
  }
}

/**
 * Add breadcrumb for debugging.
 */
export async function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>) {
  const sentry = await getSentry();
  if (sentry?.addBreadcrumb) {
    sentry.addBreadcrumb({ message, category, data, level: "info" });
  }
}
