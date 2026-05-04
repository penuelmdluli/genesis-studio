"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
import {
  GenerationProgress,
  useGenerationProgress,
} from "@/components/ui/generation-progress";
import { PRODUCT_AD_TEMPLATES } from "@/lib/product-ad-templates";
import { VOICE_OPTIONS } from "@/lib/constants";
import {
  Zap,
  Rocket,
  ArrowRightLeft,
  Crosshair,
  Star,
  Package,
  Scale,
  Sun,
  Upload,
  X,
  Lock,
  Play,
  Sparkles,
  Image as ImageIcon,
  Film,
  Type,
  Clock,
  Music,
  Captions,
  Monitor,
  Smartphone,
  RectangleHorizontal,
  SquareIcon,
  Briefcase,
  Wand2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Volume2,
  Layers,
  DollarSign,
  Edit3,
  Square,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

interface AdScene {
  id: string;
  label: string;
  duration: number;
  textOverlay: { headline: string; subtext?: string; position: string };
  motionPrompt: string;
  imageIndex: number;
}

interface PlatformPreset {
  id: string;
  name: string;
  icon: typeof Monitor;
  aspectRatio: "16:9" | "9:16" | "1:1";
}

// ─── Data ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, typeof Zap> = {
  Zap,
  Rocket,
  ArrowRightLeft,
  Crosshair,
  Star,
  Package,
  Scale,
  Sun,
};

const PLATFORM_PRESETS: PlatformPreset[] = [
  { id: "tiktok", name: "TikTok / Reels", icon: Smartphone, aspectRatio: "9:16" },
  { id: "youtube", name: "YouTube", icon: Monitor, aspectRatio: "16:9" },
  { id: "instagram", name: "Instagram", icon: SquareIcon, aspectRatio: "1:1" },
  { id: "linkedin", name: "LinkedIn", icon: Briefcase, aspectRatio: "16:9" },
];

const MUSIC_MOODS = [
  { id: "upbeat", name: "Upbeat", emoji: "🎵" },
  { id: "corporate", name: "Corporate", emoji: "💼" },
  { id: "dramatic", name: "Dramatic", emoji: "🎬" },
  { id: "chill", name: "Chill", emoji: "🌊" },
  { id: "energetic", name: "Energetic", emoji: "⚡" },
  { id: "emotional", name: "Emotional", emoji: "💝" },
  { id: "trendy", name: "Trendy", emoji: "🔥" },
];

const SUBTITLE_STYLES = [
  { id: "none", name: "No Captions", preview: "" },
  { id: "tiktok", name: "TikTok", preview: "Bold centered, yellow highlight, bounce effect" },
  { id: "youtube", name: "YouTube", preview: "Clean bottom bar, semi-transparent background" },
  { id: "cinematic", name: "Cinematic", preview: "Elegant italic, minimal bottom position" },
  { id: "bold", name: "Bold", preview: "Extra bold, orange highlight, center bounce" },
];

// ─── Component ───────────────────────────────────────────────────────

export default function ProductAdsPage() {
  const { user, updateCreditBalance, isInitialized } = useStore();
  const { toast } = useToast();
  const progress = useGenerationProgress();

  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Product info
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [keyFeatures, setKeyFeatures] = useState("");
  const [price, setPrice] = useState("");
  const [ctaText, setCtaText] = useState("Shop Now");
  const [productImages, setProductImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [aiCopyLoading, setAiCopyLoading] = useState(false);

  // Scenes
  const [scenes, setScenes] = useState<AdScene[]>([]);
  const [scenesGenerated, setScenesGenerated] = useState(false);

  // Style settings
  const [selectedPlatform, setSelectedPlatform] = useState("tiktok");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("9:16");
  const [musicMood, setMusicMood] = useState("energetic");
  const [subtitleStyle, setSubtitleStyle] = useState("tiktok");
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(false);
  const [voiceId, setVoiceId] = useState(VOICE_OPTIONS[0]?.id || "voice-aria");

  // Generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const generateLockRef = useRef(false);

  const isLoading = !isInitialized;
  const userPlan = user?.plan || "free";
  const isPlanAllowed = userPlan === "creator" || userPlan === "pro" || userPlan === "studio" || !!user?.isOwner;

  const selectedTemplate = PRODUCT_AD_TEMPLATES.find(t => t.id === selectedTemplateId);

  // ─── Credit Calculation ───────────────────────────────────────────

  const sceneCount = scenes.length || (selectedTemplate?.sceneStructure.length || 0);
  const sceneCost = sceneCount * 15;
  const musicCost = 3;
  const voiceoverCost = voiceoverEnabled ? 5 : 0;
  const captionsCost = subtitleStyle !== "none" ? 5 : 0;
  const aiCopyCost = 2;
  const totalCreditCost = sceneCost + musicCost + voiceoverCost + captionsCost;
  const hasEnoughCredits = user?.isOwner || (user?.creditBalance ?? 0) >= totalCreditCost;

  // ─── Template Selection ───────────────────────────────────────────

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = PRODUCT_AD_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setMusicMood(template.suggestedMusicMood);
      // Reset scenes when switching template
      setScenes([]);
      setScenesGenerated(false);
      toast(`Template selected: ${template.name}`, "success");
    }
  };

  // ─── Image Upload ─────────────────────────────────────────────────

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const totalImages = productImages.length + files.length;
    if (totalImages > 5) {
      toast("Maximum 5 product images allowed", "error");
      return;
    }

    const validFiles = files.filter(f => {
      if (f.size > 10 * 1024 * 1024) {
        toast(`${f.name} is too large (max 10MB)`, "error");
        return false;
      }
      return true;
    });

    setProductImages(prev => [...prev, ...validFiles]);

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length === 0) return;

    const totalImages = productImages.length + files.length;
    if (totalImages > 5) {
      toast("Maximum 5 product images allowed", "error");
      return;
    }

    const validFiles = files.filter(f => f.size <= 10 * 1024 * 1024);
    setProductImages(prev => [...prev, ...validFiles]);

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // ─── AI Copy Generation ───────────────────────────────────────────

  const handleGenerateCopy = async () => {
    if (!selectedTemplate) {
      toast("Please select a template first", "error");
      return;
    }
    if (!productName.trim()) {
      toast("Please enter a product name", "error");
      return;
    }

    setAiCopyLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/product-ads/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          productName: productName.trim(),
          productDescription: productDescription.trim(),
          keyFeatures: keyFeatures.trim(),
          price: price.trim(),
          ctaText: ctaText.trim(),
          sceneStructure: selectedTemplate.sceneStructure,
        }),
      });

      const data = await res.json();

      if (res.ok && data.scenes) {
        const generatedScenes: AdScene[] = data.scenes.map(
          (scene: { label: string; duration: number; headline: string; subtext?: string; position: string; motionPrompt: string; imageIndex: number },
           index: number) => ({
            id: `scene-${index}`,
            label: scene.label,
            duration: scene.duration,
            textOverlay: {
              headline: scene.headline,
              subtext: scene.subtext || "",
              position: scene.position,
            },
            motionPrompt: scene.motionPrompt,
            imageIndex: scene.imageIndex,
          })
        );
        setScenes(generatedScenes);
        setScenesGenerated(true);
        toast("Ad copy generated! Review your scenes below.", "success");
      } else {
        setError(data.error || "Failed to generate copy");
        toast(data.error || "Failed to generate ad copy", "error");
      }
    } catch {
      setError("Network error. Please try again.");
      toast("Network error generating copy", "error");
    } finally {
      setAiCopyLoading(false);
    }
  };

  // ─── Scene Editing ────────────────────────────────────────────────

  const updateSceneText = (sceneId: string, field: "headline" | "subtext", value: string) => {
    setScenes(prev =>
      prev.map(s =>
        s.id === sceneId
          ? { ...s, textOverlay: { ...s.textOverlay, [field]: value } }
          : s
      )
    );
  };

  // ─── Platform Selection ───────────────────────────────────────────

  const handleSelectPlatform = (p: PlatformPreset) => {
    setSelectedPlatform(p.id);
    setAspectRatio(p.aspectRatio);
  };

  // ─── Upload Helper ────────────────────────────────────────────────

  const uploadFileToStorage = async (file: File): Promise<string> => {
    const { uploadFile } = await import("@/lib/upload-client");
    return uploadFile(file, "image");
  };

  // ─── Generate ─────────────────────────────────────────────────────

  const canGenerate =
    selectedTemplate &&
    productName.trim() &&
    productImages.length > 0 &&
    scenes.length > 0 &&
    hasEnoughCredits &&
    isPlanAllowed &&
    !isLoading;

  const handleGenerate = async () => {
    if (generateLockRef.current) return;
    generateLockRef.current = true;
    setError(null);
    setResultVideoUrl(null);
    setJobId(null);

    if (!selectedTemplate) { setError("Please select a template."); generateLockRef.current = false; return; }
    if (!productName.trim()) { setError("Please enter a product name."); generateLockRef.current = false; return; }
    if (productImages.length === 0) { setError("Please upload at least one product image."); generateLockRef.current = false; return; }
    if (scenes.length === 0) { setError("Please generate ad copy first."); generateLockRef.current = false; return; }
    if (!hasEnoughCredits) { setError(`Need ${totalCreditCost} credits, have ${user?.creditBalance ?? 0}.`); generateLockRef.current = false; return; }

    setIsGenerating(true);

    // Start progress
    const progressSteps = [
      "Uploading product images",
      ...scenes.map((_, i) => `Generating scene ${i + 1}/${scenes.length}`),
      "Assembling video",
      "Adding music",
      ...(subtitleStyle !== "none" ? ["Burning captions"] : []),
      "Finalizing",
    ];
    progress.start(progressSteps);

    try {
      // Upload images
      toast("Uploading product images...", "info");
      const imageUrls: string[] = [];
      for (const img of productImages) {
        const url = await uploadFileToStorage(img);
        imageUrls.push(url);
      }

      progress.advanceStep("Generating scenes...");
      progress.setProgress(15);

      const res = await fetch("/api/product-ads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          productName: productName.trim(),
          productDescription: productDescription.trim(),
          keyFeatures: keyFeatures.trim(),
          price: price.trim(),
          ctaText: ctaText.trim(),
          scenes,
          imageUrls,
          aspectRatio,
          musicMood,
          subtitleStyle,
          voiceover: voiceoverEnabled ? { enabled: true, voiceId } : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.jobId) {
        setJobId(data.jobId);
        updateCreditBalance((user?.creditBalance ?? 0) - (data.creditsCost || totalCreditCost));
        toast("Product ad generation started!", "success");
        progress.setProgress(20, "Generating scenes...");
      } else {
        setError(data.error || "Generation failed.");
        toast(data.error || "Generation failed", "error");
        progress.fail(data.error || "Generation failed");
      }
    } catch (err) {
      console.error("Product ad generation failed:", err);
      setError("Network error. Please try again.");
      toast("Network error.", "error");
      progress.fail("Network error");
    } finally {
      setIsGenerating(false);
      generateLockRef.current = false;
    }
  };

  // ─── Poll for completion ──────────────────────────────────────────

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId || resultVideoUrl) return;

    let pollCount = 0;
    pollIntervalRef.current = setInterval(async () => {
      pollCount++;

      // Simulate progress through scene generation
      const totalSteps = scenes.length + 3 + (subtitleStyle !== "none" ? 1 : 0);
      const progressPct = Math.min(20 + pollCount * (60 / totalSteps), 85);
      progress.setProgress(progressPct);

      // Advance steps periodically
      if (pollCount % 3 === 0) {
        progress.advanceStep();
      }

      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "completed" && data.outputVideoUrl) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setResultVideoUrl(data.outputVideoUrl);
          progress.complete("Your product ad is ready!");
          toast("Your product ad is ready!", "success");
        } else if (data.status === "failed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setError(data.errorMessage || "Generation failed. Credits refunded.");
          setJobId(null);
          progress.fail(data.errorMessage || "Generation failed");
          toast("Generation failed. Credits refunded.", "error");
        }
      } catch { /* retry on next interval */ }
    }, 5000);

    const timeout = setTimeout(() => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (!resultVideoUrl) {
        setError("Generation timed out. Check your gallery or try again.");
        setJobId(null);
        progress.fail("Timed out");
      }
    }, 600000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      clearTimeout(timeout);
    };
  }, [jobId, resultVideoUrl]);

  // ─── Computed values ──────────────────────────────────────────────

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0) || selectedTemplate?.totalDuration || 0;

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <PageTransition className="space-y-6">
      {/* ─── Hero Section ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-amber-500/10 border border-violet-500/20 p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(168,85,247,0.08),transparent_70%)]" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Product Ads Creator</h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Turn product photos into scroll-stopping video ads — no camera, no editing skills needed
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {["8 templates", "Multi-scene", "Text overlays", "Music", "Captions"].map(stat => (
              <span
                key={stat}
                className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.10] text-[11px] text-zinc-300 font-medium"
              >
                {stat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Plan Gate */}
      {!isPlanAllowed && !isLoading && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-300">Creator+ plan required</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Upgrade to create professional product video ads — starts at R220/month.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 1: Template Selector ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[10px] font-bold text-white">1</div>
            Choose Template
            {selectedTemplate && (
              <span className="text-[10px] text-emerald-400 font-normal ml-auto">{selectedTemplate.name}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRODUCT_AD_TEMPLATES.map((template) => {
              const Icon = ICON_MAP[template.icon] || Zap;
              const isSelected = selectedTemplateId === template.id;
              return (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template.id)}
                  className={`flex flex-col items-start gap-2 p-3 rounded-xl text-left transition-all duration-200 group ${
                    isSelected
                      ? "bg-violet-500/15 border border-violet-500/40 ring-1 ring-violet-500/20 shadow-lg shadow-violet-500/10"
                      : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-violet-500/20"
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-violet-400" : "text-zinc-400 group-hover:text-violet-400"} transition-colors`} />
                    <span className={`text-xs font-semibold ${isSelected ? "text-violet-300" : "text-zinc-300"} truncate`}>
                      {template.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                    {template.description}
                  </p>
                  <div className="flex items-center gap-2 mt-auto">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400">
                      {template.totalDuration}s
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400">
                      {template.sceneStructure.length} scenes
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── STEP 2: Product Info ──────────────────────────────────── */}
      <Card className={!selectedTemplate ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[10px] font-bold text-white">2</div>
            Product Info
            {productName && (
              <span className="text-[10px] text-emerald-400 font-normal ml-auto">Ready</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Product Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. GlowPro Skin Serum"
              className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/[0.12] text-sm text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Product Description
            </label>
            <Textarea
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="What does your product do? Who is it for?"
              className="min-h-[80px] bg-white/[0.05] border-white/[0.12] text-zinc-200 placeholder:text-zinc-400 resize-none"
            />
          </div>

          {/* Key Features */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Key Features
            </label>
            <Textarea
              value={keyFeatures}
              onChange={(e) => setKeyFeatures(e.target.value)}
              placeholder="List your top features, one per line or comma-separated"
              className="min-h-[60px] bg-white/[0.05] border-white/[0.12] text-zinc-200 placeholder:text-zinc-400 resize-none"
            />
          </div>

          {/* Price + CTA Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                <DollarSign className="w-3 h-3 inline mr-0.5" />
                Price (optional)
              </label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="R299 or $49.99"
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/[0.12] text-sm text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                CTA Text
              </label>
              <input
                type="text"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Shop Now"
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/[0.12] text-sm text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all"
              />
            </div>
          </div>

          {/* Product Images */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              <ImageIcon className="w-3 h-3 inline mr-1" />
              Product Images (1-5) <span className="text-red-400">*</span>
            </label>

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-5 gap-2 mb-3">
                {imagePreviews.map((preview, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden border border-white/[0.12] bg-black/30 aspect-square">
                    <img src={preview} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 p-1 rounded-md bg-black/60 hover:bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white font-medium">
                      #{i + 1}
                    </div>
                  </div>
                ))}
                {productImages.length < 5 && (
                  <label
                    className="flex items-center justify-center aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 bg-white/[0.04] hover:bg-violet-500/5 cursor-pointer transition-all"
                  >
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Upload className="w-5 h-5 text-zinc-400" />
                  </label>
                )}
              </div>
            )}

            {productImages.length === 0 && (
              <label
                className="flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 bg-white/[0.04] hover:bg-violet-500/5 cursor-pointer transition-all duration-300 group"
                onDragOver={handleImageDragOver}
                onDrop={handleImageDrop}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-2 group-hover:bg-violet-500/20 transition-colors">
                  <Upload className="w-6 h-6 text-violet-400" />
                </div>
                <span className="text-sm font-medium text-zinc-400 group-hover:text-violet-300 transition-colors">
                  Drop product photos or click to upload
                </span>
                <span className="text-xs text-zinc-400 mt-1">PNG, JPEG, WebP — max 10MB each — 1 to 5 images</span>
              </label>
            )}
          </div>

          {/* AI Generate Copy Button */}
          <Button
            onClick={handleGenerateCopy}
            disabled={!selectedTemplate || !productName.trim() || aiCopyLoading}
            loading={aiCopyLoading}
            className="w-full h-11 bg-gradient-to-r from-violet-600/80 to-fuchsia-600/80 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl border border-violet-500/30 transition-all duration-300"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            AI Write My Ad Copy
            <span className="ml-2 text-[10px] opacity-70">({aiCopyCost} credits)</span>
          </Button>
        </CardContent>
      </Card>

      {/* ─── STEP 3: Scene Editor ──────────────────────────────────── */}
      {scenesGenerated && scenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[10px] font-bold text-white">3</div>
              Scene Editor
              <span className="text-[10px] text-zinc-400 font-normal ml-auto">
                {scenes.length} scenes / {totalDuration}s total
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scenes.map((scene, index) => (
              <div
                key={scene.id}
                className="rounded-xl border border-white/[0.10] bg-white/[0.03] p-4 space-y-3 hover:border-violet-500/20 transition-colors"
              >
                {/* Scene Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-400">
                      {index + 1}
                    </div>
                    <span className="text-xs font-semibold text-zinc-200">{scene.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-zinc-400">
                      <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                      {scene.duration}s
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-zinc-400">
                      <ImageIcon className="w-2.5 h-2.5 inline mr-0.5" />
                      Image #{scene.imageIndex + 1}
                    </span>
                  </div>
                </div>

                {/* Text Overlay Editor */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Headline</label>
                    <input
                      type="text"
                      value={scene.textOverlay.headline}
                      onChange={(e) => updateSceneText(scene.id, "headline", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.10] text-xs text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    />
                  </div>
                  {scene.textOverlay.subtext !== undefined && (
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">Subtext</label>
                      <input
                        type="text"
                        value={scene.textOverlay.subtext || ""}
                        onChange={(e) => updateSceneText(scene.id, "subtext", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.10] text-xs text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 4: Style Settings ────────────────────────────────── */}
      <Card className={!scenesGenerated ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[10px] font-bold text-white">4</div>
            Style Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Platform */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Platform</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {PLATFORM_PRESETS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPlatform(p)}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      selectedPlatform === p.id
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                        : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.08]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aspect Ratio Override */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Aspect Ratio</label>
            <div className="flex gap-2">
              {([
                { ratio: "16:9" as const, icon: RectangleHorizontal, label: "16:9 Landscape" },
                { ratio: "9:16" as const, icon: Smartphone, label: "9:16 Portrait" },
                { ratio: "1:1" as const, icon: SquareIcon, label: "1:1 Square" },
              ]).map((ar) => (
                <button
                  key={ar.ratio}
                  onClick={() => setAspectRatio(ar.ratio)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    aspectRatio === ar.ratio
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.08]"
                  }`}
                >
                  <ar.icon className="w-3.5 h-3.5" />
                  {ar.label}
                </button>
              ))}
            </div>
          </div>

          {/* Music Mood */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              <Music className="w-3 h-3 inline mr-1" />
              Music Mood
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {MUSIC_MOODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMusicMood(m.id)}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all ${
                    musicMood === m.id
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.08]"
                  }`}
                >
                  <span className="text-sm">{m.emoji}</span>
                  <span className="text-[10px] font-medium">{m.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle Style */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              <Captions className="w-3 h-3 inline mr-1" />
              Caption Style
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {SUBTITLE_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSubtitleStyle(s.id)}
                  className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg transition-all ${
                    subtitleStyle === s.id
                      ? s.id === "none"
                        ? "bg-zinc-700/30 text-zinc-300 border border-zinc-600/40"
                        : "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.08]"
                  }`}
                >
                  <span className="text-[11px] font-medium">{s.name}</span>
                </button>
              ))}
            </div>
            {subtitleStyle !== "none" && (
              <p className="text-[10px] text-zinc-400 mt-1.5">
                {SUBTITLE_STYLES.find(s => s.id === subtitleStyle)?.preview}
              </p>
            )}
          </div>

          {/* Voiceover Toggle */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <Volume2 className="w-3 h-3" />
                AI Voiceover
              </label>
              <button
                onClick={() => setVoiceoverEnabled(!voiceoverEnabled)}
                className={`relative w-10 h-5 rounded-full transition-all duration-200 ${
                  voiceoverEnabled ? "bg-violet-500" : "bg-white/[0.12]"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                    voiceoverEnabled ? "left-5.5 translate-x-0.5" : "left-0.5"
                  }`}
                  style={{ left: voiceoverEnabled ? "22px" : "2px" }}
                />
              </button>
            </div>

            {voiceoverEnabled && (
              <div className="mt-3">
                <label className="block text-[10px] text-zinc-400 mb-1.5">Voice</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {VOICE_OPTIONS.slice(0, 6).map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setVoiceId(voice.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        voiceId === voice.id
                          ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.10]"
                      }`}
                    >
                      {voice.name}
                      <span className="ml-1 text-[10px] opacity-60">
                        {voice.gender === "female" ? "F" : "M"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Credit Breakdown & Generate ───────────────────────────── */}
      <Card className={!scenesGenerated ? "opacity-50 pointer-events-none" : "border-violet-500/20"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-amber-400" />
            Generate Your Product Ad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Credit breakdown */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Scenes ({sceneCount} x 15)</span>
              <span className="text-xs text-zinc-300">{sceneCost} credits</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Music</span>
              <span className="text-xs text-zinc-300">{musicCost} credits</span>
            </div>
            {voiceoverEnabled && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Voiceover</span>
                <span className="text-xs text-zinc-300">{voiceoverCost} credits</span>
              </div>
            )}
            {subtitleStyle !== "none" && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Captions ({subtitleStyle})</span>
                <span className="text-xs text-zinc-300">{captionsCost} credits</span>
              </div>
            )}
            <div className="h-px bg-white/[0.06] my-1" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-200">Total</span>
              <span className="text-sm font-bold text-amber-400">{totalCreditCost} credits</span>
            </div>
            {!hasEnoughCredits && !user?.isOwner && (
              <p className="text-[11px] text-red-400 mt-1">
                Insufficient credits. You have {user?.creditBalance ?? 0}.
              </p>
            )}
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            loading={isGenerating}
            className="w-full h-14 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-500 hover:from-violet-500 hover:via-fuchsia-400 hover:to-amber-400 text-white font-semibold rounded-xl shadow-lg shadow-violet-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 text-base"
          >
            {!isPlanAllowed ? (
              <span className="flex items-center gap-2"><Lock className="w-4 h-4" />Upgrade to Create</span>
            ) : (
              <span className="flex items-center gap-2"><Play className="w-5 h-5" />Create Product Ad</span>
            )}
          </Button>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Progress & Result ─────────────────────────────────────── */}
      {(jobId || resultVideoUrl) && (
        <Card className={resultVideoUrl ? "border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.02] to-violet-500/[0.02]" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              {resultVideoUrl ? (
                <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Your Product Ad Is Ready</>
              ) : (
                <><Film className="w-4 h-4 text-violet-400" /> Creating Your Product Ad...</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {resultVideoUrl ? (
              <>
                <div className="rounded-xl overflow-hidden border border-white/[0.12] bg-black/30">
                  <video
                    src={resultVideoUrl}
                    className="w-full max-h-[480px] object-contain"
                    controls
                    autoPlay
                  />
                </div>
                <div className="flex gap-2">
                  <a
                    href={resultVideoUrl}
                    download={`product-ad-${jobId || "video"}.mp4`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 text-sm font-medium transition-colors border border-violet-500/20"
                  >
                    <Upload className="w-4 h-4 rotate-180" />
                    Download
                  </a>
                  <button
                    onClick={() => { setResultVideoUrl(null); setJobId(null); progress.reset(); }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] text-zinc-300 text-sm font-medium transition-colors border border-white/[0.10]"
                  >
                    <Sparkles className="w-4 h-4" />
                    Create Another
                  </button>
                </div>
              </>
            ) : (
              <GenerationProgress
                steps={progress.steps}
                percent={progress.percent}
                stageMessage={progress.stageMessage}
                timerActive={progress.isActive}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Mobile: Fixed Generate ──────────────────────────────────── */}
      <MobileActionBar>
        <Button
          className="w-full shadow-lg shadow-violet-600/20 h-12 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-500"
          disabled={!canGenerate || isGenerating}
          loading={isGenerating}
          onClick={handleGenerate}
        >
          {isGenerating ? "Creating your ad..." : !isPlanAllowed ? (
            <><Lock className="w-4 h-4" /> Upgrade to Create</>
          ) : (
            <><Play className="w-4 h-4" /> Create Product Ad — {totalCreditCost} cr</>
          )}
        </Button>
      </MobileActionBar>

      <div className="h-20 lg:hidden" />
    </PageTransition>
  );
}
