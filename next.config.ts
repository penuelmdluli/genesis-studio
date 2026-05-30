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
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://plausible.io https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://*.r2.dev https://cdn.ivideostudio.ai https://*.fal.media https://fal.media https://*.cloudfront.net https://lh3.googleusercontent.com; media-src 'self' blob: https://*.r2.cloudflarestorage.com https://*.r2.dev https://cdn.ivideostudio.ai https://*.fal.media https://fal.media https://*.cloudfront.net; font-src 'self' data:; connect-src 'self' https://api.stripe.com https://*.fal.run https://queue.fal.run https://*.fal.media https://fal.media https://api.runpod.ai https://*.cloudfront.net https://*.r2.dev https://*.r2.cloudflarestorage.com https://cdn.ivideostudio.ai https://plausible.io https://static.cloudflareinsights.com; frame-src 'self' https://js.stripe.com https://challenges.cloudflare.com; worker-src 'self' blob:;",
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
      {
        source: "/api/explore/video/:path*",
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
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "cdn.ivideostudio.ai" },
      { protocol: "https", hostname: "**.fal.media" },
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
