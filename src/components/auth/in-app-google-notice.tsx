"use client";

import { useEffect, useState } from "react";
import { isAndroid, isInAppBrowser, openInChromeUrl } from "@/lib/in-app-browser";

/** True inside Facebook/Instagram/TikTok browsers, where Google sign-in is blocked. */
export function useInAppBrowser() {
  const [inApp, setInApp] = useState(false);
  useEffect(() => setInApp(isInAppBrowser()), []);
  return inApp;
}

/** Shown instead of "Continue with Google" inside an in-app browser. */
export function InAppGoogleNotice({ action = "sign up" }: { action?: string }) {
  const [chromeUrl, setChromeUrl] = useState<string | null>(null);
  useEffect(() => {
    if (isAndroid()) setChromeUrl(openInChromeUrl());
  }, []);

  return (
    <div className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm text-zinc-300">
      <p>
        Use your email below to {action}. Google sign-in doesn&apos;t work inside the Facebook or Instagram
        browser.
      </p>
      {chromeUrl ? (
        <a href={chromeUrl} className="mt-2 inline-block font-semibold text-violet-300 underline">
          Or open in Chrome to use Google
        </a>
      ) : (
        <p className="mt-1 text-xs text-zinc-400">To use Google, tap ••• and choose &quot;Open in browser&quot;.</p>
      )}
    </div>
  );
}
