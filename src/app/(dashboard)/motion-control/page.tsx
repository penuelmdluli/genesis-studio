"use client";

import { useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import {
  AI_MODELS,
  RESOLUTIONS,
  FPS_OPTIONS,
  MODEL_ACCESS,
  MOTION_PRESETS,
  MOTION_CATEGORIES,
} from "@/lib/constants";
import { estimateCreditCost } from "@/lib/utils";
import { ModelId, CharacterOrientation, MotionPreset as MotionPresetType } from "@/types";
import {
  Sparkles,
  Zap,
  Upload,
  Play,
  Settings2,
  Wand2,
  Film,
  Image as ImageIcon,
  User,
  Video,
  X,
  Info,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Library,
  Clock,
  Move,
  PersonStanding,
} from "lucide-react";

type MotionTab = "upload" | "library" | "history";

// Motion control supports longer durations (up to 30s) to match reference videos
const MOTION_DURATIONS = [3, 5, 8, 10, 15, 20, 30];

export default function MotionControlPage() {
  const { form, setFormField, user, addJob, updateCreditBalance } = useStore();
  const { toast } = useToast();

  // Motion-specific state
  const [motionVideo, setMotionVideo] = useState<File | null>(null);
  const [motionVideoPreview, setMotionVideoPreview] = useState<string | null>(null);
  const [characterImage, setCharacterImage] = useState<File | null>(null);
  const [characterImagePreview, setCharacterImagePreview] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<CharacterOrientation>("match_video");
  const [motionTab, setMotionTab] = useState<MotionTab>("upload");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [motionCategoryFilter, setMotionCategoryFilter] = useState("All");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parameters
  const [resolution, setResolution] = useState("720p");
  const [duration, setDuration] = useState(10);
  const [fps, setFps] = useState(24);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [numInferenceSteps, setNumInferenceSteps] = useState(30);

  const motionVideoRef = useRef<HTMLInputElement>(null);
  const characterImageRef = useRef<HTMLInputElement>(null);

  const isLoading = !user;
  const userPlan = user?.plan || "free";
  const availableModels = (MODEL_ACCESS[userPlan] || MODEL_ACCESS.free).filter((id) => {
    const model = AI_MODELS[id];
    return model && (model.types.includes("v2v") || model.types.includes("i2v"));
  });
  const modelId = availableModels[0] || "wan-2.2";
  const currentModel = AI_MODELS[modelId];
  const creditCost = estimateCreditCost(modelId, resolution, duration, false);
  const hasEnoughCredits = user?.isOwner || (user?.creditBalance ?? 0) >= creditCost;

  const filteredPresets = MOTION_PRESETS.filter(
    (p) => motionCategoryFilter === "All" || p.category === motionCategoryFilter.toLowerCase()
  );

  const handleMotionVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError("Video file too large. Maximum size is 50MB.");
      toast("Video too large (max 50MB)", "error");
      return;
    }

    const url = URL.createObjectURL(file);

    // Auto-detect video duration and clamp to 30s max
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const videoDur = Math.round(video.duration);
      if (videoDur > 30) {
        setError("Video is longer than 30 seconds. Please trim it or use a shorter clip.");
        toast("Video must be 30 seconds or shorter", "error");
        URL.revokeObjectURL(url);
        return;
      }
      // Set duration to match the uploaded video
      const closestDuration = MOTION_DURATIONS.reduce((prev, curr) =>
        Math.abs(curr - videoDur) < Math.abs(prev - videoDur) ? curr : prev
      );
      setDuration(closestDuration);
      setMotionVideo(file);
      setSelectedPreset(null);
      setMotionVideoPreview(url);
      setError(null);
    };
    video.onerror = () => {
      setError("Could not read video file. Please try a different format.");
      URL.revokeObjectURL(url);
    };
    video.src = url;
  };

  const handleCharacterImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
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

  const handlePresetSelect = (preset: MotionPresetType) => {
    setSelectedPreset(preset.id);
    setMotionVideo(null);
    setMotionVideoPreview(preset.previewVideoUrl || null);
  };

  const clearMotionVideo = () => {
    setMotionVideo(null);
    setMotionVideoPreview(null);
    setSelectedPreset(null);
    if (motionVideoRef.current) motionVideoRef.current.value = "";
  };

  const clearCharacterImage = () => {
    setCharacterImage(null);
    setCharacterImagePreview(null);
    if (characterImageRef.current) characterImageRef.current.value = "";
  };

  const canGenerate =
    (motionVideo || selectedPreset) &&
    characterImage &&
    hasEnoughCredits &&
    !isLoading;

  // Helper: upload a file to R2 via presigned URL
  const uploadFileToR2 = async (
    file: File,
    purpose: "video" | "image"
  ): Promise<string> => {
    // 1. Get presigned URLs from our API
    const presignRes = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        purpose,
      }),
    });
    if (!presignRes.ok) {
      const err = await presignRes.json();
      throw new Error(err.error || "Failed to get upload URL");
    }
    const { uploadUrl, downloadUrl } = await presignRes.json();

    // 2. Upload file directly to R2
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!uploadRes.ok) {
      throw new Error("Failed to upload file to storage");
    }

    // 3. Return the signed download URL (RunPod can access this)
    return downloadUrl;
  };

  const handleGenerate = async () => {
    setError(null);

    if (!motionVideo && !selectedPreset) {
      setError("Please upload a motion reference video or select from the library.");
      return;
    }
    if (!characterImage) {
      setError("Please upload a character image.");
      return;
    }
    if (!hasEnoughCredits) {
      setError(`Not enough credits. You need ${creditCost} but have ${user?.creditBalance ?? 0}.`);
      return;
    }

    setIsGenerating(true);
    try {
      // Upload files to R2 first
      toast("Uploading files...", "info");

      let inputVideoUrl: string | undefined;
      let inputImageUrl: string | undefined;

      // Upload character image
      inputImageUrl = await uploadFileToR2(characterImage, "image");

      // Upload motion video (or use preset URL)
      if (motionVideo) {
        inputVideoUrl = await uploadFileToR2(motionVideo, "video");
      } else if (selectedPreset) {
        const preset = MOTION_PRESETS.find((p) => p.id === selectedPreset);
        inputVideoUrl = preset?.previewVideoUrl || undefined;
      }

      toast("Starting generation...", "info");

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "motion" as const,
          modelId,
          prompt: prompt.trim() || "Motion control generation — transfer character motion with high quality",
          negativePrompt: negativePrompt || undefined,
          inputImageUrl,
          inputVideoUrl,
          resolution,
          duration,
          fps,
          seed,
          guidanceScale,
          numInferenceSteps,
          isDraft: false,
          aspectRatio: "landscape",
          motionPresetId: selectedPreset || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addJob({
          id: data.jobId,
          userId: user?.id || "",
          status: "queued",
          type: "motion",
          modelId,
          prompt: prompt.trim() || "Motion control generation",
          resolution,
          duration,
          fps,
          isDraft: false,
          creditsCost: creditCost,
          progress: 0,
          createdAt: new Date().toISOString(),
        });
        updateCreditBalance((user?.creditBalance ?? 0) - creditCost);
        toast("Motion control generation started! Check your gallery.", "success");
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
    }
  };

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-600/20">
            <Move className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Motion Control</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Transfer motion from a reference video onto any character image
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[
            { num: 1, label: "Motion", done: !!(motionVideo || selectedPreset) },
            { num: 2, label: "Character", done: !!characterImage },
            { num: 3, label: "Settings", done: !!(motionVideo || selectedPreset) && !!characterImage },
            { num: 4, label: "Generate", done: false },
          ].map((step, i) => (
            <div key={step.num} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
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
              {i < 3 && <div className={`w-6 h-px ${step.done ? "bg-violet-500/40" : "bg-white/[0.06]"}`} />}
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
                Motion Reference
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabs: Upload / Library / History */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                {([
                  { key: "upload", label: "Upload Video", icon: Upload },
                  { key: "library", label: "Motion Library", icon: Library },
                  { key: "history", label: "History", icon: Clock },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setMotionTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      motionTab === tab.key
                        ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

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
                        Add video of character actions to mimic
                      </span>
                      <span className="text-xs text-zinc-600 mt-1">
                        MP4, WebM or MOV — up to 30 seconds, max 50MB
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* Library Tab */}
              {motionTab === "library" && (
                <div className="space-y-3">
                  {/* Category Filter */}
                  <div className="flex gap-1.5 flex-wrap">
                    {MOTION_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setMotionCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          motionCategoryFilter === cat
                            ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                            : "bg-white/[0.03] text-zinc-500 hover:text-zinc-300 border border-white/[0.06]"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Preset Grid — real video previews */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                    {filteredPresets.map((preset) => {
                      const isSelected = selectedPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => handlePresetSelect(preset)}
                          className={`relative rounded-xl border overflow-hidden text-left transition-all duration-200 group ${
                            isSelected
                              ? "border-violet-500/50 ring-2 ring-violet-500/30 bg-violet-500/10"
                              : "border-white/[0.06] hover:border-violet-500/30 bg-white/[0.02]"
                          }`}
                        >
                          {/* Video thumbnail — auto-plays on hover */}
                          <div className="aspect-[4/3] bg-zinc-900 relative overflow-hidden">
                            <video
                              src={preset.previewVideoUrl || preset.thumbnailUrl}
                              className="w-full h-full object-cover"
                              muted
                              loop
                              playsInline
                              preload="metadata"
                              onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                              onMouseLeave={(e) => {
                                const vid = e.target as HTMLVideoElement;
                                vid.pause();
                                vid.currentTime = 0;
                              }}
                            />
                            {/* Play indicator on hover */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <Play className="w-4 h-4 text-white ml-0.5" />
                              </div>
                            </div>
                            {/* Category badge */}
                            <div className="absolute top-1.5 left-1.5">
                              <span className="px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[9px] font-medium text-zinc-300 capitalize">
                                {preset.category}
                              </span>
                            </div>
                            {/* Selected checkmark */}
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center shadow-lg">
                                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            )}
                          </div>
                          {/* Label */}
                          <div className="p-2.5">
                            <div className={`text-xs font-medium truncate ${isSelected ? "text-violet-300" : "text-zinc-300"}`}>
                              {preset.name}
                            </div>
                            <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                              {preset.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedPreset && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <svg className="w-4 h-4 text-violet-400 shrink-0" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-xs text-violet-300">
                        Selected: <strong>{MOTION_PRESETS.find((p) => p.id === selectedPreset)?.name}</strong>
                      </span>
                      <button
                        onClick={() => { setSelectedPreset(null); setMotionVideoPreview(null); }}
                        className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {motionTab === "history" && (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Clock className="w-8 h-8 text-zinc-700 mb-2" />
                  <p className="text-sm text-zinc-500">No motion history yet</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Your previously used motions will appear here
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

          {/* Character Orientation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <RotateCcw className="w-4 h-4 text-fuchsia-400" />
                Character Orientation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setOrientation("match_video")}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                    orientation === "match_video"
                      ? "border-violet-500/40 bg-violet-500/10 shadow-lg shadow-violet-500/5"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      orientation === "match_video"
                        ? "bg-violet-500/20"
                        : "bg-white/[0.04]"
                    }`}>
                      <Video className={`w-4 h-4 ${
                        orientation === "match_video" ? "text-violet-400" : "text-zinc-500"
                      }`} />
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${
                        orientation === "match_video" ? "text-violet-300" : "text-zinc-400"
                      }`}>
                        Matches Video
                      </div>
                      <div className="text-[11px] text-zinc-600">
                        Character follows video orientation
                      </div>
                    </div>
                  </div>
                  {orientation === "match_video" && (
                    <div className="flex justify-end">
                      <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setOrientation("match_image")}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                    orientation === "match_image"
                      ? "border-cyan-500/40 bg-cyan-500/10 shadow-lg shadow-cyan-500/5"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      orientation === "match_image"
                        ? "bg-cyan-500/20"
                        : "bg-white/[0.04]"
                    }`}>
                      <ImageIcon className={`w-4 h-4 ${
                        orientation === "match_image" ? "text-cyan-400" : "text-zinc-500"
                      }`} />
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${
                        orientation === "match_image" ? "text-cyan-300" : "text-zinc-400"
                      }`}>
                        Matches Image
                      </div>
                      <div className="text-[11px] text-zinc-600">
                        Preserves character&apos;s original pose
                      </div>
                    </div>
                  </div>
                  {orientation === "match_image" && (
                    <div className="flex justify-end">
                      <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              </div>
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
                placeholder="Optionally describe the scene... e.g., 'Cinematic lighting, flowing dress, sunlit garden' — leave empty to auto-generate from the motion"
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
                  Parameters
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
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Resolution</label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
                  >
                    {RESOLUTIONS.filter((r) => {
                      const resOrder = ["480p", "720p", "1080p", "4k"];
                      return resOrder.indexOf(r.value) <= resOrder.indexOf(currentModel?.maxResolution || "720p");
                    }).map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Duration</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
                  >
                    {MOTION_DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d >= 60 ? `${d / 60}m` : `${d}s`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">FPS</label>
                  <select
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
                  >
                    {FPS_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f} fps
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                  <div className="grid grid-cols-3 gap-3">
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
                      <label className="block text-xs text-zinc-500 mb-1.5">Guidance Scale</label>
                      <input
                        type="number"
                        value={guidanceScale}
                        onChange={(e) => setGuidanceScale(Number(e.target.value))}
                        min={1}
                        max={20}
                        step={0.5}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">Inference Steps</label>
                      <input
                        type="number"
                        value={numInferenceSteps}
                        onChange={(e) => setNumInferenceSteps(Number(e.target.value))}
                        min={10}
                        max={100}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Negative Prompt */}
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Negative Prompt</label>
                    <Textarea
                      placeholder="Things to avoid... e.g., 'blurry, distorted face, bad anatomy'"
                      value={negativePrompt}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNegativePrompt(e.target.value)}
                      className="min-h-[60px] bg-white/[0.03] border-white/[0.08] focus:border-violet-500/50 resize-none text-sm"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary & Generate */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            {/* Preview Card — shows motion + character side by side */}
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-br from-violet-950/50 via-zinc-900 to-fuchsia-950/30 relative">
                {/* Two-panel preview: Motion + Character */}
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
                    ) : (
                      <div className="text-center p-2">
                        <Video className="w-6 h-6 text-zinc-700 mx-auto mb-1" />
                        <p className="text-[10px] text-zinc-600">Motion</p>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1">
                      <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] text-violet-300 font-medium">
                        Motion
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
                {/* Status badge */}
                {(motionVideo || selectedPreset) && characterImagePreview && (
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-violet-500/90 text-white text-[10px] shadow-lg">
                      Ready to Generate
                    </Badge>
                  </div>
                )}
                {/* Arrow indicator between panels */}
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
                    <span className="text-zinc-500">Model</span>
                    <span className="text-zinc-300">{currentModel?.name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Motion</span>
                    <span className="text-zinc-300 truncate max-w-[140px]">
                      {selectedPreset
                        ? MOTION_PRESETS.find((p) => p.id === selectedPreset)?.name
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
                    <span className="text-zinc-500">Orientation</span>
                    <span className="text-zinc-300">
                      {orientation === "match_video" ? "Matches Video" : "Matches Image"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Resolution</span>
                    <span className="text-zinc-300">{resolution}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Duration</span>
                    <span className="text-zinc-300">{duration >= 60 ? `${duration / 60}m` : `${duration}s`}</span>
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
                      ~{Math.ceil((currentModel?.avgGenerationTime || 120) * (duration / 5) / 60)} min
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Balance</span>
                    <span className={`text-sm font-medium ${
                      hasEnoughCredits ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {user?.isOwner
                        ? "∞ Unlimited"
                        : `${user?.creditBalance?.toLocaleString() ?? "—"} credits`}
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
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-violet-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {isGenerating ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Generate Motion
                    </div>
                  )}
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
    </PageTransition>
  );
}
