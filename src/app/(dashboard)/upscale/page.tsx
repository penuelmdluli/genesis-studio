"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { PageTransition } from "@/components/ui/motion";
import { ArrowUpCircle, Upload, Zap, Play } from "lucide-react";

const PLAN_ORDER = ["free", "creator", "pro", "studio"] as const;

function planAtLeast(userPlan: string, required: string): boolean {
  const userIdx = PLAN_ORDER.indexOf(userPlan as (typeof PLAN_ORDER)[number]);
  const reqIdx = PLAN_ORDER.indexOf(required as (typeof PLAN_ORDER)[number]);
  return userIdx >= reqIdx;
}

const RESOLUTION_OPTIONS = [
  { value: "1080p", label: "1080p (HD)", minPlan: "creator" },
  { value: "4k", label: "4K (Ultra HD)", minPlan: "pro" },
] as const;

const INTERPOLATION_OPTIONS = [
  { value: "none", label: "None", minPlan: "free" },
  { value: "24-30", label: "24 \u2192 30 fps", minPlan: "studio" },
  { value: "24-60", label: "24 \u2192 60 fps", minPlan: "studio", badge: "Pro+" },
] as { value: string; label: string; minPlan: string; badge?: string }[];

export default function UpscalePage() {
  const { user, updateCreditBalance, videos } = useStore();
  const { toast } = useToast();

  // Upload state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(5);
  const [selectedGalleryVideoId, setSelectedGalleryVideoId] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  // Settings
  const [targetResolution, setTargetResolution] = useState<"1080p" | "4k">("1080p");
  const [frameInterpolation, setFrameInterpolation] = useState<string>("none");

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Double-click protection
  const upscaleLockRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userPlan = user?.plan || "free";
  const creditCost = Math.ceil((videoDuration || 5) / 5) * 5;
  const hasEnoughCredits = user?.isOwner || (user?.creditBalance ?? 0) >= creditCost;
  const estimatedTime = targetResolution === "4k" ? Math.ceil(videoDuration * 8) : Math.ceil(videoDuration * 4);

  const hasVideo = !!videoFile || !!selectedGalleryVideoId;
  const canUpscale1080 = planAtLeast(userPlan, "creator");
  const canUpscale4k = planAtLeast(userPlan, "pro");
  const canInterpolate = planAtLeast(userPlan, "studio");

  const selectedGalleryVideo = videos.find((v) => v.id === selectedGalleryVideoId);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("video/")) {
      toast("Please select a video file.", "error");
      return;
    }
    setVideoFile(file);
    setSelectedGalleryVideoId("");
    setResultUrl(null);
    setError(null);

    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);

    // Get duration from video metadata
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setVideoDuration(Math.ceil(video.duration));
      URL.revokeObjectURL(video.src);
    };
    video.src = url;
  }, [toast]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleGallerySelect = (videoId: string) => {
    setSelectedGalleryVideoId(videoId);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setResultUrl(null);
    setError(null);

    const vid = videos.find((v) => v.id === videoId);
    if (vid) {
      setVideoDuration(Math.ceil(vid.duration));
    }
  };

  const handleUpscale = async () => {
    if (upscaleLockRef.current) return;
    upscaleLockRef.current = true;

    setError(null);

    if (!hasVideo) {
      setError("Please upload a video or select one from your gallery.");
      upscaleLockRef.current = false;
      return;
    }

    if (!canUpscale1080) {
      setError("Video upscaling requires a Creator+ plan.");
      upscaleLockRef.current = false;
      return;
    }

    if (targetResolution === "4k" && !canUpscale4k) {
      setError("4K upscaling requires a Pro+ plan.");
      upscaleLockRef.current = false;
      return;
    }

    if (frameInterpolation !== "none" && !canInterpolate) {
      setError("Frame interpolation requires a Studio plan.");
      upscaleLockRef.current = false;
      return;
    }

    if (!hasEnoughCredits) {
      setError(
        `Not enough credits. You need ${creditCost} but have ${user?.creditBalance ?? 0}.`
      );
      upscaleLockRef.current = false;
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResultUrl(null);

    try {
      // Determine video URL: if file upload, use presigned upload first
      let videoUrl: string;

      if (videoFile) {
        const formData = new FormData();
        formData.append("file", videoFile);
        formData.append("purpose", "video");
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload video");
        }

        const { downloadUrl } = await uploadRes.json();
        videoUrl = downloadUrl;
      } else if (selectedGalleryVideo) {
        videoUrl = selectedGalleryVideo.url;
      } else {
        throw new Error("No video selected");
      }

      const res = await fetch("/api/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl,
          targetResolution,
          frameInterpolation: frameInterpolation !== "none" ? frameInterpolation : undefined,
          videoDuration,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upscale failed. Please try again.");
        toast(data.error || "Upscale failed", "error");
        setIsProcessing(false);
        upscaleLockRef.current = false;
        return;
      }

      setJobId(data.jobId);
      updateCreditBalance((user?.creditBalance ?? 0) - data.creditsCost);
      toast("Upscaling started! This may take a few minutes.", "success");

      // Simulate progress polling (in production, poll /api/jobs/:id/status)
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + Math.random() * 8;
        });
      }, 2000);

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/jobs/${data.jobId}/status`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.status === "completed" && statusData.outputUrl) {
              clearInterval(progressInterval);
              clearInterval(pollInterval);
              setProgress(100);
              setResultUrl(statusData.outputUrl);
              setIsProcessing(false);
              toast("Video upscaled successfully!", "success");
            } else if (statusData.status === "failed") {
              clearInterval(progressInterval);
              clearInterval(pollInterval);
              setIsProcessing(false);
              setError("Upscaling failed. Credits have been refunded.");
              toast("Upscaling failed. Credits refunded.", "error");
            }
          }
        } catch {
          // Polling error, continue
        }
      }, 5000);
    } catch (err) {
      console.error("Upscale failed:", err);
      setError("Network error. Please check your connection and try again.");
      toast("Network error. Please try again.", "error");
      setIsProcessing(false);
    } finally {
      upscaleLockRef.current = false;
    }
  };

  return (
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <ArrowUpCircle className="w-7 h-7 text-violet-400" />
          Video Upscaler
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Enhance your videos to higher resolutions with AI-powered upscaling.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input & Settings */}
        <div className="lg:col-span-2 space-y-4">
          {/* Upload Zone */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Source Video</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {videoPreviewUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-white/[0.06]">
                  <video
                    src={videoPreviewUrl}
                    controls
                    className="w-full max-h-72 bg-[#0D0D14]"
                  />
                  <button
                    onClick={() => {
                      setVideoFile(null);
                      setVideoPreviewUrl(null);
                      setVideoDuration(5);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-zinc-300 hover:text-white transition-colors text-xs px-3 py-1"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`flex flex-col items-center justify-center p-12 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? "border-violet-500/50 bg-violet-500/[0.06]"
                      : "border-white/[0.08] hover:border-violet-500/30 bg-white/[0.01]"
                  }`}
                >
                  <Upload className="w-10 h-10 text-zinc-600 mb-3" />
                  <span className="text-sm text-zinc-400">
                    Drag & drop a video or click to upload
                  </span>
                  <span className="text-xs text-zinc-600 mt-1">
                    MP4, MOV, WebM up to 500MB
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                    className="hidden"
                  />
                </label>
              )}

              {/* Gallery Select */}
              {videos.length > 0 && (
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5 font-medium">
                    Or select from your gallery
                  </label>
                  <select
                    value={selectedGalleryVideoId}
                    onChange={(e) => handleGallerySelect(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] text-zinc-300 text-sm px-3 py-2.5 focus:outline-none focus:border-violet-500/40 transition-colors"
                  >
                    <option value="" className="bg-[#0A0A0F]">
                      Choose a video...
                    </option>
                    {videos.map((v) => (
                      <option key={v.id} value={v.id} className="bg-[#0A0A0F]">
                        {v.title || v.prompt?.slice(0, 50) || v.id} ({v.duration}s, {v.resolution})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resolution Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Target Resolution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {RESOLUTION_OPTIONS.map((opt) => {
                  const isActive = targetResolution === opt.value;
                  const isLocked = !planAtLeast(userPlan, opt.minPlan);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => !isLocked && setTargetResolution(opt.value as "1080p" | "4k")}
                      disabled={isLocked}
                      className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                        isLocked
                          ? "opacity-40 cursor-not-allowed border-white/[0.04]"
                          : isActive
                          ? "border-violet-500/40 bg-violet-500/10 shadow-lg shadow-violet-500/5"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-sm font-semibold ${
                            isActive ? "text-violet-300" : "text-zinc-300"
                          }`}
                        >
                          {opt.label}
                        </span>
                        {isLocked && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            {opt.minPlan === "pro" ? "Pro+" : "Creator+"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {opt.value === "1080p" ? "1920x1080 pixels" : "3840x2160 pixels"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Frame Interpolation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Frame Interpolation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {INTERPOLATION_OPTIONS.map((opt) => {
                  const isActive = frameInterpolation === opt.value;
                  const isLocked = opt.value !== "none" && !canInterpolate;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => !isLocked && setFrameInterpolation(opt.value)}
                      disabled={isLocked}
                      className={`p-3 rounded-xl border text-center transition-all duration-200 ${
                        isLocked
                          ? "opacity-40 cursor-not-allowed border-white/[0.04]"
                          : isActive
                          ? "border-violet-500/40 bg-violet-500/10 shadow-lg shadow-violet-500/5"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          className={`text-sm font-medium ${
                            isActive ? "text-violet-300" : "text-zinc-300"
                          }`}
                        >
                          {opt.label}
                        </span>
                        {opt.badge && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {isLocked && opt.value !== "none" && (
                        <div className="text-[10px] text-zinc-600 mt-1">Studio plan</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Result Preview */}
          {resultUrl && (
            <Card glow>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Play className="w-4 h-4 text-violet-400" />
                  Upscaled Result
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl overflow-hidden border border-white/[0.06]">
                  <video
                    src={resultUrl}
                    controls
                    className="w-full max-h-96 bg-[#0D0D14]"
                  />
                </div>
                <a
                  href={resultUrl}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
                >
                  Download Upscaled Video
                </a>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Summary & Action */}
        <div className="space-y-4">
          <Card glow className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Upscale Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Source</span>
                  <span className="text-zinc-200 truncate ml-2 max-w-[160px]">
                    {videoFile
                      ? videoFile.name
                      : selectedGalleryVideo
                      ? selectedGalleryVideo.title || "Gallery video"
                      : "No video selected"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Duration</span>
                  <span className="text-zinc-200">{videoDuration}s</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Target</span>
                  <span className="text-zinc-200">
                    {targetResolution === "4k" ? "4K Ultra HD" : "1080p HD"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Interpolation</span>
                  <span className="text-zinc-200">
                    {frameInterpolation === "none"
                      ? "None"
                      : frameInterpolation === "24-30"
                      ? "24 \u2192 30 fps"
                      : "24 \u2192 60 fps"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Est. Time</span>
                  <span className="text-zinc-200">~{estimatedTime}s</span>
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-zinc-300">Cost</span>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-violet-400" />
                    <span className="text-xl font-bold text-violet-300">
                      {creditCost}
                    </span>
                    <span className="text-xs text-zinc-500">credits</span>
                  </div>
                </div>
                <div className="text-[10px] text-zinc-600 mt-1">
                  5 credits per 5 seconds of video
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-zinc-500">Your balance</span>
                  <span
                    className={`text-xs font-semibold ${
                      hasEnoughCredits ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {user?.isOwner
                      ? "\u221E Unlimited"
                      : `${user?.creditBalance?.toLocaleString() ?? 0} credits`}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Processing...</span>
                    <span className="text-violet-400">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <Button
                className="w-full shadow-lg shadow-violet-600/20"
                size="lg"
                disabled={
                  !hasVideo || isProcessing || !canUpscale1080 || !user
                }
                loading={isProcessing}
                onClick={handleUpscale}
              >
                {isProcessing ? (
                  "Upscaling..."
                ) : !user ? (
                  "Loading..."
                ) : !canUpscale1080 ? (
                  "Creator+ Plan Required"
                ) : !hasEnoughCredits ? (
                  "Not enough credits"
                ) : (
                  <>
                    <ArrowUpCircle className="w-4 h-4" /> Upscale Video
                  </>
                )}
              </Button>

              {error && (
                <p className="text-xs text-center text-red-400 mt-2">
                  {error}
                </p>
              )}

              {!user || hasEnoughCredits ? null : (
                <p className="text-xs text-center text-red-400">
                  You need {creditCost - (user?.creditBalance ?? 0)} more
                  credits.{" "}
                  <a
                    href="/pricing"
                    className="underline hover:text-red-300 transition-colors"
                  >
                    Buy credits
                  </a>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
