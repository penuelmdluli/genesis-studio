"use client";

import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
import { GenerationOrb } from "@/components/ui/lazy-video";
import {
  Sparkles,
  Image as ImageIcon,
  Download,
  Wand2,
  Zap,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { GenesisLoader, GenesisButtonLoader } from "@/components/ui/genesis-loader";

type AspectRatioOption = "landscape" | "portrait" | "square";

const ASPECT_OPTIONS: { value: AspectRatioOption; label: string; icon: typeof Square }[] = [
  { value: "landscape", label: "Landscape", icon: RectangleHorizontal },
  { value: "portrait", label: "Portrait", icon: RectangleVertical },
  { value: "square", label: "Square", icon: Square },
];

const IMAGE_SUGGESTIONS = [
  "A cyberpunk cityscape at night with neon reflections in rain puddles, ultra detailed",
  "African savanna at golden hour, elephants silhouetted against a vibrant sunset",
  "Futuristic South African market with holographic signs and traditional crafts",
  "Portrait of a young entrepreneur, studio lighting, professional headshot",
  "Underwater coral reef teeming with colorful fish, crystal clear water",
  "Abstract art with flowing purple and gold gradients, silk-like texture",
];

function ImageCard({ url, index, onDownload }: { url: string; index: number; onDownload: (url: string, index: number) => void }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = () => {
    setError(false);
    setLoaded(false);
    setRetryCount((c) => c + 1);
  };

  const imgSrc = retryCount > 0 ? `${url}${url.includes("?") ? "&" : "?"}retry=${retryCount}` : url;

  return (
    <div className="relative group rounded-xl overflow-hidden border border-white/[0.06] bg-zinc-900/50">
      {/* Loading skeleton */}
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <GenesisLoader size="md" />
            <span className="text-xs text-zinc-500">Loading image...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10">
          <div className="flex flex-col items-center gap-3 p-4 text-center">
            <AlertCircle className="w-8 h-8 text-amber-400" />
            <p className="text-sm text-zinc-400">Image failed to load</p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        </div>
      )}

      <img
        src={imgSrc}
        alt={`Generated image ${index + 1}`}
        className={`w-full aspect-square object-cover transition-opacity duration-300 ${loaded && !error ? "opacity-100" : "opacity-0"}`}
        onLoad={() => { setLoaded(true); setError(false); }}
        onError={() => { setError(true); setLoaded(false); }}
        crossOrigin="anonymous"
      />

      {/* Download overlay */}
      {loaded && !error && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={() => onDownload(url, index)}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Download className="w-5 h-5 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ImagesPage() {
  const { user, updateCreditBalance } = useStore();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>("landscape");
  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const generateLockRef = useRef(false);

  const creditCost = 10;
  const hasEnoughCredits = user?.isOwner || (user?.creditBalance ?? 0) >= creditCost;

  const handleEnhance = async () => {
    if (isEnhancing || !prompt.trim()) return;
    setIsEnhancing(true);
    try {
      const res = await fetch("/api/prompt/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, type: "image" }),
      });
      if (res.ok) {
        const { enhanced } = await res.json();
        setPrompt(enhanced);
        toast("Prompt enhanced!", "success");
      }
    } catch {}
    setIsEnhancing(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating || generateLockRef.current) return;
    generateLockRef.current = true;
    setIsGenerating(true);
    setImages([]);
    setGenerationError(null);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), aspectRatio, numImages: 4 }),
      });

      const data = await res.json();
      if (res.ok && data.images?.length > 0) {
        setImages(data.images);
        updateCreditBalance((user?.creditBalance ?? 0) - creditCost);
        toast(`Generated ${data.images.length} images!`, "success");
      } else if (res.ok && (!data.images || data.images.length === 0)) {
        setGenerationError("No images were generated. Your credits have been refunded.");
        toast("No images generated. Credits refunded.", "error");
      } else {
        setGenerationError(data.error || "Generation failed. Please try again.");
        toast(data.error || "Generation failed", "error");
      }
    } catch {
      setGenerationError("Network error. Please check your connection and try again.");
      toast("Network error. Please try again.", "error");
    } finally {
      setIsGenerating(false);
      generateLockRef.current = false;
    }
  };

  const handleDownload = async (url: string, index: number) => {
    try {
      if (url.startsWith("data:")) {
        // Base64 data URI — download directly
        const res = await fetch(url);
        const blob = await res.blob();
        triggerDownload(blob, index);
      } else {
        // URL — proxy download through our API
        const res = await fetch("/api/proxy-image?url=" + encodeURIComponent(url));
        if (!res.ok) throw new Error("Download failed");
        const blob = await res.blob();
        triggerDownload(blob, index);
      }
    } catch {
      window.open(url, "_blank");
      toast("Opening image in new tab for manual download", "info");
    }
  };

  const triggerDownload = (blob: Blob, index: number) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `genesis-image-${index + 1}.jpg`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast("Image downloaded!", "success");
  };

  return (
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-violet-400" />
          AI Image Generation
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Generate stunning images with FLUX Pro — 4 images per generation, 10 credits.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Prompt */}
          <Card glow>
            <CardContent className="p-4 space-y-3">
              <label className="text-sm font-medium text-zinc-300">Describe your image</label>
              <Textarea
                placeholder="A stunning photograph of..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="text-base"
              />

              {!prompt.trim() && (
                <div className="space-y-2">
                  <span className="text-xs text-zinc-500">Try a suggestion:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {IMAGE_SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setPrompt(s)}
                        className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-zinc-400 hover:text-violet-300 hover:border-violet-500/30 transition-all line-clamp-1 max-w-[280px] text-left"
                      >
                        {s.length > 60 ? s.slice(0, 60) + "..." : s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">{prompt.length} characters</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-violet-400 hover:text-violet-300"
                  onClick={handleEnhance}
                  disabled={isEnhancing || !prompt.trim()}
                >
                  {isEnhancing ? <GenesisButtonLoader /> : <Wand2 className="w-3 h-3" />}
                  {isEnhancing ? "Enhancing..." : "Enhance with AI"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Aspect Ratio */}
          <Card>
            <CardContent className="p-4">
              <label className="text-sm font-medium text-zinc-300 block mb-2">Aspect Ratio</label>
              <div className="grid grid-cols-3 gap-2">
                {ASPECT_OPTIONS.map((opt) => {
                  const isActive = aspectRatio === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setAspectRatio(opt.value)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isActive
                          ? "border-violet-500/40 bg-violet-500/10"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
                      }`}
                    >
                      <opt.icon className={`w-5 h-5 mx-auto mb-1 ${isActive ? "text-violet-400" : "text-zinc-500"}`} />
                      <div className={`text-sm ${isActive ? "text-violet-300" : "text-zinc-400"}`}>{opt.label}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Generating state */}
          {isGenerating && (
            <Card>
              <CardContent className="p-8">
                <GenerationOrb
                  text="Generating your images..."
                  eta="~10-15 seconds"
                />
                {/* Skeleton grid */}
                <div className="grid grid-cols-2 gap-3 w-full mt-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="aspect-square rounded-xl bg-zinc-800/50 animate-pulse border border-white/[0.04]" />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generation error */}
          {generationError && !isGenerating && images.length === 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-300 font-medium">Generation Failed</p>
                    <p className="text-sm text-zinc-400 mt-1">{generationError}</p>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || !prompt.trim()}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs font-medium transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Try Again
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generated Images */}
          {images.length > 0 && !isGenerating && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-zinc-300">Generated Images</label>
                  <span className="text-xs text-zinc-500">{images.length} images — hover to download</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {images.map((url, i) => (
                    <ImageCard key={i} url={url} index={i} onDownload={handleDownload} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar — hidden on mobile */}
        <div className="hidden lg:block">
          <Card glow className="sticky top-6">
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Model</span>
                  <span className="text-zinc-200">FLUX Pro v1.1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Output</span>
                  <span className="text-zinc-200">4 images</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Aspect Ratio</span>
                  <span className="text-zinc-200 capitalize">{aspectRatio}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Cost</span>
                  <span className="text-violet-300 font-bold">{creditCost} credits</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Your balance</span>
                  <span className={hasEnoughCredits ? "text-emerald-400" : "text-red-400"}>
                    {user?.creditBalance?.toLocaleString() ?? 0} credits
                  </span>
                </div>
              </div>

              <Button
                className="w-full shadow-lg shadow-violet-600/20"
                size="lg"
                disabled={!prompt.trim() || isGenerating || !hasEnoughCredits}
                loading={isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating ? (
                  "Generating..."
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Generate 4 Images
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
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
            className="flex-1 max-w-[200px] shadow-lg shadow-violet-600/20"
            disabled={!prompt.trim() || isGenerating || !hasEnoughCredits}
            loading={isGenerating}
            onClick={handleGenerate}
          >
            {isGenerating ? "Generating..." : (
              <><Sparkles className="w-4 h-4" /> Generate</>
            )}
          </Button>
        </div>
      </MobileActionBar>

      {/* Spacer for mobile action bar */}
      <div className="h-20 lg:hidden" />
    </PageTransition>
  );
}
