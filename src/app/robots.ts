import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Auth-gated app routes (per src/middleware.ts) + private areas.
        // Keep in sync with middleware PUBLIC_PATHS / PUBLIC_PREFIXES.
        disallow: [
          "/api/",
          "/dashboard",
          "/dev-dashboard",
          "/admin",
          "/settings",
          "/api-keys",
          "/generate",
          "/brain",
          "/mimic",
          "/music-video",
          "/talking-avatar",
          "/motion-control",
          "/gallery",
          "/collections",
          "/images",
          "/captions",
          "/voiceover",
          "/thumbnails",
          "/upscale",
          "/edit",
          "/studio",
          "/intelligence",
          "/product-ads",
          "/status",
          "/onboarding",
        ],
      },
    ],
    sitemap: "https://ivideostudio.ai/sitemap.xml",
  };
}
