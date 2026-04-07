"use client";

import { useState, useRef, useEffect } from "react";

// ============================================
// HERO VIDEO — Instant-load 3-layer strategy
// Layer 1 (0ms):   Animated gradient + particles
// Layer 2 (~300ms): Static poster image (from R2)
// Layer 3 (3-5s):   Actual video fades in
//
// The user NEVER sees a black screen.
// ============================================

// Poster served from R2 via /api/assets/hero-poster
// This is a permanent, heavily cached (1 week) image.
// If no poster exists yet, the gradient stays visible.
const HERO_POSTER = "/api/assets/hero-poster";

// Fetch featured videos from explore API
async function fetchHeroVideos(): Promise<string[]> {
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

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [posterError, setPosterError] = useState(false);

  // Video crossfade state
  const [heroVideos, setHeroVideos] = useState<string[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Layer 2: Preload poster image immediately on mount
  useEffect(() => {
    const img = new Image();
    img.onload = () => setPosterLoaded(true);
    img.onerror = () => setPosterError(true);
    img.src = HERO_POSTER;
  }, []);

  // Layer 3: Fetch videos from API
  useEffect(() => {
    fetchHeroVideos().then((urls) => {
      if (urls.length > 0) setHeroVideos(urls);
    });
  }, []);

  // Crossfade every 6s when multiple videos available
  useEffect(() => {
    if (heroVideos.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroVideos.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [heroVideos.length]);

  const hasMultiple = heroVideos.length > 1;
  const hasAnyVideo = heroVideos.length > 0;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* ---- LAYER 1: Animated gradient — renders at 0ms, NEVER a black screen ---- */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          videoLoaded ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/80 via-[#0A0A0F] to-blue-950/60" />
        {/* Subtle floating particle grid */}
        <div
          className="absolute inset-0 animate-hero-float"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(139,92,246,0.12) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Soft glow orbs for depth */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-blue-600/8 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* ---- LAYER 2: Poster image — loads in <500ms, blurred for cinematic feel ---- */}
      {posterLoaded && !posterError && (
        <img
          src={HERO_POSTER}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            videoLoaded ? "opacity-0" : "opacity-100"
          }`}
          style={{ filter: "blur(2px) brightness(0.7)" }}
        />
      )}

      {/* ---- LAYER 3: Actual video — fades in smoothly when buffered ---- */}
      {hasAnyVideo &&
        (hasMultiple ? (
          // Multiple videos with crossfade rotation
          heroVideos.map((src, i) => {
            const isActive = i === heroIndex;
            const isNext = i === (heroIndex + 1) % heroVideos.length;
            if (!isActive && !isNext) return null;
            return (
              <video
                key={src}
                ref={(el) => {
                  heroVideoRefs.current[i] = el;
                }}
                src={src}
                autoPlay
                muted
                loop
                playsInline
                crossOrigin="anonymous"
                preload={isActive ? "auto" : "metadata"}
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms] ease-in-out"
                style={{ opacity: isActive ? 1 : 0 }}
                onCanPlay={() => {
                  if (isActive && !videoLoaded) setVideoLoaded(true);
                }}
              />
            );
          })
        ) : (
          // Single video — simplest case
          <video
            ref={videoRef}
            src={heroVideos[0]}
            autoPlay
            muted
            loop
            playsInline
            crossOrigin="anonymous"
            preload="auto"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
              videoLoaded ? "opacity-100" : "opacity-0"
            }`}
            onCanPlay={() => {
              setVideoLoaded(true);
              videoRef.current?.play().catch(() => {});
            }}
          />
        ))}

      {/* ---- Dark overlays for text readability — always on top ---- */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-transparent to-transparent" />
    </div>
  );
}
