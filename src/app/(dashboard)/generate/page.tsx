"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tooltip, HelpTip } from "@/components/ui/tooltip";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import {
  AI_MODELS,
  RESOLUTIONS,
  REEL_RESOLUTIONS,
  DURATIONS,
  REEL_DURATIONS,
  FPS_OPTIONS,
  MODEL_ACCESS,
  BUILT_IN_AUDIO_TRACKS,
  AUDIO_GENRES,
} from "@/lib/constants";
import { estimateCreditCost } from "@/lib/utils";
import { CreditUpsell, useUpsellContext } from "@/components/ui/credit-upsell";
import { ModelId, GenerationType, VideoFormat } from "@/types";
import { uploadFile } from "@/lib/upload-client";
import { PROMPT_SUGGESTIONS, PROMPT_TEMPLATES, TEMPLATE_CATEGORIES, type PromptTemplate } from "@/lib/prompt-templates";
import { PLATFORM_PRESETS, PLATFORM_NAMES } from "@/lib/platform-presets";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles,
  Zap,
  Upload,
  Play,
  Settings2,
  Wand2,
  Film,
  Image as ImageIcon,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Monitor,
  Music,
  Volume2,
  Square,
  X,
  Info,
  Pause,
  LayoutTemplate,
  AlertTriangle,
  Globe,
  Languages,
} from "lucide-react";
import { GenesisButtonLoader } from "@/components/ui/genesis-loader";

const TYPE_OPTIONS: { value: GenerationType; label: string; icon: typeof Film; desc: string }[] = [
  { value: "t2v", label: "Text to Video", icon: Film, desc: "Generate from text prompt" },
  { value: "i2v", label: "Image to Video", icon: ImageIcon, desc: "Animate a still image" },
  { value: "v2v", label: "Video to Video", icon: RefreshCw, desc: "Style transfer & retarget" },
];

export default function GeneratePage() {
  const { form, setFormField, user, addJob, updateCreditBalance, setCreditPurchaseOpen } = useStore();
  const { toast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const generateLockRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [inputImagePreview, setInputImagePreview] = useState<string | null>(null);
  const [audioGenreFilter, setAudioGenreFilter] = useState<string>("All");
  const musicPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<string>("All");
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [presetPlatform, setPresetPlatform] = useState<string>("All");
  const [isTranslating, setIsTranslating] = useState(false);

  const handlePreviewTrack = useCallback((trackId: string, trackUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingTrackId === trackId && musicPreviewRef.current) {
      musicPreviewRef.current.pause();
      musicPreviewRef.current.currentTime = 0;
      setPlayingTrackId(null);
      return;
    }
    if (musicPreviewRef.current) {
      musicPreviewRef.current.pause();
      musicPreviewRef.current.currentTime = 0;
    }
    const audio = new Audio(trackUrl);
    musicPreviewRef.current = audio;
    setPlayingTrackId(trackId);
    audio.play();
    audio.onended = () => setPlayingTrackId(null);
    audio.onerror = () => setPlayingTrackId(null);
  }, [playingTrackId]);

  const isLoading = !user;
  const isReel = form.videoFormat === "reel";
  const upsellContext = useUpsellContext();

  const userPlan = user?.plan || "free";
  const availableModels = MODEL_ACCESS[userPlan] || MODEL_ACCESS.free;

  const modelId = availableModels.includes(form.modelId) ? form.modelId : availableModels[0];
  const currentModel = AI_MODELS[modelId];
  const modelSupportsAudio = !!currentModel?.hasAudio;
  const effectiveAudio = form.enableLiveSound && modelSupportsAudio;
  const creditCost = estimateCreditCost(modelId, form.resolution, form.duration, form.isDraft, effectiveAudio);
  const hasEnoughCredits = user?.isOwner || (user?.creditBalance ?? 0) >= creditCost;

  // "Ready to generate" — all required info is provided
  const isReadyToGenerate = form.prompt.trim().length >= 5 && (form.type !== "i2v" || !!form.inputImage);

  const resolutionSource = isReel ? REEL_RESOLUTIONS : RESOLUTIONS;
  const durationSource = isReel ? REEL_DURATIONS : DURATIONS;
  const availableResolutions = resolutionSource.filter((r) => {
    const modelMaxRes = currentModel?.maxResolution;
    const resOrder = ["480p", "720p", "1080p", "4k"];
    return resOrder.indexOf(r.value) <= resOrder.indexOf(modelMaxRes || "720p");
  });

  const filteredAudioTracks = BUILT_IN_AUDIO_TRACKS.filter(
    (t) => audioGenreFilter === "All" || t.genre === audioGenreFilter
  );
  const selectedAudioTrack = BUILT_IN_AUDIO_TRACKS.find((t) => t.id === form.audioTrackId);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormField("inputImage", file);
      const reader = new FileReader();
      reader.onload = () => setInputImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" });
      if (res.ok) {
        toast("Generation cancelled. Credits refunded.", "success");
      }
    } catch {
      toast("Failed to cancel generation.", "error");
    }
  };

  const handleEnhancePrompt = async () => {
    if (isEnhancing || !form.prompt.trim()) return;
    setIsEnhancing(true);
    try {
      const res = await fetch("/api/prompt/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: form.prompt, type: form.type }),
      });
      if (res.ok) {
        const { enhanced } = await res.json();
        setFormField("prompt", enhanced);
        toast("Prompt enhanced!", "success");
      } else {
        toast("Enhancement failed. Try again.", "error");
      }
    } catch {
      toast("Enhancement failed.", "error");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleApplyTemplate = (template: PromptTemplate) => {
    let prompt = template.template;
    for (const ph of template.placeholders) {
      prompt = prompt.replace(`{${ph.key}}`, ph.example);
    }
    setFormField("prompt", prompt);
    setShowTemplates(false);
    toast(`Template "${template.name}" applied!`, "success");
  };

  const handleTranslatePrompt = async () => {
    if (isTranslating || !form.prompt.trim()) return;
    setIsTranslating(true);
    try {
      const res = await fetch("/api/prompt/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: form.prompt, sourceLanguage: "auto" }),
      });
      if (res.ok) {
        const { translated } = await res.json();
        setFormField("prompt", translated);
        toast("Prompt translated to English!", "success");
      } else {
        toast("Translation failed.", "error");
      }
    } catch {
      toast("Translation failed.", "error");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleApplyPreset = (preset: typeof PLATFORM_PRESETS[0]) => {
    setFormField("videoFormat", preset.videoFormat);
    setFormField("aspectRatio", preset.aspectRatio);
    setFormField("resolution", preset.resolution);
    setFormField("duration", preset.duration);
    setFormField("fps", preset.fps);
    setShowPresets(false);
    toast(`${preset.name} preset applied!`, "success");
  };

  const handleGenerate = async () => {
    // Double-click protection: ref is synchronous, prevents race window
    if (generateLockRef.current) return;
    generateLockRef.current = true;

    setError(null);

    const trimmedPrompt = form.prompt.trim();
    if (!trimmedPrompt) {
      setError("Please enter a prompt.");
      generateLockRef.current = false;
      return;
    }
    if (trimmedPrompt.length < 5) {
      setError("Prompt is too short. Please describe the video you want (min 5 characters).");
      generateLockRef.current = false;
      return;
    }
    if (trimmedPrompt.length > 2000) {
      setError("Prompt is too long (max 2000 characters). Please shorten it.");
      generateLockRef.current = false;
      return;
    }
    // Block obvious non-prompts (markdown, code, etc.)
    const markdownPatterns = /^(#{1,6}\s|```|\*\*|>\s|\|\s|---)/m;
    if (markdownPatterns.test(trimmedPrompt) && trimmedPrompt.length > 200) {
      setError("This looks like a document, not a video prompt. Please describe the video you want to generate.");
      generateLockRef.current = false;
      return;
    }
    if (isLoading) {
      setError("Loading account data... please wait.");
      generateLockRef.current = false;
      return;
    }
    if (!hasEnoughCredits) {
      setError(`Not enough credits. You need ${creditCost} but have ${user?.creditBalance ?? 0}.`);
      generateLockRef.current = false;
      return;
    }

    setIsGenerating(true);
    setModerationWarning(null);

    // Content moderation check
    try {
      const modRes = await fetch("/api/prompt/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });
      if (modRes.ok) {
        const modData = await modRes.json();
        if (!modData.safe) {
          setModerationWarning(modData.reason || "This prompt contains content that violates our guidelines.");
          setError("Prompt blocked by content moderation. Please modify your prompt.");
          setIsGenerating(false);
          generateLockRef.current = false;
          return;
        }
      }
    } catch {
      // Moderation failed — continue (fail open)
    }
    try {
      // Upload input image to R2 if present (for i2v mode)
      let inputImageUrl: string | undefined;
      if (form.inputImage && (form.type === "i2v" || form.type === "v2v")) {
        try {
          inputImageUrl = await uploadFile(form.inputImage, "image");
        } catch {
          console.error("Image upload failed, continuing without image");
        }
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          modelId: modelId,
          prompt: form.prompt,
          negativePrompt: form.negativePrompt || undefined,
          inputImageUrl,
          resolution: form.resolution,
          duration: form.duration,
          fps: form.fps,
          seed: form.seed,
          guidanceScale: form.guidanceScale,
          numInferenceSteps: form.numInferenceSteps,
          isDraft: form.isDraft,
          aspectRatio: form.aspectRatio,
          audioTrackId: form.audioTrackId || undefined,
          enableAudio: effectiveAudio,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addJob({
          id: data.jobId,
          userId: user?.id || "",
          status: "queued",
          type: form.type,
          modelId: modelId,
          prompt: form.prompt,
          resolution: form.resolution,
          duration: form.duration,
          fps: form.fps,
          isDraft: form.isDraft,
          aspectRatio: form.aspectRatio,
          audioTrackId: form.audioTrackId,
          creditsCost: creditCost,
          progress: 0,
          createdAt: new Date().toISOString(),
        });
        updateCreditBalance((user?.creditBalance ?? 0) - creditCost);
        toast("Generation started! Check your gallery for progress.", "success");
        setError(null);
      } else {
        setError(data.error || "Generation failed. Please try again.");
        toast(data.error || "Generation failed", "error");
      }
    } catch (err) {
      console.error("Generation failed:", err);
      setError("Network error. Please check your connection and try again.");
      toast("Network error. Please try again.", "error");
    } finally {
      setIsGenerating(false);
      generateLockRef.current = false;
    }
  };

  return (
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          Generate {isReel ? "Reel" : "Video"}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Create AI-generated {isReel ? "reels" : "videos"} from text, images, or other videos{isReel ? " — optimized for social media" : ""}.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Controls */}
        <div className="lg:col-span-2 space-y-4">
          {/* Generation Type */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-2">
                {TYPE_OPTIONS.map((opt) => {
                  const isActive = form.type === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setFormField("type", opt.value)}
                      className={`p-3 rounded-xl border text-left transition-all duration-200 press-effect ${
                        isActive
                          ? "border-violet-500/40 bg-violet-500/10 shadow-lg shadow-violet-500/5"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                      }`}
                    >
                      <opt.icon className={`w-5 h-5 mb-2 ${isActive ? "text-violet-400" : "text-zinc-500"}`} />
                      <div className={`text-sm font-medium ${isActive ? "text-violet-300" : "text-zinc-300"}`}>
                        {opt.label}
                      </div>
                      <div className="text-xs text-zinc-500">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Video Format */}
          <Card>
            <CardContent className="p-4">
              <label className="text-sm font-medium text-zinc-300 block mb-2">Format</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "standard" as VideoFormat, label: "Standard", icon: Monitor, desc: "Landscape 16:9" },
                  { value: "reel" as VideoFormat, label: "Reel", icon: Smartphone, desc: "Vertical 9:16" },
                ] as const).map((fmt) => {
                  const isActive = form.videoFormat === fmt.value;
                  return (
                    <button
                      key={fmt.value}
                      onClick={() => {
                        setFormField("videoFormat", fmt.value);
                        setFormField("aspectRatio", fmt.value === "reel" ? "portrait" : "landscape");
                        if (fmt.value === "reel" && !REEL_DURATIONS.includes(form.duration)) {
                          setFormField("duration", 15);
                        } else if (fmt.value === "standard" && !DURATIONS.includes(form.duration)) {
                          setFormField("duration", 5);
                        }
                      }}
                      className={`p-3 rounded-xl border text-left transition-all duration-200 press-effect ${
                        isActive
                          ? "border-violet-500/40 bg-violet-500/10"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <fmt.icon className={`w-4 h-4 ${isActive ? "text-violet-400" : "text-zinc-500"}`} />
                        <span className={`text-sm font-medium ${isActive ? "text-violet-300" : "text-zinc-300"}`}>
                          {fmt.label}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500">{fmt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Platform Presets */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-violet-400" />
                  Platform Presets
                </label>
                <button
                  onClick={() => setShowPresets(!showPresets)}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  {showPresets ? "Hide" : "Show presets"}
                </button>
              </div>
              {showPresets && (
                <div className="space-y-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {["All", ...PLATFORM_NAMES].map((p) => (
                      <button
                        key={p}
                        onClick={() => setPresetPlatform(p)}
                        className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                          presetPlatform === p
                            ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                            : "bg-white/[0.03] text-zinc-500 border border-white/[0.06] hover:text-zinc-300"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PLATFORM_PRESETS.filter((p) => presetPlatform === "All" || p.platform === presetPlatform).map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleApplyPreset(preset)}
                        className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-violet-500/30 hover:bg-violet-500/5 text-left transition-all"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{preset.icon}</span>
                          <span className="text-xs font-medium text-zinc-300">{preset.name}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 line-clamp-2">{preset.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prompt */}
          <Card glow>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-300">Prompt</label>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <LayoutTemplate className="w-3 h-3" /> Templates
                </button>
              </div>
              <Textarea
                placeholder="Describe your video... e.g., 'A majestic eagle soaring over snow-capped mountains at golden hour, cinematic 4K'"
                value={form.prompt}
                onChange={(e) => { setFormField("prompt", e.target.value); setModerationWarning(null); }}
                rows={4}
                className="text-base"
              />

              {/* Prompt Suggestions — shown when prompt is empty */}
              {!form.prompt.trim() && (
                <div className="space-y-2">
                  <span className="text-xs text-zinc-500">Try a suggestion:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_SUGGESTIONS.slice(0, 6).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setFormField("prompt", s)}
                        className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-zinc-400 hover:text-violet-300 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all line-clamp-1 max-w-[250px] text-left"
                      >
                        {s.length > 60 ? s.slice(0, 60) + "..." : s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Moderation Warning */}
              {moderationWarning && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/[0.08] border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{moderationWarning}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-zinc-500">{form.prompt.length} characters</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                    onClick={handleTranslatePrompt}
                    disabled={isTranslating || !form.prompt.trim()}
                  >
                    {isTranslating ? <GenesisButtonLoader /> : <Languages className="w-3 h-3" />}
                    <span className="hidden sm:inline">{isTranslating ? "Translating..." : "Translate"}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-violet-400 hover:text-violet-300"
                    onClick={handleEnhancePrompt}
                    disabled={isEnhancing || !form.prompt.trim()}
                  >
                    {isEnhancing ? <GenesisButtonLoader /> : <Wand2 className="w-3 h-3" />}
                    <span className="hidden sm:inline">{isEnhancing ? "Enhancing..." : "Enhance"}</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Template Browser */}
          {showTemplates && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-300">Prompt Templates</label>
                  <button onClick={() => setShowTemplates(false)} className="p-1 hover:bg-white/[0.06] rounded-lg">
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setTemplateCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                        templateCategory === cat
                          ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                          : "bg-white/[0.03] text-zinc-500 border border-white/[0.06] hover:text-zinc-300"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {PROMPT_TEMPLATES.filter((t) => templateCategory === "All" || t.category === templateCategory).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleApplyTemplate(t)}
                      className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-violet-500/30 hover:bg-violet-500/5 text-left transition-all"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{t.icon}</span>
                        <span className="text-sm font-medium text-zinc-300">{t.name}</span>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-2">{t.template}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Image Upload (for I2V) */}
          {form.type === "i2v" && (
            <Card>
              <CardContent className="p-4">
                <label className="text-sm font-medium text-zinc-300 block mb-2">
                  Input Image
                </label>
                {inputImagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/[0.06]">
                    <img
                      src={inputImagePreview}
                      alt="Input"
                      className="w-full max-h-64 object-contain bg-[#0D0D14]"
                    />
                    <button
                      onClick={() => {
                        setInputImagePreview(null);
                        setFormField("inputImage", undefined as unknown as File);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-zinc-300 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-10 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-violet-500/30 cursor-pointer transition-colors bg-white/[0.01]">
                    <Upload className="w-8 h-8 text-zinc-600 mb-3" />
                    <span className="text-sm text-zinc-400">Click or drag to upload an image</span>
                    <span className="text-xs text-zinc-600 mt-1">PNG, JPG up to 10MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </CardContent>
            </Card>
          )}

          {/* Model Selector */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <label className="text-sm font-medium text-zinc-300">AI Model</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableModels.map((mid) => {
                  const model = AI_MODELS[mid];
                  if (!model) return null;
                  const isSelected = modelId === mid;
                  const supportsType = model.types.includes(form.type);
                  const tierColors: Record<string, string> = {
                    flagship: "text-violet-400",
                    workhorse: "text-emerald-400",
                    speed: "text-amber-400",
                    turbo: "text-cyan-400",
                    realism: "text-pink-400",
                    budget: "text-cyan-400",
                    hollywood: "text-yellow-400",
                    motion: "text-orange-400",
                  };

                  return (
                    <button
                      key={mid}
                      onClick={() => supportsType && setFormField("modelId", mid)}
                      disabled={!supportsType}
                      className={`p-3 rounded-xl border text-left transition-all duration-200 press-effect ${
                        !supportsType
                          ? "opacity-30 cursor-not-allowed border-white/[0.04]"
                          : isSelected
                          ? model.tier === "hollywood"
                            ? "border-yellow-500/40 bg-yellow-500/10 shadow-lg shadow-yellow-500/10"
                            : "border-violet-500/40 bg-violet-500/10 shadow-lg shadow-violet-500/5"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${tierColors[model.tier] || "text-zinc-400"}`}>
                          {model.tier}
                        </span>
                        {model.hasAudio && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full">
                            AUDIO
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-zinc-200 truncate">{model.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">~{model.avgGenerationTime}s</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Parameters */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5 font-medium">Resolution</label>
                  <Select
                    value={form.resolution}
                    onChange={(v) => setFormField("resolution", v)}
                    options={availableResolutions.map((r) => ({ value: r.value, label: r.label }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5 font-medium">Duration</label>
                  <Select
                    value={form.duration.toString()}
                    onChange={(v) => setFormField("duration", parseInt(v))}
                    options={durationSource.map((d) => ({ value: String(d), label: `${d}s` }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5 font-medium">FPS</label>
                  <Select
                    value={form.fps.toString()}
                    onChange={(v) => setFormField("fps", parseInt(v))}
                    options={FPS_OPTIONS.map((f) => ({ value: String(f), label: `${f} fps` }))}
                  />
                </div>
              </div>

              {/* Draft Mode Toggle */}
              <div className="p-3 rounded-xl bg-amber-500/[0.04] border border-amber-500/15">
                <Switch
                  checked={form.isDraft}
                  onCheckedChange={(v) => setFormField("isDraft", v)}
                  label="Draft Mode"
                  description="Fast preview, 70% cheaper. Refine later."
                />
              </div>

              {/* Advanced Settings */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Advanced Settings
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-3 border-t border-white/[0.06]">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1.5 font-medium flex items-center gap-1">Seed <HelpTip text="Same seed + prompt = same result. Leave empty for random." side="top" /></label>
                    <Input
                      type="number"
                      placeholder="Random"
                      value={form.seed ?? ""}
                      onChange={(e) =>
                        setFormField("seed", e.target.value ? parseInt(e.target.value) : undefined)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1.5 font-medium flex items-center gap-1">Guidance Scale <HelpTip text="How closely to follow your prompt. Higher = more literal, lower = more creative." side="top" /></label>
                    <Input
                      type="number"
                      step="0.5"
                      min="1"
                      max="20"
                      value={form.guidanceScale}
                      onChange={(e) => setFormField("guidanceScale", parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1.5 font-medium flex items-center gap-1">Inference Steps <HelpTip text="More steps = higher quality but slower. Default works well for most prompts." side="top" /></label>
                    <Input
                      type="number"
                      min="5"
                      max="100"
                      value={form.numInferenceSteps}
                      onChange={(e) => setFormField("numInferenceSteps", parseInt(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Sound Toggle — only for models with native audio */}
          {modelSupportsAudio && (
            <Card className={form.enableLiveSound ? "border-yellow-500/20 bg-yellow-500/[0.03]" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${form.enableLiveSound ? "bg-yellow-500/20" : "bg-white/[0.04]"}`}>
                      <Volume2 className={`w-5 h-5 ${form.enableLiveSound ? "text-yellow-400" : "text-zinc-500"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200">Live Sound</span>
                        {form.enableLiveSound && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full">
                            +30%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Sound effects, dialogue, and ambient audio
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={form.enableLiveSound}
                    onCheckedChange={(v) => setFormField("enableLiveSound", v)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audio / Sound */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Music className="w-4 h-4 text-violet-400" />
                  Background Audio
                  <span className="text-zinc-600 text-xs">(optional)</span>
                </label>
                {form.audioTrackId && (
                  <button
                    onClick={() => setFormField("audioTrackId", undefined as unknown as string)}
                    className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                )}
              </div>

              {/* Genre Filter */}
              <div className="flex gap-1.5 flex-wrap">
                {["All", ...AUDIO_GENRES].map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setAudioGenreFilter(genre)}
                    className={`px-2.5 py-1 rounded-full text-xs transition-all duration-200 ${
                      audioGenreFilter === genre
                        ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                        : "bg-white/[0.03] text-zinc-500 border border-white/[0.06] hover:border-white/[0.1]"
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>

              {/* Track List */}
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {filteredAudioTracks.map((track) => {
                  const isSelected = form.audioTrackId === track.id;
                  return (
                    <button
                      key={track.id}
                      onClick={() =>
                        setFormField("audioTrackId", isSelected ? (undefined as unknown as string) : track.id)
                      }
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all duration-200 ${
                        isSelected
                          ? "border-violet-500/40 bg-violet-500/10"
                          : "border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08]"
                      }`}
                    >
                      <div
                        onClick={(e) => handlePreviewTrack(track.id, track.url, e)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                          playingTrackId === track.id
                            ? "bg-violet-500 text-white"
                            : isSelected
                              ? "bg-violet-500/20 hover:bg-violet-500/40"
                              : "bg-white/[0.04] hover:bg-white/[0.1]"
                        }`}
                        title={playingTrackId === track.id ? "Stop" : "Preview"}
                      >
                        {playingTrackId === track.id ? (
                          <Square className={`w-3 h-3 text-white`} />
                        ) : (
                          <Play className={`w-4 h-4 ml-0.5 ${isSelected ? "text-violet-400" : "text-zinc-600"}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${isSelected ? "text-violet-300" : "text-zinc-300"}`}>
                          {track.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {track.genre} · {track.duration}s · {track.bpm} BPM
                        </div>
                      </div>
                      {isSelected && (
                        <Badge variant="violet" className="shrink-0 text-[10px]">
                          Selected
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedAudioTrack && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-violet-500/[0.06] border border-violet-500/15">
                  <Music className="w-4 h-4 text-violet-400 shrink-0" />
                  <span className="text-xs text-violet-300">
                    {selectedAudioTrack.name} — {selectedAudioTrack.genre} · {selectedAudioTrack.duration}s
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Negative Prompt */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <label className="text-sm font-medium text-zinc-300 flex items-center gap-1.5">
                Negative Prompt <span className="text-zinc-600 text-xs">(optional)</span>
                <HelpTip text="Describe what you DON'T want. Helps avoid common artifacts like blur, distortion, or watermarks." side="top" />
              </label>
              <Textarea
                placeholder="What to avoid... e.g., 'blurry, low quality, distorted, watermark'"
                value={form.negativePrompt}
                onChange={(e) => setFormField("negativePrompt", e.target.value)}
                rows={2}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary & Generate — hidden on mobile, shown as sticky card on desktop */}
        <div className="hidden lg:block space-y-4">
          <Card glow className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Generation Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2.5 text-sm">
                {[
                  { label: "Type", value: form.type === "t2v" ? "Text to Video" : form.type === "i2v" ? "Image to Video" : "Video to Video" },
                  { label: "Format", badge: true, badgeVariant: isReel ? "cyan" as const : "default" as const, value: isReel ? "Reel (9:16)" : "Standard (16:9)" },
                  { label: "Model", value: currentModel?.name },
                  { label: "Resolution", value: form.resolution },
                  { label: "Duration", value: `${form.duration}s @ ${form.fps}fps` },
                  { label: "Mode", badge: true, badgeVariant: form.isDraft ? "amber" as const : "violet" as const, value: form.isDraft ? "Draft" : "Full Quality" },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-zinc-500">{row.label}</span>
                    {row.badge ? (
                      <Badge variant={row.badgeVariant}>{row.value}</Badge>
                    ) : (
                      <span className="text-zinc-200">{row.value}</span>
                    )}
                  </div>
                ))}

                {selectedAudioTrack && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Audio</span>
                    <span className="text-zinc-200 flex items-center gap-1">
                      <Music className="w-3 h-3 text-violet-400" />
                      {selectedAudioTrack.name}
                    </span>
                  </div>
                )}

                {effectiveAudio && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Live Sound</span>
                    <span className="text-yellow-400 flex items-center gap-1 text-xs font-semibold">
                      <Volume2 className="w-3 h-3" />
                      Enabled (+30%)
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Est. Time</span>
                  <span className="text-zinc-200">
                    ~{Math.round((currentModel?.avgGenerationTime || 60) * (form.isDraft ? 0.3 : 1))}s
                  </span>
                </div>
              </div>

              {/* Cost section — only shown when ready to generate */}
              {isReadyToGenerate ? (
                <>
                  <div className="border-t border-white/[0.06] pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-zinc-300">Cost</span>
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-violet-400" />
                        <span className="text-xl font-bold text-violet-300">{creditCost}</span>
                        <span className="text-xs text-zinc-500">credits</span>
                      </div>
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-zinc-500">Your balance</span>
                      <span className={`text-xs font-semibold ${hasEnoughCredits ? "text-emerald-400" : "text-red-400"}`}>
                        {`${user?.creditBalance?.toLocaleString() ?? 50} credits`}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="w-full shadow-lg shadow-violet-600/20"
                    size="lg"
                    disabled={!form.prompt.trim() || isGenerating || isLoading}
                    loading={isGenerating}
                    onClick={handleGenerate}
                  >
                    {isGenerating ? (
                      "Generating..."
                    ) : isLoading ? (
                      "Loading..."
                    ) : !hasEnoughCredits ? (
                      "Not enough credits"
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> Generate {isReel ? "Reel" : "Video"}
                      </>
                    )}
                  </Button>

                  {error && (
                    <p className="text-xs text-center text-red-400 mt-2">
                      {error}
                    </p>
                  )}

                  {!isLoading && !hasEnoughCredits && !error && (
                    <p className="text-xs text-center text-red-400">
                      You need {creditCost - (user?.creditBalance ?? 0)} more credits.{" "}
                      <button onClick={() => setCreditPurchaseOpen(true)} className="underline hover:text-red-300 transition-colors">Buy credits</button>
                    </p>
                  )}
                </>
              ) : (
                <div className="border-t border-white/[0.06] pt-4 text-center">
                  <p className="text-xs text-zinc-500">
                    {form.type === "i2v" && !form.inputImage
                      ? "Add a prompt and upload an image to see the cost"
                      : "Add a prompt to see the cost"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Credit Upsell */}
          {upsellContext && (
            <CreditUpsell variant="inline" context={upsellContext} />
          )}
        </div>
      </div>

      {/* Mobile: Fixed Generate button at bottom */}
      <MobileActionBar>
        {isReadyToGenerate ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <Zap className="w-4 h-4 text-violet-400 shrink-0" />
                <span className="text-sm font-bold text-violet-300">{creditCost}</span>
                <span className="text-xs text-zinc-500">credits</span>
                {effectiveAudio && (
                  <Volume2 className="w-3 h-3 text-yellow-400 shrink-0" />
                )}
              </div>
              <Button
                className="flex-1 max-w-[200px] shadow-lg shadow-violet-600/20"
                disabled={!form.prompt.trim() || isGenerating || isLoading}
                loading={isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating ? (
                  "Generating..."
                ) : isLoading ? (
                  "Loading..."
                ) : !hasEnoughCredits ? (
                  "No credits"
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Generate
                  </>
                )}
              </Button>
            </div>
            {error && (
              <p className="text-xs text-center text-red-400 mt-1.5">{error}</p>
            )}
          </>
        ) : (
          <p className="text-xs text-center text-zinc-500 py-2">
            Fill in your prompt to generate
          </p>
        )}
      </MobileActionBar>

      {/* Spacer for mobile action bar */}
      <div className="h-20 lg:hidden" />
    </PageTransition>
  );
}
