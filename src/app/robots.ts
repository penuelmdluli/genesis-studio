import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://genesis-studio-hazel.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/generate", "/gallery", "/settings", "/api-keys"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
