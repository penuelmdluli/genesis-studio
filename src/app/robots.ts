import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/generate", "/settings", "/dev-dashboard"],
      },
    ],
    sitemap: "https://ivideostudio.ai/sitemap.xml",
  };
}
