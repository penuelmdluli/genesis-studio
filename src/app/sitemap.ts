import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blog-posts";

const BASE_URL = "https://ivideostudio.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/pricing`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/explore`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/sign-up`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/generate`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/brain`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/mimic`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/music-video`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/talking-avatar`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/docs`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/tutorials`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/blog`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/changelog`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE_URL}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...blogPages];
}
