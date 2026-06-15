"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import {
  Sparkles,
  Upload,
  Play,
  Settings2,
  Wand2,
  Image as ImageIcon,
  User,
  Video,
  X,
  ChevronDown,
  ChevronUp,
  Move,
  Zap,
  Volume2,
  VolumeX,
  Link as LinkIcon,
  Clock,
  Download,
} from "lucide-react";
import {
  FUN_EFFECTS,
  FUN_EFFECT_CATEGORIES,
  type FunEffect,
} from "@/lib/motion-control";
import { uploadFile } from "@/lib/upload-client";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
import { HelpTip } from "@/components/ui/tooltip";
import { GenerationProgress, useGenerationProgress } from "@/components/ui/generation-progress";
import {
  SA_CHARACTER_PRESETS,
  SCENARIO_PRESETS,
  buildOwnerImagePrompt,
} from "@/lib/marketing-presets";

type MotionTab = "effects" | "upload" | "url";
type MotionQuality = "standard" | "pro";
type MotionModel = "kling-v3" | "kling-v2.6";

// Motion control supported durations
const MOTION_DURATIONS = [5, 10, 15, 20];

export default function MotionControlPage() {
  const { user, addJob, updateCreditBalance, isInitialized, videos } = useStore();
  const { toast } = useToast();

  const isLoading = !isInitialized;

  // Motion-specific state
  const [motionVideo, setMotionVideo] = useState<File | null>(null);
  const [motionVideoPreview, setMotionVideoPreview] = useState<string | null>(null);
  const [characterImage, setCharacterImage] = useState<File | null>(null);
  const [characterImagePreview, setCharacterImagePreview] = useState<string | null>(null);
  const [motionTab, setMotionTab] = useState<MotionTab>("effects");
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [effectCategoryFilter, setEffectCategoryFilter] = useState("All");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [characterPrompt, setCharacterPrompt] = useState("");
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const [generatedCharacters, setGeneratedCharacters] = useState<string[]>([]);
  const [characterTab, setCharacterTab] = useState<"upload" | "generate" | "history">("generate");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [characterHistory, setCharacterHistory] = useState<Array<{ imageUrl: string; prompt: string; createdAt: string }>>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Model & quality
  const [model, setModel] = useState<MotionModel>("kling-v3");
  const [quality, setQuality] = useState<MotionQuality>("standard");
  const [duration, setDuration] = useState(10);
  const [enableAudio, setEnableAudio] = useState(false);
  const [keepOriginalSound, setKeepOriginalSound] = useState(true);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [orientation, setOrientation] = useState<"video" | "image">("video");

  const motionVideoRef = useRef<HTMLInputElement>(null);
  const characterImageRef = useRef<HTMLInputElement>(null);

  const progress = useGenerationProgress();

  // Load character image history from localStorage on mount
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("gs-character-history") || "[]");
      if (stored.length > 0) {
        setCharacterHistory(stored);
        setHistoryLoaded(true);
      }
    } catch {}
  }, []);

  // Download image with branding overlay (canvas-based, instant, no server needed)
  const downloadBrandedImage = useCallback(async (imageSrc: string) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = imageSrc;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      const w = canvas.width;
      const h = canvas.height;
      const barH = Math.round(h * 0.14);

      // Semi-transparent dark gradient bar at bottom
      const gradient = ctx.createLinearGradient(0, h - barH * 1.5, 0, h);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(0.4, "rgba(0,0,0,0.6)");
      gradient.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, h - barH * 1.5, w, barH * 1.5);

      // Logo text — top left
      ctx.font = `bold ${Math.round(w * 0.035)}px 'Arial Black', Arial, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText("GENESIS STUDIO", 20, Math.round(w * 0.05));

      // Website URL — bottom right, big and cyan
      const urlSize = Math.round(w * 0.055);
      ctx.font = `bold ${urlSize}px 'Arial Black', Arial, sans-serif`;
      ctx.fillStyle = "#00BFFF";
      const urlText = "ivideostudio.ai";
      const urlWidth = ctx.measureText(urlText).width;
      ctx.fillText(urlText, w - urlWidth - 25, h - Math.round(barH * 0.25));

      // Tagline — bottom center
      const tagSize = Math.round(w * 0.038);
      ctx.font = `${tagSize}px Arial, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      const tagText = "Create AI Videos FREE";
      const tagWidth = ctx.measureText(tagText).width;
      ctx.fillText(tagText, (w - tagWidth) / 2, h - Math.round(barH * 0.65));

      // "Made with AI" small text
      ctx.font = `${Math.round(w * 0.025)}px Arial, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText("Made with AI", 20, h - Math.round(barH * 0.25));

      // Download
      const link = document.createElement("a");
      link.download = `genesis-studio-${Date.now()}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();

      toast("Branded image downloaded!", "success");
    } catch {
      toast("Failed to download image", "error");
    }
  }, [toast]);

  // isLoading already defined from isInitialized above

  // Credit cost estimation (matches server-side estimateMotionCost)
  const ratePerSec = quality === "pro" ? 0.14 : 0.07;
  const creditCost = Math.ceil(ratePerSec * duration * 400);
  const hasEnoughCredits = user?.isOwner || (user?.creditBalance ?? 0) >= creditCost;

  const filteredEffects = FUN_EFFECTS.filter(
    (e) => effectCategoryFilter === "All" || e.category === effectCategoryFilter
  );

  const handleMotionVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setError("Video file too large. Maximum size is 50MB.");
      toast("Video too large (max 50MB)", "error");
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const videoDur = Math.round(video.duration);
      if (videoDur > 30) {
        setError("Video must be 30 seconds or shorter.");
        toast("Video must be 30 seconds or shorter", "error");
        URL.revokeObjectURL(url);
        return;
      }
      setDuration(videoDur <= 7 ? 5 : videoDur <= 12 ? 10 : videoDur <= 17 ? 15 : 20);
      setMotionVideo(file);
      setSelectedEffect(null);
      setReferenceUrl("");
      setMotionVideoPreview(url);
      setError(null);
    };
    video.onerror = () => {
      setError("Could not read video file.");
      URL.revokeObjectURL(url);
    };
    video.src = url;
  };

  const handleCharacterImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("Image file too large. Maximum size is 10MB.");
      toast("Image too large (max 10MB)", "error");
      return;
    }

    setCharacterImage(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setCharacterImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleEffectSelect = (effect: FunEffect) => {
    setSelectedEffect(effect.id);
    setMotionVideo(null);
    setMotionVideoPreview(null);
    setReferenceUrl("");
  };

  const clearMotionVideo = () => {
    setMotionVideo(null);
    setMotionVideoPreview(null);
    setSelectedEffect(null);
    setReferenceUrl("");
    if (motionVideoRef.current) motionVideoRef.current.value = "";
  };

  const clearCharacterImage = () => {
    setCharacterImage(null);
    setCharacterImagePreview(null);
    setGeneratedCharacters([]);
    setCharacterPrompt("");
    if (characterImageRef.current) characterImageRef.current.value = "";
  };

  const handleGenerateCharacter = async () => {
    if (!characterPrompt.trim() || isGeneratingCharacter) return;
    setIsGeneratingCharacter(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Full body photo of ${characterPrompt.trim()}, standing in a dance-ready pose, entire body from head to feet visible, sharp focus on main character, blurred crowd and people dancing in the background, vibrant party atmosphere, bokeh background figures, main subject centered and in focus, full length shot, 8K hyperrealistic`,
          aspectRatio: "portrait",
          numImages: 4,
        }),
      });
      const data = await res.json();
      if (res.ok && data.images?.length > 0) {
        setGeneratedCharacters(data.images);
        // Save CDN URLs (not base64) to localStorage history — base64 is too large
        try {
          const cdnUrls: string[] = data.urls || [];
          if (cdnUrls.length > 0) {
            const existing = JSON.parse(localStorage.getItem("gs-character-history") || "[]");
            const newEntries = cdnUrls.map((url: string) => ({
              imageUrl: url,
              prompt: characterPrompt.trim(),
              createdAt: new Date().toISOString(),
            }));
            const updated = [...newEntries, ...existing].slice(0, 60);
            localStorage.setItem("gs-character-history", JSON.stringify(updated));
            setCharacterHistory(updated);
            setHistoryLoaded(true);
          }
        } catch {}
        toast("Character images generated! Pick one.", "success");
      } else {
        setError(data.error || "Failed to generate character");
        toast(data.error || "Generation failed", "error");
      }
    } catch {
      setError("Failed to generate character image");
      toast("Network error", "error");
    } finally {
      setIsGeneratingCharacter(false);
    }
  };

  const canGenerate =
    (motionVideo || selectedEffect || referenceUrl.trim()) &&
    (characterImage || characterImagePreview) &&
    hasEnoughCredits &&
    !isLoading;

  const uploadFileToR2 = async (file: File, purpose: "video" | "image") =>
    uploadFile(file, purpose);

  const generateLockRef = useRef(false);

  const handleGenerate = async () => {
    if (generateLockRef.current || isGenerating) return;
    generateLockRef.current = true;
    setError(null);

    if (!motionVideo && !selectedEffect && !referenceUrl.trim()) {
      setError("Upload a reference video, paste a URL, or pick a fun effect.");
      return;
    }
    if (!characterImage && !characterImagePreview) {
      setError("Please upload or generate a character image.");
      return;
    }
    if (!hasEnoughCredits) {
      setError(`Not enough credits. Need ${creditCost}, have ${user?.creditBalance ?? 0}.`);
      return;
    }

    setIsGenerating(true);
    progress.start(["Uploading files", referenceUrl ? "Downloading video" : "Applying motion reference", "Generating video", "Saving to gallery"]);
    try {
      progress.setProgress(10, "Uploading character image...");

      // Upload character image (works for both uploaded files and AI-generated images)
      let characterImageUrl: string;
      if (characterImage && characterImage.size > 0) {
        characterImageUrl = await uploadFileToR2(characterImage, "image");
      } else if (characterImagePreview?.startsWith("data:")) {
        // AI-generated base64 image — convert to File and upload to R2
        const res = await fetch(characterImagePreview);
        const blob = await res.blob();
        const file = new File([blob], "ai-character.jpg", { type: "image/jpeg" });
        characterImageUrl = await uploadFileToR2(file, "image");
      } else if (characterImagePreview) {
        // Already a URL
        characterImageUrl = characterImagePreview;
      } else {
        throw new Error("No character image");
      }

      progress.setProgress(25, "Uploading motion reference...");
      progress.advanceStep("Applying motion reference...");

      // Upload motion video if provided
      let referenceVideoUrl: string | undefined;
      if (motionVideo) {
        referenceVideoUrl = await uploadFileToR2(motionVideo, "video");
      }

      progress.setProgress(45, "Starting motion generation...");
      progress.advanceStep("Generating video...");

      const res = await fetch("/api/motion-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImageUrl,
          referenceVideoUrl,
          referenceUrl: referenceUrl.trim() || undefined,
          effect: selectedEffect || undefined,
          prompt: prompt.trim() || undefined,
          quality,
          model,
          orientation,
          duration,
          enableAudio,
          keepOriginalSound,
          seed,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addJob({
          id: data.jobId,
          userId: user?.id || "",
          status: "queued",
          type: "i2v",
          modelId: "mimic-motion",
          prompt: prompt.trim() || `Motion: ${selectedEffect || "custom"}`,
          resolution: "720p",
          duration,
          fps: 24,
          isDraft: false,
          creditsCost: data.creditsCost || creditCost,
          progress: 0,
          createdAt: new Date().toISOString(),
        });
        updateCreditBalance((user?.creditBalance ?? 0) - creditCost);
        // Don't show "complete" — the video is still generating on the server.
        // The dashboard layout poller will update progress and notify when truly done.
        progress.setProgress(60, "Generating on AI servers...");
        toast(`Motion video submitted! Est. ~${Math.ceil((data.estimatedTime || 120) / 60)} min. We'll notify you when it's ready.`, "success");
        setError(null);
      } else {
        progress.fail(data.error || "Generation failed.");
        setError(data.error || "Generation failed.");
        toast(data.error || "Generation failed", "error");
      }
    } catch (err) {
      console.error("Motion control generation failed:", err);
      progress.fail("Network error. Please try again.");
      setError("Network error. Please try again.");
      toast("Network error.", "error");
    } finally {
      setIsGenerating(false);
      generateLockRef.current = false;
    }
  };

  const selectedEffectObj = FUN_EFFECTS.find((e) => e.id === selectedEffect);

  return (
    <PageTransition className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-600/20 shrink-0">
            <Move className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">Motion Control</h1>
              <Badge className="bg-violet-500/15 text-violet-300 border border-violet-500/30 text-[10px] sm:text-xs shrink-0">
                AI Powered
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
              Apply motion effects or transfer reference motion onto any character
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
          {[
            { num: 1, label: "Motion", done: !!(motionVideo || selectedEffect || referenceUrl.trim()) },
            { num: 2, label: "Character", done: !!characterImage },
            { num: 3, label: "Generate", done: false },
          ].map((step, i) => (
            <div key={step.num} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium transition-all ${
                step.done
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "bg-white/[0.05] text-zinc-400 border border-white/[0.10]"
              }`}>
                {step.done ? (
                  <svg className="w-3 h-3 text-violet-400" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className="w-3 h-3 flex items-center justify-center text-[10px]">{step.num}</span>
                )}
                {step.label}
              </div>
              {i < 2 && <div className={`w-4 sm:w-6 h-px ${step.done ? "bg-violet-500/40" : "bg-white/[0.06]"}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Inputs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Motion Source Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Video className="w-4 h-4 text-violet-400" />
                Motion Source <HelpTip text="Choose a fun effect, upload your own video, or paste a TikTok/Instagram URL as motion reference." side="right" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabs: Fun Effects / Upload / History */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/[0.10]">
                {([
                  { key: "effects" as const, label: "Effects", icon: Sparkles },
                  { key: "upload" as const, label: "Upload", icon: Upload },
                  { key: "url" as const, label: "Paste URL", icon: LinkIcon },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setMotionTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all duration-200 ${
                      motionTab === tab.key
                        ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                        : "text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Fun Effects Tab */}
              {motionTab === "effects" && (
                <div className="space-y-3">
                  {/* Category Filter */}
                  <div className="flex gap-1.5 flex-wrap">
                    {FUN_EFFECT_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setEffectCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          effectCategoryFilter === cat
                            ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                            : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.10]"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Effects Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-2.5 max-h-[320px] sm:max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                    {filteredEffects.map((effect) => {
                      const isSelected = selectedEffect === effect.id;
                      return (
                        <button
                          key={effect.id}
                          onClick={() => handleEffectSelect(effect)}
                          className={`relative rounded-xl border p-3 text-center transition-all duration-200 group ${
                            isSelected
                              ? "border-violet-500/50 ring-2 ring-violet-500/30 bg-violet-500/10"
                              : "border-white/[0.10] hover:border-violet-500/30 bg-white/[0.04] hover:bg-white/[0.04]"
                          }`}
                        >
                          {/* Effect icon placeholder */}
                          <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2 ${
                            isSelected ? "bg-violet-500/20" : "bg-white/[0.04] group-hover:bg-white/[0.06]"
                          }`}>
                            <Sparkles className={`w-5 h-5 ${isSelected ? "text-violet-400" : "text-zinc-400 group-hover:text-zinc-400"}`} />
                          </div>
                          <div className={`text-[11px] font-medium truncate ${isSelected ? "text-violet-300" : "text-zinc-400"}`}>
                            {effect.name}
                          </div>
                          <div className="text-[9px] text-zinc-400 mt-0.5 capitalize">
                            {effect.category}
                          </div>
                          {/* Selected indicator */}
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedEffect && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <svg className="w-4 h-4 text-violet-400 shrink-0" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-xs text-violet-300">
                        Effect: <strong>{selectedEffectObj?.name}</strong>
                      </span>
                      <button
                        onClick={() => setSelectedEffect(null)}
                        className="ml-auto text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Upload Tab */}
              {motionTab === "upload" && (
                <div>
                  {motionVideoPreview && motionVideo ? (
                    <div className="relative rounded-xl overflow-hidden border border-white/[0.12] bg-black/30">
                      <video
                        src={motionVideoPreview}
                        className="w-full h-56 object-contain"
                        controls
                        muted
                        loop
                      />
                      <button
                        onClick={clearMotionVideo}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-red-500/80 text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="default" className="text-[10px] bg-black/60 backdrop-blur">
                          {motionVideo.name}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-56 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 bg-white/[0.04] hover:bg-violet-500/5 cursor-pointer transition-all duration-300 group">
                      <input
                        ref={motionVideoRef}
                        type="file"
                        accept="video/mp4,video/webm,video/mov"
                        onChange={handleMotionVideoUpload}
                        className="hidden"
                      />
                      <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-3 group-hover:bg-violet-500/20 transition-colors">
                        <Video className="w-7 h-7 text-violet-400" />
                      </div>
                      <span className="text-sm font-medium text-zinc-400 group-hover:text-violet-300 transition-colors">
                        Upload a reference video for motion transfer
                      </span>
                      <span className="text-xs text-zinc-400 mt-1">
                        MP4, WebM or MOV — up to 30 seconds, max 50MB
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* URL Tab */}
              {motionTab === "url" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">
                      Paste a TikTok, Instagram, or video URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={referenceUrl}
                        onChange={(e) => { setReferenceUrl(e.target.value); setMotionVideo(null); setMotionVideoPreview(null); setSelectedEffect(null); }}
                        placeholder="https://www.tiktok.com/@user/video/..."
                        className="flex-1 px-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                      />
                      {referenceUrl && (
                        <button onClick={() => setReferenceUrl("")} className="p-2 rounded-lg bg-white/[0.06] hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Supports TikTok, Instagram Reels, Twitter/X, Facebook, and direct video URLs
                    </p>
                  </div>
                  {referenceUrl && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <LinkIcon className="w-4 h-4 text-violet-400 shrink-0" />
                      <span className="text-xs text-violet-300 truncate">{referenceUrl}</span>
                    </div>
                  )}
                </div>
              )}

            </CardContent>
          </Card>

          {/* Character Image */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-cyan-400" />
                Character Image
              </CardTitle>
            </CardHeader>
            <CardContent>
              {characterImagePreview ? (
                <div className="space-y-2">
                  <div className="relative rounded-xl overflow-hidden border border-white/[0.12] bg-black/30">
                    <img
                      src={characterImagePreview}
                      alt="Character"
                      className="w-full h-48 object-contain"
                    />
                    <button
                      onClick={clearCharacterImage}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-red-500/80 text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Download branded version for social media */}
                  {user?.isOwner && (
                    <button
                      onClick={() => downloadBrandedImage(characterImagePreview)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-xs font-medium transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Branded (for social media)
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Tabs: AI Generate / Upload / History */}
                  <div className="flex gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/[0.10]">
                    {([
                      { key: "generate" as const, label: "AI Generate", icon: Wand2 },
                      { key: "upload" as const, label: "Upload", icon: Upload },
                      { key: "history" as const, label: "History", icon: Clock },
                    ]).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => {
                          setCharacterTab(tab.key);
                          if (tab.key === "history" && !historyLoaded) {
                            try {
                              const stored = JSON.parse(localStorage.getItem("gs-character-history") || "[]");
                              setCharacterHistory(stored);
                            } catch {}
                            setHistoryLoaded(true);
                          }
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all duration-200 ${
                          characterTab === tab.key
                            ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                            : "text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                        }`}
                      >
                        <tab.icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* AI Generate Tab */}
                  {characterTab === "generate" && (
                    <div className="space-y-3">
                      {/* Smart Presets (owner only) */}
                      {user?.isOwner && (
                        <>
                          <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Quick Presets</label>
                          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                            {SA_CHARACTER_PRESETS.map((preset) => (
                              <button
                                key={preset.id}
                                onClick={() => {
                                  setSelectedPreset(preset.id);
                                  setCharacterPrompt(preset.name);
                                }}
                                className={`p-2 rounded-lg border text-center transition-all ${
                                  selectedPreset === preset.id
                                    ? "border-cyan-500/50 bg-cyan-500/10 ring-1 ring-cyan-500/20"
                                    : "border-white/[0.08] bg-white/[0.03] hover:border-cyan-500/30"
                                }`}
                              >
                                <div className={`text-[10px] font-medium truncate ${selectedPreset === preset.id ? "text-cyan-300" : "text-zinc-400"}`}>
                                  {preset.name}
                                </div>
                              </button>
                            ))}
                          </div>

                          {/* Scenario selector */}
                          {selectedPreset && (
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Scene / Vibe</label>
                              <div className="flex gap-1.5 flex-wrap max-h-[120px] overflow-y-auto custom-scrollbar">
                                <button
                                  onClick={() => setSelectedScenario(null)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                                    !selectedScenario
                                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                      : "bg-white/[0.04] text-zinc-400 border border-white/[0.08] hover:border-cyan-500/20"
                                  }`}
                                >
                                  Standing (Default)
                                </button>
                                {SCENARIO_PRESETS.map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={() => setSelectedScenario(s.id)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                                      selectedScenario === s.id
                                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                        : "bg-white/[0.04] text-zinc-400 border border-white/[0.08] hover:border-cyan-500/20"
                                    }`}
                                  >
                                    {s.emoji} {s.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="relative">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.08]" /></div>
                            <div className="relative flex justify-center"><span className="bg-[#0f0f17] px-3 text-[10px] text-zinc-500">or type your own</span></div>
                          </div>
                        </>
                      )}

                      {/* Custom prompt input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={characterPrompt}
                          onChange={(e) => { setCharacterPrompt(e.target.value); setSelectedPreset(null); setSelectedScenario(null); }}
                          placeholder="e.g. Cute baby in a red dress ready to dance"
                          className="flex-1 px-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                        />
                        <Button
                          onClick={() => {
                            if (selectedPreset) {
                              const preset = SA_CHARACTER_PRESETS.find(p => p.id === selectedPreset);
                              const scenario = selectedScenario ? SCENARIO_PRESETS.find(s => s.id === selectedScenario) : null;
                              if (preset) {
                                const fullPrompt = scenario
                                  ? buildOwnerImagePrompt(preset, scenario)
                                  : preset.prompt;
                                setCharacterPrompt(preset.name);
                                setIsGeneratingCharacter(true);
                                setError(null);
                                fetch("/api/generate-image", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ prompt: fullPrompt, aspectRatio: "portrait", numImages: 4 }),
                                })
                                  .then(r => r.json())
                                  .then(data => {
                                    if (data.images?.length > 0) {
                                      setGeneratedCharacters(data.images);
                                      toast("Character images generated! Pick one.", "success");
                                    } else {
                                      setError(data.error || "Failed to generate");
                                      toast(data.error || "Generation failed", "error");
                                    }
                                  })
                                  .catch(() => { setError("Network error"); toast("Network error", "error"); })
                                  .finally(() => setIsGeneratingCharacter(false));
                                return;
                              }
                            }
                            handleGenerateCharacter();
                          }}
                          disabled={(!characterPrompt.trim() && !selectedPreset) || isGeneratingCharacter}
                          loading={isGeneratingCharacter}
                          className="shrink-0 bg-cyan-600 hover:bg-cyan-500 text-white px-4"
                          size="sm"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {/* Generated options */}
                      {generatedCharacters.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {generatedCharacters.map((imgSrc, i) => (
                            <div key={i} className="relative group">
                              <button
                                onClick={async () => {
                              setCharacterImagePreview(imgSrc);
                              // Convert base64/URL to a real File and upload to R2
                              try {
                                const res = await fetch(imgSrc);
                                const blob = await res.blob();
                                const file = new File([blob], `ai-character-${i + 1}.jpg`, { type: blob.type || "image/jpeg" });
                                setCharacterImage(file);
                              } catch {
                                // Fallback: create empty file marker, generate handler will use preview URL
                                setCharacterImage(new File([], "ai-generated.jpg"));
                              }
                            }}
                                className="w-full aspect-[3/4] rounded-lg border border-white/[0.10] hover:border-cyan-500/40 overflow-hidden transition-all"
                              >
                                <img src={imgSrc} alt={`Option ${i + 1}`} className="w-full h-full object-cover" />
                              </button>
                              {user?.isOwner && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); downloadBrandedImage(imgSrc); }}
                                  className="absolute bottom-1 right-1 p-1 rounded bg-black/70 hover:bg-cyan-600 text-white opacity-0 group-hover:opacity-100 transition-all"
                                  title="Download branded"
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upload Tab */}
                  {characterTab === "upload" && (
                    <label className="flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed border-white/10 hover:border-cyan-500/40 bg-white/[0.04] hover:bg-cyan-500/5 cursor-pointer transition-all duration-300 group">
                      <input
                        ref={characterImageRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleCharacterImageUpload}
                        className="hidden"
                      />
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-2 group-hover:bg-cyan-500/20 transition-colors">
                        <Upload className="w-5 h-5 text-cyan-400" />
                      </div>
                      <span className="text-xs font-medium text-zinc-400 group-hover:text-cyan-300 transition-colors">Upload your photo</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5">Full body photo — PNG, JPG or WebP up to 10MB</span>
                    </label>
                  )}

                  {/* History Tab */}
                  {characterTab === "history" && (
                    <div>
                      {characterHistory.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                          {characterHistory.map((item, i) => (
                            <button
                              key={i}
                              onClick={async () => {
                                try {
                                  const imgRes = await fetch(item.imageUrl);
                                  if (!imgRes.ok) { toast("Image no longer available", "error"); return; }
                                  const buffer = await imgRes.arrayBuffer();
                                  const blob = new Blob([buffer], { type: "image/jpeg" });
                                  const dataUrl = URL.createObjectURL(blob);
                                  setCharacterImagePreview(dataUrl);
                                  setCharacterImage(new File([blob], "history.jpg", { type: "image/jpeg" }));
                                  toast("Image selected from history", "success");
                                } catch {
                                  toast("Failed to load image", "error");
                                }
                              }}
                              className="aspect-[3/4] rounded-lg border border-white/[0.10] hover:border-cyan-500/40 overflow-hidden transition-all group"
                              title={new Date(item.createdAt).toLocaleDateString()}
                            >
                              <img src={item.imageUrl} alt="History" className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-36 text-center">
                          <Clock className="w-8 h-8 text-zinc-600 mb-2" />
                          <span className="text-xs text-zinc-500">No images yet</span>
                          <span className="text-[10px] text-zinc-600 mt-1">Generate images and they'll appear here</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prompt (Optional) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wand2 className="w-4 h-4 text-violet-400" />
                Description
                <span className="text-[10px] font-normal text-zinc-400 bg-white/[0.04] px-1.5 py-0.5 rounded">Optional</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Optionally describe the scene... e.g., 'Cinematic lighting, flowing dress, sunlit garden'"
                value={prompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                className="min-h-[80px] bg-white/[0.05] border-white/[0.12] focus:border-violet-500/50 resize-none"
              />
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>{prompt.length} characters</span>
                <span>Adds detail to the generated output</span>
              </div>
            </CardContent>
          </Card>

          {/* Parameters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-zinc-400" />
                  Settings
                </div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
                >
                  Advanced
                  {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quality */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Quality</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: "standard" as const, label: "Standard", desc: "Fast & balanced" },
                    { value: "pro" as const, label: "Pro", desc: "Higher fidelity" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setQuality(opt.value)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        quality === opt.value
                          ? "border-violet-500/40 bg-violet-500/10 ring-1 ring-violet-500/20"
                          : "border-white/[0.10] bg-white/[0.04] hover:border-white/[0.12]"
                      }`}
                    >
                      <div className={`text-sm font-medium ${quality === opt.value ? "text-violet-300" : "text-zinc-300"}`}>
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Duration</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.12] text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
                  >
                    {MOTION_DURATIONS.map((d) => (
                      <option key={d} value={d}>{d}s</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Orientation</label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as "video" | "image")}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.12] text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
                  >
                    <option value="video">Match Video</option>
                    <option value="image">Match Image</option>
                  </select>
                </div>
              </div>

              {/* Audio */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Audio</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "none", label: "No Audio", icon: VolumeX, desc: "Silent video" },
                    { value: "generate", label: "AI Audio", icon: Volume2, desc: "Generate sounds" },
                    { value: "keep", label: "Keep Original", icon: Volume2, desc: "From reference" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setEnableAudio(opt.value === "generate");
                        setKeepOriginalSound(opt.value === "keep");
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        (opt.value === "none" && !enableAudio && !keepOriginalSound) ||
                        (opt.value === "generate" && enableAudio) ||
                        (opt.value === "keep" && keepOriginalSound)
                          ? "border-violet-500/40 bg-violet-500/10 ring-1 ring-violet-500/20"
                          : "border-white/[0.10] bg-white/[0.04] hover:border-white/[0.12]"
                      }`}
                    >
                      <opt.icon className={`w-4 h-4 mx-auto mb-1 ${
                        (opt.value === "none" && !enableAudio && !keepOriginalSound) ||
                        (opt.value === "generate" && enableAudio) ||
                        (opt.value === "keep" && keepOriginalSound)
                          ? "text-violet-400" : "text-zinc-400"
                      }`} />
                      <div className={`text-[11px] font-medium ${
                        (opt.value === "none" && !enableAudio && !keepOriginalSound) ||
                        (opt.value === "generate" && enableAudio) ||
                        (opt.value === "keep" && keepOriginalSound)
                          ? "text-violet-300" : "text-zinc-400"
                      }`}>{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="space-y-3 pt-3 border-t border-white/[0.10]">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Seed (leave empty for random)</label>
                    <input
                      type="number"
                      value={seed ?? ""}
                      onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="Random"
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.12] text-sm text-zinc-200 placeholder:text-zinc-400 focus:border-violet-500/50 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary & Generate — hidden on mobile */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            {/* Preview Card */}
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-br from-violet-950/50 via-zinc-900 to-fuchsia-950/30 relative">
                <div className="grid grid-cols-2 gap-0.5">
                  {/* Motion preview */}
                  <div className="aspect-square bg-black/40 flex items-center justify-center relative">
                    {motionVideoPreview ? (
                      <video
                        src={motionVideoPreview}
                        className="w-full h-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    ) : selectedEffect ? (
                      <div className="text-center p-2">
                        <Sparkles className="w-8 h-8 text-violet-400 mx-auto mb-1" />
                        <p className="text-[10px] text-violet-300 font-medium">{selectedEffectObj?.name}</p>
                      </div>
                    ) : referenceUrl.trim() ? (
                      <div className="text-center p-2">
                        <LinkIcon className="w-8 h-8 text-violet-400 mx-auto mb-1" />
                        <p className="text-[10px] text-violet-300 font-medium truncate px-1">URL Video</p>
                      </div>
                    ) : (
                      <div className="text-center p-2">
                        <Video className="w-6 h-6 text-zinc-400 mx-auto mb-1" />
                        <p className="text-[10px] text-zinc-400">Motion</p>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1">
                      <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] text-violet-300 font-medium">
                        {selectedEffect ? "Effect" : "Motion"}
                      </span>
                    </div>
                  </div>
                  {/* Character preview */}
                  <div className="aspect-square bg-black/40 flex items-center justify-center relative">
                    {characterImagePreview ? (
                      <img
                        src={characterImagePreview}
                        alt="Character"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-2">
                        <User className="w-6 h-6 text-zinc-400 mx-auto mb-1" />
                        <p className="text-[10px] text-zinc-400">Character</p>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1">
                      <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] text-cyan-300 font-medium">
                        Character
                      </span>
                    </div>
                  </div>
                </div>
                {/* Ready badge */}
                {(motionVideo || selectedEffect || referenceUrl.trim()) && characterImagePreview && (
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-violet-500/90 text-white text-[10px] shadow-lg">
                      Ready to Generate
                    </Badge>
                  </div>
                )}
                {/* Plus indicator */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-zinc-900/80 border border-white/10 flex items-center justify-center z-10">
                  <span className="text-[10px] text-zinc-400">+</span>
                </div>
              </div>
            </Card>

            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Generation Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Type</span>
                    <span className="text-zinc-300">Motion Control</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Quality</span>
                    <span className="text-zinc-300">
                      {quality === "pro" ? "Pro" : "Standard"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Motion</span>
                    <span className="text-zinc-300 truncate max-w-[140px]">
                      {selectedEffect
                        ? selectedEffectObj?.name
                        : motionVideo
                        ? motionVideo.name
                        : referenceUrl.trim()
                        ? "URL Import"
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Character</span>
                    <span className="text-zinc-300">
                      {characterImage && characterImage.size > 0 ? "Uploaded" : characterImagePreview ? "AI Generated" : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Duration</span>
                    <span className="text-zinc-300">{duration}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Audio</span>
                    <span className={enableAudio || keepOriginalSound ? "text-violet-300" : "text-zinc-400"}>
                      {enableAudio ? "AI Generated" : keepOriginalSound ? "Original" : "Off"}
                    </span>
                  </div>
                </div>

                <div className="border-t border-white/[0.10] pt-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-zinc-400">Estimated Cost</span>
                    <span className="text-sm font-bold text-violet-300">
                      {creditCost} credits
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-zinc-400">Est. Time</span>
                    <span className="text-xs text-zinc-400">
                      ~{Math.ceil(duration * 12 / 60)} min
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-400">Balance</span>
                    <span className={`text-sm font-medium ${
                      hasEnoughCredits ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {`${user?.creditBalance?.toLocaleString() ?? "—"} credits`}
                    </span>
                  </div>
                </div>

                {error && !progress.isActive && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    {error}
                  </div>
                )}

                {(progress.isActive || progress.percent > 0) && (
                  <GenerationProgress
                    steps={progress.steps}
                    percent={progress.percent}
                    stageMessage={progress.stageMessage}
                    showTimer
                    timerActive={progress.isActive}
                    compact
                  />
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                  loading={isGenerating}
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-violet-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {isGenerating ? "Generating..." : <><Zap className="w-4 h-4" /> Generate Motion</>}
                </Button>

                {!hasEnoughCredits && !user?.isOwner && (
                  <p className="text-[11px] text-center text-zinc-400">
                    Need more credits?{" "}
                    <a href="/pricing" className="text-violet-400 hover:underline">
                      Upgrade your plan
                    </a>
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Recent Creations */}
      {videos.filter(v => v.modelId === "mimic-motion").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-zinc-400" />
              Recent Creations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
              {videos.filter(v => v.modelId === "mimic-motion").slice(0, 8).map((vid) => (
                <div key={vid.id} className="shrink-0 w-40 rounded-xl border border-white/[0.10] bg-white/[0.04] overflow-hidden group">
                  <div className="aspect-video bg-black/40 relative">
                    {vid.thumbnailUrl ? (
                      <img src={vid.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-zinc-500" />
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1">
                      <span className="px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-zinc-300">{vid.duration}s</span>
                    </div>
                  </div>
                  <div className="p-2 space-y-1.5">
                    <p className="text-[11px] text-zinc-300 line-clamp-2 leading-tight">{vid.prompt?.slice(0, 60) || "Motion video"}</p>
                    <p className="text-[9px] text-zinc-500">{new Date(vid.createdAt).toLocaleDateString()}</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setPrompt(vid.prompt || ""); toast("Prompt loaded from history", "success"); }}
                        className="flex-1 px-2 py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-[10px] text-violet-300 font-medium transition-colors"
                      >
                        Recreate
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mobile progress tracker */}
      {(progress.isActive || progress.percent > 0) && (
        <div className="lg:hidden">
          <GenerationProgress
            steps={progress.steps}
            percent={progress.percent}
            stageMessage={progress.stageMessage}
            showTimer
            timerActive={progress.isActive}
          />
        </div>
      )}

      {/* Mobile: Fixed Generate button at bottom */}
      <MobileActionBar>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <Zap className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-sm font-bold text-violet-300">{creditCost}</span>
            <span className="text-xs text-zinc-400">credits</span>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            loading={isGenerating}
            className="flex-1 max-w-[200px] bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
          >
            {isGenerating ? "Generating..." : (
              <><Zap className="w-4 h-4" /> Generate</>
            )}
          </Button>
        </div>
      </MobileActionBar>

      {/* Spacer for mobile action bar */}
      <div className="h-20 lg:hidden" />
    </PageTransition>
  );
}
