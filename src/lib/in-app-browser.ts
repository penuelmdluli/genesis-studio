// In-app browsers (Facebook, Instagram, TikTok, Messenger...) are where our ad
// traffic lands. They are slow WebViews, and Google refuses to sign anyone in
// from inside one ("disallowed_useragent"), so a few things behave differently.

const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Instagram|Messenger|musical_ly|Bytedance|TikTok|Line\/|Snapchat|Twitter|; wv\)/i;

export function isInAppBrowser(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  return IN_APP.test(ua);
}

export function isAndroid(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  return /Android/i.test(ua);
}

/** Android intent that reopens the current page in Chrome, leaving the in-app browser. */
export function openInChromeUrl(href: string = typeof window !== "undefined" ? window.location.href : ""): string {
  const url = new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.toString())};end`;
}
