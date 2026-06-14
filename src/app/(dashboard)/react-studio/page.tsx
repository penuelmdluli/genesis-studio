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
  Upload,
  Users,
  Video,
  X,
  Zap,
  Volume2,
  VolumeX,
  Link as LinkIcon,
  Settings2,
  ImageIcon,
  Camera,
} from "lucide-react";
import { uploadFile } from "@/lib/upload-client";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
import { HelpTip } from "@/components/ui/tooltip";
import {
  GenerationProgress,
  useGenerationProgress,
} from "@/components/ui/generation-progress";

type SceneTab = "describe" | "upload" | "url";
type Tier = "standard" | "premium";

const DURATIONS = [5, 8, 10];
const ASPECT_RATIOS = ["16:9", "9:16", "1:1"];

const TIER_INFO = {
  standard: { label: "Standard", price: "$0.35", credits: 200, desc: "Kling — fast & reliable" },
  premium: { label: "Premium", price: "$3.20", credits: 600, desc: "Veo 3.1 — cinema quality" },
};

export default function ReactStudioPage() {
  const { user, addJob, updateCreditBalance, isInitialized } = useStore();
  const { toast } = useToast();

  const isLoading = !isInitialized;

  // User photos
  const [userPhotos, setUserPhotos] = useState<{ file: File; preview: string }[]>([]);

  // Scene
  const [sceneVideo, setSceneVideo] = useState<File | null>(null);
  const [sceneVideoPreview, setSceneVideoPreview] = useState<string | null>(null);
  const [sceneUrl, setSceneUrl] = useState("");
  const [scenePrompt, setScenePrompt] = useState("");
  const [sceneTab, setSceneTab] = useState<SceneTab>("describe");

  // Settings
  const [tier, setTier] = useState<Tier>("standard");
  const [duration, setDuration] = useState(5);
  const [enableAudio, setEnableAudio] = useState(true);
  const [aspectRatio, setAspectRatio] = useState("16:9");

  // Generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const sceneVideoRef = useRef<HTMLInputElement>(null);
  const generateLockRef = useRef(false);

  const progress = useGenerationProgress();

  // Credit cost
  const creditCost = TIER_INFO[tier].credits;
  const hasEnoughCredits = user?.isOwner || (user?.creditBalance ?? 0) >= creditCost;

  // Photo upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = 3 - userPhotos.length;
    if (remaining <= 0) {
      toast("Maximum 3 photos allowed", "error");
      return;
    }

    const newPhotos: { file: File; preview: string }[] = [];
    const filesToProcess = Array.from(files).slice(0, remaining);

    for (const file of filesToProcess) {
      if (file.size > 10 * 1024 * 1024) {
        toast("Image too large (max 10MB)", "error");
        continue;
      }
      newPhotos.push({ file, preview: URL.createObjectURL(file) });
    }

    setUserPhotos((prev) => [...prev, ...newPhotos]);
    setError(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    setUserPhotos((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  // Scene video upload
  const handleSceneVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setSceneVideo(file);
      setSceneVideoPreview(url);
      setError(null);
    };
    video.onerror = () => {
      setError("Could not read video file.");
      URL.revokeObjectURL(url);
    };
    video.src = url;
  };

  const clearSceneVideo = () => {
    setSceneVideo(null);
    setSceneVideoPreview(null);
    if (sceneVideoRef.current) sceneVideoRef.current.value = "";
  };

  // Determine if scene is set
  const hasScene = scenePrompt.trim() || sceneVideo || sceneUrl.trim();

  const canGenerate =
    userPhotos.length > 0 &&
    hasScene &&
    hasEnoughCredits &&
    !isLoading;

  const handleGenerate = async () => {
    if (generateLockRef.current || isGenerating) return;
    generateLockRef.current = true;
    setError(null);

    if (userPhotos.length === 0) {
      setError("Please upload at least one photo of yourself.");
      generateLockRef.current = false;
      return;
    }
    if (!hasScene) {
      setError("Describe a scene, upload a video, or paste a URL.");
      generateLockRef.current = false;
      return;
    }
    if (!hasEnoughCredits) {
      setError(`Not enough credits. Need ${creditCost}, have ${user?.creditBalance ?? 0}.`);
      generateLockRef.current = false;
      return;
    }

    setIsGenerating(true);
    progress.start([
      "Uploading photos",
      sceneVideo ? "Uploading scene video" : "Preparing scene",
      "Generating video",
      "Saving to gallery",
    ]);

    try {
      progress.setProgress(10, "Uploading your photos...");

      // Upload all user photos to R2
      const photoUrls: string[] = [];
      for (let i = 0; i < userPhotos.length; i++) {
        const url = await uploadFile(userPhotos[i].file, "image");
        photoUrls.push(url);
        progress.setProgress(10 + ((i + 1) / userPhotos.length) * 20, `Uploaded photo ${i + 1}/${userPhotos.length}`);
      }

      progress.advanceStep(sceneVideo ? "Uploading scene video..." : "Preparing scene...");
      progress.setProgress(35, sceneVideo ? "Uploading scene video..." : "Preparing scene...");

      // Upload scene video if provided
      let sceneVideoUrl: string | undefined;
      if (sceneVideo) {
        sceneVideoUrl = await uploadFile(sceneVideo, "video");
      }

      progress.setProgress(50, "Starting generation...");
      progress.advanceStep("Generating video...");

      const res = await fetch("/api/react-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoUrls,
          sceneVideoUrl,
          sceneUrl: sceneUrl.trim() || undefined,
          scenePrompt: scenePrompt.trim() || undefined,
          tier,
          duration,
          enableAudio,
          aspectRatio,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        progress.setProgress(85, "Saving to gallery...");
        progress.advanceStep("Saving to gallery...");

        addJob({
          id: data.jobId,
          userId: user?.id || "",
          status: "queued",
          type: "i2v",
          modelId: "mimic-motion",
          prompt: scenePrompt.trim() || `React: ${sceneUrl.trim() ? "URL scene" : "uploaded scene"}`,
          resolution: "720p",
          duration,
          fps: 24,
          isDraft: false,
          creditsCost: data.creditsCost || creditCost,
          progress: 0,
          createdAt: new Date().toISOString(),
        });
        updateCreditBalance((user?.creditBalance ?? 0) - creditCost);
        progress.complete("Your react video is ready!");
        toast("React video started! Check your gallery.", "success");
        setError(null);
      } else {
        progress.fail(data.error || "Generation failed.");
        setError(data.error || "Generation failed.");
        toast(data.error || "Generation failed", "error");
      }
    } catch (err) {
      console.error("React studio generation failed:", err);
      progress.fail("Network error. Please try again.");
      setError("Network error. Please try again.");
      toast("Network error.", "error");
    } finally {
      setIsGenerating(false);
      generateLockRef.current = false;
    }
  };

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-600/20 shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">React Studio</h1>
              <Badge className="bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30 text-[10px] sm:text-xs shrink-0">
                TRENDING
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
              Insert yourself into any video scene — react with celebrities, join movie scenes, enter the World Cup
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
          {[
            { num: 1, label: "Your Photo", done: userPhotos.length > 0 },
            { num: 2, label: "Scene", done: !!hasScene },
            { num: 3, label: "Generate", done: false },
          ].map((step, i) => (
            <div key={step.num} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium transition-all ${
                  step.done
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    : "bg-white/[0.05] text-zinc-400 border border-white/[0.10]"
                }`}
              >
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
          {/* Step 1: Your Photos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Camera className="w-4 h-4 text-violet-400" />
                Your Photos
                <HelpTip text="Upload a clear front-facing photo. Add side angles for better results." side="right" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo grid */}
              {userPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {userPhotos.map((photo, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-white/[0.12] bg-black/30 group">
                      <img
                        src={photo.preview}
                        alt={`Photo ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 hover:bg-red-500/80 text-white transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-1.5 left-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] text-zinc-300 font-medium">
                          {i === 0 ? "Front" : `Angle ${i}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload area */}
              {userPhotos.length < 3 && (
                <label className="flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 bg-white/[0.04] hover:bg-violet-500/5 cursor-pointer transition-all duration-300 group">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handlePhotoUpload}
                    multiple
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-2 group-hover:bg-violet-500/20 transition-colors">
                    <Upload className="w-5 h-5 text-violet-400" />
                  </div>
                  <span className="text-xs font-medium text-zinc-400 group-hover:text-violet-300 transition-colors">
                    Upload {userPhotos.length === 0 ? "1-3 photos" : "more photos"} of yourself
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5">
                    PNG, JPG or WebP up to 10MB &middot; {3 - userPhotos.length} remaining
                  </span>
                </label>
              )}

              <p className="text-[11px] text-zinc-500">
                Tip: Upload a clear front-facing photo. Add side angles for better results.
              </p>
            </CardContent>
          </Card>

          {/* Step 2: Choose Scene */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Video className="w-4 h-4 text-fuchsia-400" />
                Choose Scene
                <HelpTip text="Describe a scene, upload a video clip, or paste a URL from TikTok/Instagram." side="right" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/[0.10]">
                {([
                  { key: "describe" as const, label: "Describe", icon: ImageIcon },
                  { key: "upload" as const, label: "Upload Video", icon: Upload },
                  { key: "url" as const, label: "Paste URL", icon: LinkIcon },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setSceneTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all duration-200 ${
                      sceneTab === tab.key
                        ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                        : "text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Describe Tab */}
              {sceneTab === "describe" && (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Celebrating with Messi on the football pitch, World Cup final, stadium crowd cheering"
                    value={scenePrompt}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setScenePrompt(e.target.value)}
                    className="min-h-[100px] bg-white/[0.05] border-white/[0.12] focus:border-violet-500/50 resize-none"
                  />
                  <div className="flex justify-between items-center text-xs text-zinc-400">
                    <span>{scenePrompt.length} characters</span>
                    <span>Be specific — describe the setting, action, and mood</span>
                  </div>
                </div>
              )}

              {/* Upload Video Tab */}
              {sceneTab === "upload" && (
                <div>
                  {sceneVideoPreview && sceneVideo ? (
                    <div className="relative rounded-xl overflow-hidden border border-white/[0.12] bg-black/30">
                      <video
                        src={sceneVideoPreview}
                        className="w-full h-56 object-contain"
                        controls
                        muted
                        loop
                      />
                      <button
                        onClick={clearSceneVideo}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-red-500/80 text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="default" className="text-[10px] bg-black/60 backdrop-blur">
                          {sceneVideo.name}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-56 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 bg-white/[0.04] hover:bg-violet-500/5 cursor-pointer transition-all duration-300 group">
                      <input
                        ref={sceneVideoRef}
                        type="file"
                        accept="video/mp4,video/webm,video/mov"
                        onChange={handleSceneVideoUpload}
                        className="hidden"
                      />
                      <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-3 group-hover:bg-violet-500/20 transition-colors">
                        <Video className="w-7 h-7 text-violet-400" />
                      </div>
                      <span className="text-sm font-medium text-zinc-400 group-hover:text-violet-300 transition-colors">
                        Upload a scene video to react to
                      </span>
                      <span className="text-xs text-zinc-400 mt-1">
                        MP4, WebM or MOV — up to 30 seconds, max 50MB
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* Paste URL Tab */}
              {sceneTab === "url" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">
                      Paste a TikTok, Instagram, or video URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={sceneUrl}
                        onChange={(e) => setSceneUrl(e.target.value)}
                        placeholder="https://www.tiktok.com/@user/video/..."
                        className="flex-1 px-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                      />
                      {sceneUrl && (
                        <button
                          onClick={() => setSceneUrl("")}
                          className="p-2 rounded-lg bg-white/[0.06] hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Supports TikTok, Instagram Reels, Twitter/X, Facebook, and direct video URLs
                    </p>
                  </div>
                  {sceneUrl && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <LinkIcon className="w-4 h-4 text-violet-400 shrink-0" />
                      <span className="text-xs text-violet-300 truncate">{sceneUrl}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Settings2 className="w-4 h-4 text-zinc-400" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quality Tier */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Quality Tier</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["standard", "premium"] as const).map((t) => {
                    const info = TIER_INFO[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setTier(t)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          tier === t
                            ? "border-violet-500/40 bg-violet-500/10 ring-1 ring-violet-500/20"
                            : "border-white/[0.10] bg-white/[0.04] hover:border-white/[0.12]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${tier === t ? "text-violet-300" : "text-zinc-300"}`}>
                            {info.label}
                          </span>
                          <span className={`text-xs font-semibold ${tier === t ? "text-fuchsia-300" : "text-zinc-400"}`}>
                            {info.price}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{info.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration & Aspect Ratio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Duration</label>
                  <div className="flex gap-1.5">
                    {DURATIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                          duration === d
                            ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                            : "bg-white/[0.04] text-zinc-400 border border-white/[0.10] hover:border-white/[0.12]"
                        }`}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Aspect Ratio</label>
                  <div className="flex gap-1.5">
                    {ASPECT_RATIOS.map((ar) => (
                      <button
                        key={ar}
                        onClick={() => setAspectRatio(ar)}
                        className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                          aspectRatio === ar
                            ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                            : "bg-white/[0.04] text-zinc-400 border border-white/[0.10] hover:border-white/[0.12]"
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Audio Toggle */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Audio</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: true, label: "Audio On", icon: Volume2, desc: "AI-generated sound" },
                    { value: false, label: "Audio Off", icon: VolumeX, desc: "Silent video" },
                  ] as const).map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setEnableAudio(opt.value)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        enableAudio === opt.value
                          ? "border-violet-500/40 bg-violet-500/10 ring-1 ring-violet-500/20"
                          : "border-white/[0.10] bg-white/[0.04] hover:border-white/[0.12]"
                      }`}
                    >
                      <opt.icon
                        className={`w-4 h-4 mx-auto mb-1 ${
                          enableAudio === opt.value ? "text-violet-400" : "text-zinc-400"
                        }`}
                      />
                      <div
                        className={`text-[11px] font-medium ${
                          enableAudio === opt.value ? "text-violet-300" : "text-zinc-400"
                        }`}
                      >
                        {opt.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Preview + Summary + Generate — hidden on mobile */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            {/* Preview Card */}
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-br from-violet-950/50 via-zinc-900 to-fuchsia-950/30 relative">
                <div className="grid grid-cols-2 gap-0.5">
                  {/* User photo preview */}
                  <div className="aspect-square bg-black/40 flex items-center justify-center relative">
                    {userPhotos.length > 0 ? (
                      <img
                        src={userPhotos[0].preview}
                        alt="You"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-2">
                        <Users className="w-6 h-6 text-zinc-400 mx-auto mb-1" />
                        <p className="text-[10px] text-zinc-400">Your Photo</p>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1">
                      <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] text-violet-300 font-medium">
                        You {userPhotos.length > 1 ? `+${userPhotos.length - 1}` : ""}
                      </span>
                    </div>
                  </div>
                  {/* Scene preview */}
                  <div className="aspect-square bg-black/40 flex items-center justify-center relative">
                    {sceneVideoPreview ? (
                      <video
                        src={sceneVideoPreview}
                        className="w-full h-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    ) : sceneUrl.trim() ? (
                      <div className="text-center p-2">
                        <LinkIcon className="w-6 h-6 text-fuchsia-400 mx-auto mb-1" />
                        <p className="text-[10px] text-fuchsia-300 font-medium truncate px-1">URL Video</p>
                      </div>
                    ) : scenePrompt.trim() ? (
                      <div className="text-center p-2">
                        <ImageIcon className="w-6 h-6 text-fuchsia-400 mx-auto mb-1" />
                        <p className="text-[10px] text-fuchsia-300 font-medium line-clamp-3 px-1">
                          {scenePrompt.slice(0, 60)}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center p-2">
                        <Video className="w-6 h-6 text-zinc-400 mx-auto mb-1" />
                        <p className="text-[10px] text-zinc-400">Scene</p>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1">
                      <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] text-fuchsia-300 font-medium">
                        Scene
                      </span>
                    </div>
                  </div>
                </div>
                {/* Ready badge */}
                {userPhotos.length > 0 && hasScene && (
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
                    <span className="text-zinc-300">React Studio</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Tier</span>
                    <span className="text-zinc-300">
                      {TIER_INFO[tier].label} ({TIER_INFO[tier].price})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Photos</span>
                    <span className="text-zinc-300">
                      {userPhotos.length > 0 ? `${userPhotos.length} uploaded` : "\u2014"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Scene</span>
                    <span className="text-zinc-300 truncate max-w-[140px]">
                      {sceneVideo
                        ? sceneVideo.name
                        : sceneUrl.trim()
                        ? "URL Import"
                        : scenePrompt.trim()
                        ? scenePrompt.slice(0, 30) + (scenePrompt.length > 30 ? "..." : "")
                        : "\u2014"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Duration</span>
                    <span className="text-zinc-300">{duration}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Aspect Ratio</span>
                    <span className="text-zinc-300">{aspectRatio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Audio</span>
                    <span className={enableAudio ? "text-violet-300" : "text-zinc-400"}>
                      {enableAudio ? "On" : "Off"}
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
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-400">Balance</span>
                    <span
                      className={`text-sm font-medium ${
                        hasEnoughCredits ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {`${user?.creditBalance?.toLocaleString() ?? "\u2014"} credits`}
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
                  {isGenerating ? (
                    "Generating..."
                  ) : (
                    <>
                      <Zap className="w-4 h-4" /> Generate React Video
                    </>
                  )}
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
            {isGenerating ? (
              "Generating..."
            ) : (
              <>
                <Zap className="w-4 h-4" /> Generate
              </>
            )}
          </Button>
        </div>
      </MobileActionBar>

      {/* Spacer for mobile action bar */}
      <div className="h-20 lg:hidden" />
    </PageTransition>
  );
}
