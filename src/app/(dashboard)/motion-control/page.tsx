"use client";

import { useState, useRef } from "react";
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
  Clock,
  Move,
  Zap,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  FUN_EFFECTS,
  FUN_EFFECT_CATEGORIES,
  type FunEffect,
} from "@/lib/motion-control";
import { uploadFile } from "@/lib/upload-client";
import { Switch } from "@/components/ui/switch";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";

type MotionTab = "upload" | "effects" | "history";
type MotionQuality = "standard" | "pro";
type MotionModel = "kling-v3" | "kling-v2.6";

// Motion control supports 5s or 10s
const MOTION_DURATIONS = [5, 10];

export default function MotionControlPage() {
  const { user, addJob, updateCreditBalance } = useStore();
  const { toast } = useToast();

  // Motion-specific state
  const [motionVideo, setMotionVideo] = useState<File | null>(null);
  const [motionVideoPreview, setMotionVideoPreview] = useState<string | null>(null);
  const [characterImage, setCharacterImage] = useState<File | null>(null);
  const [characterImagePreview, setCharacterImagePreview] = useState<string | null>(null);
  const [motionTab, setMotionTab] = useState<MotionTab>("effects");
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [effectCategoryFilter, setEffectCategoryFilter] = useState("All");
  const [prompt, setPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Model & quality
  const [model, setModel] = useState<MotionModel>("kling-v3");
  const [quality, setQuality] = useState<MotionQuality>("standard");
  const [duration, setDuration] = useState(5);
  const [enableAudio, setEnableAudio] = useState(false);
  const [keepOriginalSound, setKeepOriginalSound] = useState(false);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [orientation, setOrientation] = useState<"video" | "image">("video");

  const motionVideoRef = useRef<HTMLInputElement>(null);
  const characterImageRef = useRef<HTMLInputElement>(null);

  const isLoading = !user;

  // Credit cost estimation (matches server-side estimateMotionCost)
  const ratePerSec = quality === "pro" ? 0.14 : 0.07;
  const creditCost = Math.ceil(ratePerSec * duration * 300);
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
      setDuration(videoDur <= 7 ? 5 : 10);
      setMotionVideo(file);
      setSelectedEffect(null);
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
  };

  const clearMotionVideo = () => {
    setMotionVideo(null);
    setMotionVideoPreview(null);
    setSelectedEffect(null);
    if (motionVideoRef.current) motionVideoRef.current.value = "";
  };

  const clearCharacterImage = () => {
    setCharacterImage(null);
    setCharacterImagePreview(null);
    if (characterImageRef.current) characterImageRef.current.value = "";
  };

  const canGenerate =
    (motionVideo || selectedEffect) &&
    characterImage &&
    hasEnoughCredits &&
    !isLoading;

  const uploadFileToR2 = async (file: File, purpose: "video" | "image") =>
    uploadFile(file, purpose);

  const generateLockRef = useRef(false);

  const handleGenerate = async () => {
    if (generateLockRef.current || isGenerating) return;
    generateLockRef.current = true;
    setError(null);

    if (!motionVideo && !selectedEffect) {
      setError("Upload a reference video or pick a fun effect.");
      return;
    }
    if (!characterImage) {
      setError("Please upload a character image.");
      return;
    }
    if (!hasEnoughCredits) {
      setError(`Not enough credits. Need ${creditCost}, have ${user?.creditBalance ?? 0}.`);
      return;
    }

    setIsGenerating(true);
    try {
      toast("Uploading files...", "info");

      // Upload character image
      const characterImageUrl = await uploadFileToR2(characterImage, "image");

      // Upload motion video if provided
      let referenceVideoUrl: string | undefined;
      if (motionVideo) {
        referenceVideoUrl = await uploadFileToR2(motionVideo, "video");
      }

      toast("Starting motion control...", "info");

      const res = await fetch("/api/motion-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImageUrl,
          referenceVideoUrl,
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
        toast("Motion control started! Check your gallery.", "success");
        setError(null);
      } else {
        setError(data.error || "Generation failed.");
        toast(data.error || "Generation failed", "error");
      }
    } catch (err) {
      console.error("Motion control generation failed:", err);
      setError("Network error. Please try again.");
      toast("Network error.", "error");
    } finally {
      setIsGenerating(false);
      generateLockRef.current = false;
    }
  };

  const selectedEffectObj = FUN_EFFECTS.find((e) => e.id === selectedEffect);

  return (
    <PageTransition className="space-y-6">
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
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
              Apply motion effects or transfer reference motion onto any character
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
          {[
            { num: 1, label: "Motion", done: !!(motionVideo || selectedEffect) },
            { num: 2, label: "Character", done: !!characterImage },
            { num: 3, label: "Generate", done: false },
          ].map((step, i) => (
            <div key={step.num} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium transition-all ${
                step.done
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "bg-white/[0.03] text-zinc-600 border border-white/[0.06]"
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
                Motion Source
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabs: Fun Effects / Upload / History */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                {([
                  { key: "effects" as const, label: "Effects", icon: Sparkles },
                  { key: "upload" as const, label: "Upload", icon: Upload },
                  { key: "history" as const, label: "History", icon: Clock },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setMotionTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all duration-200 ${
                      motionTab === tab.key
                        ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
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
                            : "bg-white/[0.03] text-zinc-500 hover:text-zinc-300 border border-white/[0.06]"
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
                              : "border-white/[0.06] hover:border-violet-500/30 bg-white/[0.02] hover:bg-white/[0.04]"
                          }`}
                        >
                          {/* Effect icon placeholder */}
                          <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2 ${
                            isSelected ? "bg-violet-500/20" : "bg-white/[0.04] group-hover:bg-white/[0.06]"
                          }`}>
                            <Sparkles className={`w-5 h-5 ${isSelected ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                          </div>
                          <div className={`text-[11px] font-medium truncate ${isSelected ? "text-violet-300" : "text-zinc-400"}`}>
                            {effect.name}
                          </div>
                          <div className="text-[9px] text-zinc-600 mt-0.5 capitalize">
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
                        className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
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
                    <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-black/30">
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
                    <label className="flex flex-col items-center justify-center h-56 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 bg-white/[0.02] hover:bg-violet-500/5 cursor-pointer transition-all duration-300 group">
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
                      <span className="text-xs text-zinc-600 mt-1">
                        MP4, WebM or MOV — up to 30 seconds, max 50MB
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* History Tab */}
              {motionTab === "history" && (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Clock className="w-8 h-8 text-zinc-700 mb-2" />
                  <p className="text-sm text-zinc-500">No motion history yet</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Your previous motion generations will appear here
                  </p>
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
                <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-black/30">
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
              ) : (
                <label className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-white/10 hover:border-cyan-500/40 bg-white/[0.02] hover:bg-cyan-500/5 cursor-pointer transition-all duration-300 group">
                  <input
                    ref={characterImageRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleCharacterImageUpload}
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-3 group-hover:bg-cyan-500/20 transition-colors">
                    <ImageIcon className="w-7 h-7 text-cyan-400" />
                  </div>
                  <span className="text-sm font-medium text-zinc-400 group-hover:text-cyan-300 transition-colors">
                    Add character image
                  </span>
                  <span className="text-xs text-zinc-600 mt-1">
                    PNG, JPG or WebP up to 10MB
                  </span>
                </label>
              )}
            </CardContent>
          </Card>

          {/* Prompt (Optional) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wand2 className="w-4 h-4 text-violet-400" />
                Description
                <span className="text-[10px] font-normal text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded">Optional</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Optionally describe the scene... e.g., 'Cinematic lighting, flowing dress, sunlit garden'"
                value={prompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                className="min-h-[80px] bg-white/[0.03] border-white/[0.08] focus:border-violet-500/50 resize-none"
              />
              <div className="flex justify-between items-center text-xs text-zinc-600">
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
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Advanced
                  {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quality */}
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Quality</label>
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
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                      }`}
                    >
                      <div className={`text-sm font-medium ${quality === opt.value ? "text-violet-300" : "text-zinc-300"}`}>
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Duration</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
                  >
                    {MOTION_DURATIONS.map((d) => (
                      <option key={d} value={d}>{d}s</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Orientation</label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as "video" | "image")}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
                  >
                    <option value="video">Match Video</option>
                    <option value="image">Match Image</option>
                  </select>
                </div>
              </div>

              {/* Audio Toggle */}
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-1">
                  {enableAudio ? (
                    <Volume2 className="w-4 h-4 text-violet-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-zinc-500" />
                  )}
                </div>
                <Switch
                  checked={enableAudio}
                  onCheckedChange={setEnableAudio}
                  label={enableAudio ? "Audio Enabled" : "No Audio"}
                  description="Generate native audio with the video"
                  size="sm"
                />
              </div>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">Seed</label>
                      <input
                        type="number"
                        value={seed ?? ""}
                        onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="Random"
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">Keep Original Sound</label>
                      <select
                        value={keepOriginalSound ? "yes" : "no"}
                        onChange={(e) => setKeepOriginalSound(e.target.value === "yes")}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
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
                    ) : (
                      <div className="text-center p-2">
                        <Video className="w-6 h-6 text-zinc-700 mx-auto mb-1" />
                        <p className="text-[10px] text-zinc-600">Motion</p>
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
                        <User className="w-6 h-6 text-zinc-700 mx-auto mb-1" />
                        <p className="text-[10px] text-zinc-600">Character</p>
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
                {(motionVideo || selectedEffect) && characterImagePreview && (
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
                    <span className="text-zinc-500">Type</span>
                    <span className="text-zinc-300">Motion Control</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Quality</span>
                    <span className="text-zinc-300">
                      {quality === "pro" ? "Pro" : "Standard"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Motion</span>
                    <span className="text-zinc-300 truncate max-w-[140px]">
                      {selectedEffect
                        ? selectedEffectObj?.name
                        : motionVideo
                        ? motionVideo.name
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Character</span>
                    <span className="text-zinc-300">
                      {characterImage ? "Uploaded" : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Duration</span>
                    <span className="text-zinc-300">{duration}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Audio</span>
                    <span className={enableAudio ? "text-violet-300" : "text-zinc-500"}>
                      {enableAudio ? "Enabled" : "Off"}
                    </span>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-zinc-500">Estimated Cost</span>
                    <span className="text-sm font-bold text-violet-300">
                      {creditCost} credits
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-zinc-500">Est. Time</span>
                    <span className="text-xs text-zinc-400">
                      ~{Math.ceil(duration * 12 / 60)} min
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Balance</span>
                    <span className={`text-sm font-medium ${
                      hasEnoughCredits ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {`${user?.creditBalance?.toLocaleString() ?? "—"} credits`}
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    {error}
                  </div>
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
                  <p className="text-[11px] text-center text-zinc-600">
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

      {/* Mobile: Fixed Generate button at bottom */}
      <MobileActionBar>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <Zap className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-sm font-bold text-violet-300">{creditCost}</span>
            <span className="text-xs text-zinc-500">credits</span>
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
