"use client";

import { useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { ComingSoonGate } from "@/components/ui/coming-soon";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
import {
  Captions,
  Upload,
  Link2,
  Zap,
  Download,
  Film,
  Loader2,
  ChevronDown,
  Type,
  Sparkles,
  Clock,
  Globe,
} from "lucide-react";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "hi", label: "Hindi" },
  { value: "ar", label: "Arabic" },
  { value: "ru", label: "Russian" },
  { value: "nl", label: "Dutch" },
  { value: "tr", label: "Turkish" },
  { value: "pl", label: "Polish" },
];

const CAPTION_STYLES = [
  {
    value: "tiktok",
    label: "TikTok",
    desc: "Word-by-word highlight, bold & punchy",
    icon: Type,
  },
  {
    value: "youtube",
    label: "YouTube",
    desc: "Classic bottom bar subtitles",
    icon: Captions,
  },
  {
    value: "cinematic",
    label: "Cinematic",
    desc: "Elegant fade-in/out captions",
    icon: Film,
  },
  {
    value: "srt_only",
    label: "SRT Only",
    desc: "Download raw subtitle file",
    icon: Download,
  },
];

const CREDITS_PER_MINUTE = 2;

export default function CaptionsPage() {
  const { user, videos, updateCreditBalance, setCreditPurchaseOpen } = useStore();
  const { toast } = useToast();

  // Input state
  const [inputMode, setInputMode] = useState<"upload" | "url" | "gallery">("url");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [language, setLanguage] = useState("en");
  const [captionStyle, setCaptionStyle] = useState("tiktok");
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [srtContent, setSrtContent] = useState<string | null>(null);

  // Double-click protection
  const generateLockRef = useRef(false);

  const isLoading = !user;

  // Credit cost calculation
  const durationMinutes = videoDuration ? Math.ceil(videoDuration / 60) : 0;
  const creditCost = Math.max(durationMinutes * CREDITS_PER_MINUTE, videoDuration ? CREDITS_PER_MINUTE : 0);
  const hasEnoughCredits = user?.isOwner || (user?.creditBalance ?? 0) >= creditCost;

  const resolvedVideoUrl = (() => {
    if (inputMode === "url") return videoUrl.trim();
    if (inputMode === "gallery" && selectedVideoId) {
      const vid = videos.find((v) => v.id === selectedVideoId);
      return vid?.url || "";
    }
    return "";
  })();

  const canGenerate =
    (inputMode === "upload" ? !!videoFile : !!resolvedVideoUrl) &&
    !isProcessing &&
    !isLoading &&
    hasEnoughCredits;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);

    // Extract duration from video
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setVideoDuration(Math.ceil(video.duration));
      URL.revokeObjectURL(url);
    };
    video.src = url;
  };

  const handleUrlChange = (url: string) => {
    setVideoUrl(url);
    // Reset duration estimate — user can see cost once they input a URL
    if (!url.trim()) {
      setVideoDuration(null);
    } else {
      // Default estimate: 60s for URL-based videos (server will calculate exact)
      setVideoDuration(60);
    }
  };

  const handleGallerySelect = (videoId: string) => {
    setSelectedVideoId(videoId);
    const vid = videos.find((v) => v.id === videoId);
    if (vid) {
      setVideoDuration(vid.duration);
    }
  };

  const handleGenerate = async () => {
    if (generateLockRef.current) return;
    generateLockRef.current = true;

    setError(null);
    setSrtContent(null);

    let targetUrl = resolvedVideoUrl;

    // For file upload, we need to upload first
    if (inputMode === "upload" && videoFile) {
      try {
        const formData = new FormData();
        formData.append("file", videoFile);
        formData.append("purpose", "video");
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const { publicUrl } = await uploadRes.json();
        targetUrl = publicUrl;
      } catch {
        setError("Failed to upload video. Please try again.");
        generateLockRef.current = false;
        return;
      }
    }

    if (!targetUrl) {
      setError("Please provide a video URL or upload a video.");
      generateLockRef.current = false;
      return;
    }

    setIsProcessing(true);
    setProgress(10);

    try {
      const res = await fetch("/api/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: targetUrl,
          language,
          style: captionStyle,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Caption generation failed.");
        toast(data.error || "Caption generation failed", "error");
        setIsProcessing(false);
        generateLockRef.current = false;
        return;
      }

      setJobId(data.jobId);
      updateCreditBalance((user?.creditBalance ?? 0) - creditCost);
      toast("Caption generation started!", "success");

      // Simulate progress while processing
      let currentProgress = 10;
      const interval = setInterval(() => {
        currentProgress += Math.random() * 15;
        if (currentProgress >= 90) {
          currentProgress = 90;
          clearInterval(interval);
        }
        setProgress(Math.round(currentProgress));
      }, 2000);

      // Poll for completion (simplified — in production, use webhooks)
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/captions/${data.jobId}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.status === "completed" && statusData.output?.srt) {
              clearInterval(pollInterval);
              clearInterval(interval);
              setProgress(100);
              setSrtContent(statusData.output.srt);
              setIsProcessing(false);
              toast("Captions generated successfully!", "success");
            } else if (statusData.status === "failed") {
              clearInterval(pollInterval);
              clearInterval(interval);
              setError(statusData.errorMessage || "Caption generation failed.");
              setIsProcessing(false);
            }
          }
        } catch {
          // Ignore polling errors
        }
      }, 5000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        clearInterval(interval);
        if (isProcessing) {
          setIsProcessing(false);
          setProgress(0);
          setError("Processing timed out. Your job may still complete — check back later.");
        }
      }, 300000);
    } catch (err) {
      console.error("Caption generation failed:", err);
      setError("Network error. Please check your connection and try again.");
      toast("Network error. Please try again.", "error");
      setIsProcessing(false);
    } finally {
      generateLockRef.current = false;
    }
  };

  const handleDownloadSrt = () => {
    if (!srtContent) return;
    const blob = new Blob([srtContent], { type: "text/srt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "captions.srt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ComingSoonGate featureId="captions" featureName="Auto Captions">
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Auto Captions</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Generate accurate captions and subtitles for your videos using AI speech recognition.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Controls */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Source */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <Film className="w-4 h-4 text-violet-400" />
                Video Source
              </label>

              {/* Input Mode Tabs */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "url" as const, label: "Paste URL", icon: Link2 },
                  { value: "upload" as const, label: "Upload", icon: Upload },
                  { value: "gallery" as const, label: "My Videos", icon: Film },
                ] as const).map((mode) => {
                  const isActive = inputMode === mode.value;
                  return (
                    <button
                      key={mode.value}
                      onClick={() => setInputMode(mode.value)}
                      className={`p-3 rounded-xl border text-center transition-all duration-200 press-effect ${
                        isActive
                          ? "border-violet-500/40 bg-violet-500/10 shadow-lg shadow-violet-500/5"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                      }`}
                    >
                      <mode.icon
                        className={`w-5 h-5 mx-auto mb-1.5 ${
                          isActive ? "text-violet-400" : "text-zinc-500"
                        }`}
                      />
                      <div
                        className={`text-sm font-medium ${
                          isActive ? "text-violet-300" : "text-zinc-300"
                        }`}
                      >
                        {mode.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* URL Input */}
              {inputMode === "url" && (
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="Paste your video URL here"
                    value={videoUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all duration-200"
                  />
                  <p className="text-xs text-zinc-600">
                    Direct link to an MP4, MOV, or WEBM file
                  </p>
                </div>
              )}

              {/* File Upload */}
              {inputMode === "upload" && (
                <div>
                  {videoFile ? (
                    <div className="flex items-center justify-between p-3 rounded-xl border border-white/[0.08] bg-white/[0.03]">
                      <div className="flex items-center gap-3">
                        <Film className="w-5 h-5 text-violet-400" />
                        <div>
                          <p className="text-sm text-zinc-200 truncate max-w-[300px]">
                            {videoFile.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                            {videoDuration ? ` / ${videoDuration}s` : ""}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setVideoFile(null);
                          setVideoDuration(null);
                        }}
                        className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-10 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-violet-500/30 cursor-pointer transition-colors bg-white/[0.01]">
                      <Upload className="w-8 h-8 text-zinc-600 mb-3" />
                      <span className="text-sm text-zinc-400">
                        Click or drag to upload a video
                      </span>
                      <span className="text-xs text-zinc-600 mt-1">
                        MP4, MOV, WEBM up to 500MB
                      </span>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Gallery Dropdown */}
              {inputMode === "gallery" && (
                <div className="space-y-2">
                  {videos.length > 0 ? (
                    <Select
                      value={selectedVideoId}
                      onChange={(v) => handleGallerySelect(v)}
                      options={videos.map((v) => ({
                        value: v.id,
                        label: `${v.title || v.prompt.slice(0, 50)} (${v.duration}s)`,
                      }))}
                      placeholder="Select a video from your gallery"
                    />
                  ) : (
                    <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] text-center">
                      <Film className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                      <p className="text-sm text-zinc-400">No videos in your gallery yet</p>
                      <p className="text-xs text-zinc-600 mt-1">
                        Generate a video first or paste a URL above
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Language Selection */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <Globe className="w-4 h-4 text-violet-400" />
                Language
              </label>
              <Select
                value={language}
                onChange={(v) => setLanguage(v)}
                options={LANGUAGES}
              />
              <p className="text-xs text-zinc-600">
                Select the primary spoken language in your video
              </p>
            </CardContent>
          </Card>

          {/* Caption Style */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <Type className="w-4 h-4 text-violet-400" />
                Caption Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CAPTION_STYLES.map((style) => {
                  const isActive = captionStyle === style.value;
                  return (
                    <button
                      key={style.value}
                      onClick={() => setCaptionStyle(style.value)}
                      className={`p-3 rounded-xl border text-left transition-all duration-200 press-effect ${
                        isActive
                          ? "border-violet-500/40 bg-violet-500/10 shadow-lg shadow-violet-500/5"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                      }`}
                    >
                      <style.icon
                        className={`w-5 h-5 mb-1.5 ${
                          isActive ? "text-violet-400" : "text-zinc-500"
                        }`}
                      />
                      <div
                        className={`text-sm font-medium ${
                          isActive ? "text-violet-300" : "text-zinc-300"
                        }`}
                      >
                        {style.label}
                      </div>
                      <div className="text-xs text-zinc-500">{style.desc}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* SRT Result */}
          {srtContent && (
            <Card glow>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Captions className="w-4 h-4 text-violet-400" />
                  Generated Captions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={srtContent}
                  onChange={() => {}}
                  rows={12}
                  className="font-mono text-xs"
                  readOnly
                />
                <div className="flex gap-2">
                  <Button onClick={handleDownloadSrt} className="flex-1">
                    <Download className="w-4 h-4" /> Download SRT
                  </Button>
                  <Button variant="ghost" disabled className="flex-1 relative">
                    <Sparkles className="w-4 h-4" /> Burn into Video
                    <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-violet-500/20 text-[10px] text-violet-300 border border-violet-500/30">
                      Soon
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Summary & Generate — hidden on mobile, shown as sticky card on desktop */}
        <div className="hidden lg:block space-y-4">
          <Card glow className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Caption Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Source</span>
                  <span className="text-zinc-200 capitalize">{inputMode}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Language</span>
                  <span className="text-zinc-200">
                    {LANGUAGES.find((l) => l.value === language)?.label}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Style</span>
                  <span className="text-zinc-200">
                    {CAPTION_STYLES.find((s) => s.value === captionStyle)?.label}
                  </span>
                </div>
                {videoDuration && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Duration</span>
                    <span className="text-zinc-200 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      {Math.floor(videoDuration / 60)}m {videoDuration % 60}s
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Est. Time</span>
                  <span className="text-zinc-200">~30s</span>
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-zinc-300">Cost</span>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-violet-400" />
                    <span className="text-xl font-bold text-violet-300">
                      {creditCost || "~2"}
                    </span>
                    <span className="text-xs text-zinc-500">credits</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 mt-1">
                  {CREDITS_PER_MINUTE} credits per minute of video
                </p>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-zinc-500">Your balance</span>
                  <span
                    className={`text-xs font-semibold ${
                      hasEnoughCredits ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {`${user?.creditBalance?.toLocaleString() ?? 0} credits`}
                  </span>
                </div>
              </div>

              {/* Progress */}
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                    <span className="text-sm text-zinc-300">Processing captions...</span>
                  </div>
                  <Progress value={progress} />
                  <p className="text-xs text-zinc-500 text-center">{progress}%</p>
                </div>
              )}

              <Button
                className="w-full shadow-lg shadow-violet-600/20"
                size="lg"
                disabled={!canGenerate}
                loading={isProcessing}
                onClick={handleGenerate}
              >
                {isProcessing ? (
                  "Generating Captions..."
                ) : isLoading ? (
                  "Loading..."
                ) : !hasEnoughCredits && videoDuration ? (
                  "Not enough credits"
                ) : (
                  <>
                    <Captions className="w-4 h-4" /> Generate Captions
                  </>
                )}
              </Button>

              {error && (
                <p className="text-xs text-center text-red-400 mt-2">{error}</p>
              )}

              {!isLoading && !hasEnoughCredits && videoDuration && !error && (
                <p className="text-xs text-center text-red-400">
                  You need {creditCost - (user?.creditBalance ?? 0)} more credits.{" "}
                  <button
                    onClick={() => setCreditPurchaseOpen(true)}
                    className="underline hover:text-red-300 transition-colors"
                  >
                    Buy credits
                  </button>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile: Fixed Generate button at bottom */}
      <MobileActionBar>
        <Button
          className="w-full shadow-lg shadow-violet-600/20"
          disabled={!canGenerate}
          loading={isProcessing}
          onClick={handleGenerate}
        >
          {isProcessing ? (
            "Generating Captions..."
          ) : isLoading ? (
            "Loading..."
          ) : !hasEnoughCredits && videoDuration ? (
            "Not enough credits"
          ) : (
            <>
              <Captions className="w-4 h-4" /> Generate Captions
            </>
          )}
        </Button>
      </MobileActionBar>

      {/* Spacer for mobile action bar */}
      <div className="h-20 lg:hidden" />
    </PageTransition>
    </ComingSoonGate>
  );
}
