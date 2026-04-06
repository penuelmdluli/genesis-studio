import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.clerk.io https://*.clerk.accounts.dev https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://img.clerk.com https://*.clerk.accounts.dev https://*.fal.media https://fal.media; media-src 'self' blob: https://*.r2.cloudflarestorage.com; font-src 'self' data:; connect-src 'self' https://*.clerk.accounts.dev https://api.clerk.io https://api.stripe.com https://*.fal.run https://queue.fal.run https://*.fal.media https://fal.media https://api.runpod.ai https://*.supabase.co wss://*.supabase.co; frame-src 'self' https://*.clerk.accounts.dev https://js.stripe.com https://challenges.cloudflare.com; worker-src 'self' blob:;",
          },
        ],
      },
      {
        source: "/api/videos/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, HEAD, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Range" },
          { key: "Access-Control-Expose-Headers", value: "Content-Range, Content-Length" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.fal.media" },
      { protocol: "https", hostname: "fal.media" },
    ],
  },
};

export default nextConfig;
