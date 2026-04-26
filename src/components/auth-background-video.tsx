"use client";

import { useEffect, useState } from "react";

async function fetchAuthVideos(): Promise<string[]> {
  try {
    const res = await fetch("/api/explore?tab=picks&limit=6");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.videos || [])
      .map((v: { videoUrl?: string }) => v.videoUrl)
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function AuthBackgroundVideo() {
  const [videos, setVideos] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    fetchAuthVideos().then((urls) => urls.length && setVideos(urls));
  }, []);

  useEffect(() => {
    if (videos.length <= 1) return;
    const i = setInterval(
      () => setIdx((p) => (p + 1) % videos.length),
      7000,
    );
    return () => clearInterval(i);
  }, [videos.length]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {videos.map((src, i) => (
        <video
          key={src}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          crossOrigin="anonymous"
          preload={i === idx ? "auto" : "metadata"}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms] ease-in-out"
          style={{ opacity: i === idx ? 0.45 : 0 }}
        />
      ))}
      {/* Right-side dim for form readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0F]/40 via-[#0A0A0F]/55 to-[#0A0A0F]/85" />
      {/* Vertical falloff */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0F]/30 via-transparent to-[#0A0A0F]/70" />
    </div>
  );
}
