/**
 * Genesis Studio — Error Monitoring
 * Console-based error tracking. Cloudflare Logpush captures these logs.
 */

export async function captureError(error: Error | string, context?: Record<string, unknown>) {
  const err = typeof error === "string" ? new Error(error) : error;
  console.error("[ERROR]", err.message, context || "");
}

export async function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
  const logFn = level === "error" ? console.error : level === "warning" ? console.warn : console.info;
  logFn(`[${level.toUpperCase()}]`, message);
}

export async function setUser(_userId: string, _email?: string) {
  // No-op — user context logged via request headers
}

export async function addBreadcrumb(_message: string, _category: string, _data?: Record<string, unknown>) {
  // No-op — breadcrumbs not needed with console logging
}
