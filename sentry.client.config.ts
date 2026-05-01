import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,

  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "development",

  ignoreErrors: [
    // Browser extensions and noise
    "ResizeObserver loop",
    "ResizeObserver loop completed with undelivered notifications",
    // Clerk session timeouts (expected)
    "clerk_session_expired",
    "ClerkRuntimeError",
    // Network errors from users on flaky connections
    "Failed to fetch",
    "Load failed",
    "NetworkError",
  ],
});
