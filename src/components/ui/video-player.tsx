"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Download,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  audioSrc?: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  duration?: number;
  onEnded?: () => void;
}

export function VideoPlayer({
  src,
  poster,
  audioSrc,
  title,
  className,
  autoPlay = false,
  loop = false,
  duration: fallbackDuration,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Format time as m:ss
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Sync audio with video
  const syncAudio = useCallback(() => {
    if (audioRef.current && videoRef.current) {
      audioRef.current.currentTime = videoRef.current.currentTime;
      audioRef.current.muted = isMuted;
      audioRef.current.volume = volume;
    }
  }, [isMuted, volume]);

  // Play/pause toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      audioRef.current?.play();
      setIsPlaying(true);
    } else {
      video.pause();
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }, []);

  // Mute toggle
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (videoRef.current) videoRef.current.muted = next;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  // Volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    if (audioRef.current) audioRef.current.volume = val;
    if (val === 0) setIsMuted(true);
    else setIsMuted(false);
  }, []);

  // Seek
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const bar = progressRef.current;
    if (!video || !bar) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
    syncAudio();
  }, [syncAudio]);

  // Skip forward/back
  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    syncAudio();
  }, [syncAudio]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Download
  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = src;
    a.download = title || "genesis-video.mp4";
    a.click();
  }, [src, title]);

  // Retry loading the video
  const handleRetry = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setIsLoading(true);
    setRetryCount((c) => c + 1);
    // Force reload by resetting the src
    video.src = src;
    video.load();
  }, [src]);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  // Video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onLoadedMetadata = () => {
      // Use video's reported duration, but fall back to prop if it's 0/NaN/Infinity
      const reported = video.duration;
      if (isFinite(reported) && reported > 0) {
        setDuration(reported);
      } else if (fallbackDuration && fallbackDuration > 0) {
        setDuration(fallbackDuration);
      }
      setIsLoading(false);
      setError(null);
    };
    const onVideoError = () => {
      const mediaError = video.error;
      let message = "Failed to load video";
      if (mediaError) {
        switch (mediaError.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            message = "Network error — could not load video";
            break;
          case MediaError.MEDIA_ERR_DECODE:
            message = "Video file is corrupted or unsupported";
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = "Video format not supported";
            break;
          default:
            message = "An error occurred while loading the video";
        }
      }
      setError(message);
      setIsLoading(false);
    };
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => { setIsLoading(false); setError(null); };
    const onEnded = () => {
      setIsPlaying(false);
      audioRef.current?.pause();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("ended", onEnded);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onVideoError);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onVideoError);
    };
  }, [fallbackDuration]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "ArrowLeft":
          skip(-5);
          break;
        case "ArrowRight":
          skip(5);
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume((v) => Math.min(1, v + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume((v) => Math.max(0, v - 0.1));
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [togglePlay, toggleMute, toggleFullscreen, skip]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative group bg-black rounded-xl overflow-hidden select-none",
        isFullscreen && "rounded-none",
        className
      )}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        muted={isMuted}
        playsInline
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        onEnded={onEnded}
      />

      {/* Audio track (for separate audio) */}
      {audioSrc && (
        <audio ref={audioRef} src={audioSrc} loop={loop} muted={isMuted} />
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 z-10">
          <AlertTriangle className="w-10 h-10 text-violet-400 mb-3" />
          <p className="text-sm text-white/80 mb-1 text-center px-4">{error}</p>
          {retryCount > 0 && (
            <p className="text-xs text-white/40 mb-3">Attempt {retryCount + 1}</p>
          )}
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Loading spinner */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>
      )}

      {/* Big play button when paused */}
      {!isPlaying && !isLoading && !error && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors">
            <Play className="w-7 h-7 text-white ml-1" fill="white" />
          </div>
        </button>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 transition-all duration-300",
          showControls || !isPlaying
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none"
        )}
      >
        {/* Gradient fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

        <div className="relative px-4 pb-3 pt-8">
          {/* Progress bar */}
          <div
            ref={progressRef}
            className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group/progress hover:h-2 transition-all"
            onClick={handleSeek}
          >
            {/* Buffered */}
            <div
              className="absolute h-full bg-white/20 rounded-full"
              style={{ width: `${bufferedProgress}%` }}
            />
            {/* Progress */}
            <div
              className="relative h-full bg-violet-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            >
              {/* Thumb */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {/* Play/pause */}
              <button
                onClick={togglePlay}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" fill="white" />}
              </button>

              {/* Skip back */}
              <button
                onClick={() => skip(-5)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                aria-label="Rewind 5s"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Skip forward */}
              <button
                onClick={() => skip(5)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                aria-label="Forward 5s"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Volume */}
              <div className="flex items-center gap-1 group/vol">
                <button
                  onClick={toggleMute}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-0 group-hover/vol:w-16 transition-all duration-200 accent-violet-500 h-1 cursor-pointer"
                />
              </div>

              {/* Time */}
              <span className="text-xs text-white/70 font-mono ml-1">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Title */}
              {title && (
                <span className="text-xs text-white/50 truncate max-w-[150px] mr-2 hidden sm:block">
                  {title}
                </span>
              )}

              {/* Download */}
              <button
                onClick={handleDownload}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                aria-label="Download"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
