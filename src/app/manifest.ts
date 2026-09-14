import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "iVideo Studio",
    short_name: "iVideo",
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
    // Makes the installed app appear in the phone's own share sheet, so a
    // trending reel goes from Facebook onto the lead list in one tap. Android
    // sends the link in `url` on most apps but in `text` on some (Facebook
    // included), which is why /lead-videos reads either.
    share_target: {
      action: "/lead-videos",
      method: "GET",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
    shortcuts: [
      {
        name: "Save a Lead Video",
        url: "/lead-videos",
        description: "Paste a trending link to use later",
      },
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
        name: "Creator Tools",
        url: "/tools",
        description: "Add sound, dub, remove background, make a beat",
      },
    ],
  };
}
