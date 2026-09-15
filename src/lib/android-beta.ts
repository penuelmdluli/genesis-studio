// Android beta (Google Play closed test) — shared constants.

export const ANDROID_PACKAGE = "ai.ivideostudio.app";
/** Google Play's closed-test opt-in page. Only works for accounts on the tester list. */
export const PLAY_OPT_IN_URL = `https://play.google.com/apps/testing/${ANDROID_PACKAGE}`;
/** Anyone can join this Google Group; the closed test admits every member, so no manual tester list. */
export const BETA_GROUP_URL = "https://groups.google.com/g/ivideostudio-android-beta";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
/** Google needs this many testers opted in for 14 days before production. */
export const TESTERS_NEEDED = 12;
/** One-time thank-you for signed-in users who join. */
export const TESTER_BONUS_CREDITS = 50;

/** Set PLAY_TESTING_OPEN=true once Google approves the closed test. */
export function testingOpen(): boolean {
  return process.env.PLAY_TESTING_OPEN === "true";
}

export function betaShareMessage(appUrl: string): string {
  return `📱 iVideo Studio is launching on Android and needs testers! Make AI movies, cartoons and dance reels on your phone. Join the free beta here: ${appUrl}/android-beta?utm_source=whatsapp&utm_medium=share&utm_campaign=android-beta`;
}

export function betaWhatsappUrl(appUrl: string): string {
  return `https://wa.me/?text=${encodeURIComponent(betaShareMessage(appUrl))}`;
}
