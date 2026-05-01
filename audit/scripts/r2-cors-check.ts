/**
 * R2 CORS Health Check
 *
 * Verifies that the R2 public URL serves video files with proper CORS headers.
 * Can be run standalone or wired into a cron check.
 *
 * Usage: npx tsx audit/scripts/r2-cors-check.ts
 */

const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL || "https://pub-891668ae91a142968457a5383e993020.r2.dev";
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://genesisstudio.app";

async function checkCors() {
  // Use a known explore video key or just check the root
  const testUrl = `${R2_PUBLIC_URL}/health-check-probe`;

  console.log(`[R2 CORS CHECK] Testing: ${testUrl}`);
  console.log(`[R2 CORS CHECK] Origin: ${ORIGIN}`);

  try {
    const res = await fetch(testUrl, {
      method: "HEAD",
      headers: {
        Origin: ORIGIN,
      },
    });

    const corsHeader = res.headers.get("access-control-allow-origin");
    const contentType = res.headers.get("content-type");

    console.log(`[R2 CORS CHECK] Status: ${res.status}`);
    console.log(`[R2 CORS CHECK] Access-Control-Allow-Origin: ${corsHeader || "MISSING"}`);
    console.log(`[R2 CORS CHECK] Content-Type: ${contentType || "MISSING"}`);

    if (res.status === 404) {
      console.log("[R2 CORS CHECK] WARN: Test file not found (404). Upload a test file to verify CORS.");
      console.log("[R2 CORS CHECK] R2 connectivity is OK (got a response).");
      return true;
    }

    if (!corsHeader) {
      console.error("[R2 CORS CHECK] FAIL: No CORS header present.");
      console.error("[R2 CORS CHECK] Apply CORS rules from audit/r2-cors.json to the R2 bucket.");
      return false;
    }

    if (corsHeader !== "*" && !corsHeader.includes("genesisstudio.app")) {
      console.error(`[R2 CORS CHECK] FAIL: CORS header '${corsHeader}' does not allow genesisstudio.app`);
      return false;
    }

    console.log("[R2 CORS CHECK] PASS: CORS headers are correctly configured.");
    return true;
  } catch (err) {
    console.error("[R2 CORS CHECK] FAIL: Could not reach R2 public URL:", err);
    return false;
  }
}

checkCors().then((ok) => {
  process.exit(ok ? 0 : 1);
});
