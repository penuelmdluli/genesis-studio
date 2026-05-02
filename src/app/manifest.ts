import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Genesis Studio",
    short_name: "Genesis",
    description:
      "AI video generation for African creators. Generate, voice, caption, and auto-post in minutes.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0A0F",
    theme_color: "#7c3aed",
    categories: ["entertainment", "productivity", "video"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Generate Video",
        url: "/generate",
        description: "Create a new AI video",
      },
      {
        name: "Gallery",
        url: "/gallery",
        description: "View your generated videos",
      },
      {
        name: "Brain Studio",
        url: "/brain",
        description: "Multi-scene AI productions",
      },
    ],
  };
}
