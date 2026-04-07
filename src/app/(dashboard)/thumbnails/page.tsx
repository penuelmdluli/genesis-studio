"use client";

import { useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
import { GenesisLoader } from "@/components/ui/genesis-loader";
import {
  ImageIcon,
  Download,
  Zap,
  Sparkles,
  Grid3X3,
} from "lucide-react";

const SIZES = [
  { value: "youtube", label: "YouTube", dimensions: "1280 x 720" },
  { value: "instagram", label: "Instagram", dimensions: "1080 x 1080" },
  { value: "tiktok", label: "TikTok", dimensions: "1080 x 1920" },
] as const;

const STYLES = [
  "Photorealistic",
  "Illustration",
  "3D Render",
  "Minimalist",
  "Bold Text",
] as const;

const VARIATION_OPTIONS = [1, 2, 4] as const;

type Size = (typeof SIZES)[number]["value"];
type Style = (typeof STYLES)[number];
type VariationCount = (typeof VARIATION_OPTIONS)[number];

interface GeneratedImage {
  id: string;
  url: string;
}

export default function ThumbnailsPage() {
  const { user, updateCreditBalance, setCreditPurchaseOpen } = useStore();
  const { toast } = useToast();

  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<Size>("youtube");
  const [style, setStyle] = useState<Style>("Photorealistic");
  const [variations, setVariations] = useState<VariationCount>(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const generateLockRef = useRef(false);

  const isLoading = !user;
  const creditCost = variations <= 2 ? 1 : 2;
  const hasEnoughCredits =
    user?.isOwner || (user?.creditBalance ?? 0) >= creditCost;

  const handleGenerate = async () => {
    if (generateLockRef.current) return;
    generateLockRef.current = true;

    setError(null);

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Please describe the thumbnail you want to generate.");
      generateLockRef.current = false;
      return;
    }
    if (trimmedPrompt.length < 5) {
      setError("Prompt is too short (min 5 characters).");
      generateLockRef.current = false;
      return;
    }
    if (trimmedPrompt.length > 1000) {
      setError("Prompt is too long (max 1000 characters).");
      generateLockRef.current = false;
      return;
    }
    if (isLoading) {
      setError("Loading account data... please wait.");
      generateLockRef.current = false;
      return;
    }
    if (!hasEnoughCredits) {
      setError(
        `Not enough credits. You need ${creditCost} but have ${user?.creditBalance ?? 0}.`
      );
      generateLockRef.current = false;
      return;
    }

    setIsGenerating(true);
    setGeneratedImages([]);

    try {
      const res = await fetch("/api/thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          size,
          style,
          count: variations,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        updateCreditBalance((user?.creditBalance ?? 0) - data.creditsCost);
        toast("Thumbnails are being generated!", "success");

        // Poll for results if jobId is returned
        if (data.images) {
          setGeneratedImages(
            data.images.map((img: string, i: number) => ({
              id: `thumb-${Date.now()}-${i}`,
              url: img,
            }))
          );
        }
      } else {
        setError(data.error || "Generation failed. Please try again.");
        toast(data.error || "Generation failed", "error");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      toast("Network error. Please try again.", "error");
    } finally {
      setIsGenerating(false);
      generateLockRef.current = false;
    }
  };

  const handleDownload = async (image: GeneratedImage, index: number) => {
    try {
      if (image.url.startsWith("data:")) {
        // Base64 data URI — download directly
        const link = document.createElement("a");
        link.href = image.url;
        link.download = `thumbnail-${size}-${index + 1}.jpg`;
        link.click();
      } else {
        // URL — proxy download
        const res = await fetch("/api/proxy-image?url=" + encodeURIComponent(image.url));
        if (!res.ok) throw new Error("Download failed");
        const blob = await res.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `thumbnail-${size}-${index + 1}.jpg`;
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch {
      window.open(image.url, "_blank");
      toast("Opening image in new tab for download", "info");
    }
  };

  return (
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">AI Thumbnails</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Generate eye-catching thumbnails for YouTube, Instagram, and TikTok
          with AI.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Controls */}
        <div className="lg:col-span-2 space-y-4">
          {/* Prompt */}
          <Card glow>
            <CardContent className="p-4 space-y-3">
              <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-violet-400" />
                Describe your thumbnail
              </label>
              <Textarea
                placeholder='e.g., "A dramatic YouTube thumbnail showing a red sports car drifting on a mountain road at sunset"'
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="text-base"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {prompt.length} / 1000 characters
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Size Selector */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <label className="text-sm font-medium text-zinc-300">
                Platform Size
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SIZES.map((s) => {
                  const isActive = size === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => setSize(s.value)}
                      className={`p-3 rounded-xl border text-left transition-all duration-200 press-effect ${
                        isActive
                          ? "border-violet-500/40 bg-violet-500/10 shadow-lg shadow-violet-500/5"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div
                        className={`text-sm font-medium ${isActive ? "text-violet-300" : "text-zinc-300"}`}
                      >
                        {s.label}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {s.dimensions}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Style Selector */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <label className="text-sm font-medium text-zinc-300">Style</label>
              <div className="flex gap-2 flex-wrap">
                {STYLES.map((s) => {
                  const isActive = style === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={`px-3 py-2 rounded-xl border text-sm transition-all duration-200 press-effect ${
                        isActive
                          ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
                          : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/[0.1] hover:bg-white/[0.04]"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Variation Count */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <Grid3X3 className="w-4 h-4 text-violet-400" />
                Number of Variations
              </label>
              <div className="grid grid-cols-3 gap-2">
                {VARIATION_OPTIONS.map((v) => {
                  const isActive = variations === v;
                  const cost = v <= 2 ? 1 : 2;
                  return (
                    <button
                      key={v}
                      onClick={() => setVariations(v)}
                      className={`p-3 rounded-xl border text-center transition-all duration-200 press-effect ${
                        isActive
                          ? "border-violet-500/40 bg-violet-500/10 shadow-lg shadow-violet-500/5"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div
                        className={`text-lg font-bold ${isActive ? "text-violet-300" : "text-zinc-300"}`}
                      >
                        {v}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {v === 1 ? "image" : "images"} &middot; {cost}{" "}
                        {cost === 1 ? "credit" : "credits"}
                      </div>
                    </button>
                  );
                })}
              </div>
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
                  {
                    label: "Platform",
                    value:
                      SIZES.find((s) => s.value === size)?.label || "YouTube",
                  },
                  {
                    label: "Dimensions",
                    value:
                      SIZES.find((s) => s.value === size)?.dimensions ||
                      "1280 x 720",
                  },
                  { label: "Style", value: style },
                  {
                    label: "Variations",
                    value: `${variations} ${variations === 1 ? "image" : "images"}`,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between items-center"
                  >
                    <span className="text-zinc-500">{row.label}</span>
                    <span className="text-zinc-200">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/[0.06] pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-zinc-300">
                    Cost
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-violet-400" />
                    <span className="text-xl font-bold text-violet-300">
                      {creditCost}
                    </span>
                    <span className="text-xs text-zinc-500">credits</span>
                  </div>
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-zinc-500">Your balance</span>
                  <span
                    className={`text-xs font-semibold ${hasEnoughCredits ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {`${user?.creditBalance?.toLocaleString() ?? 0} credits`}
                  </span>
                </div>
              </div>

              <Button
                className="w-full shadow-lg shadow-violet-600/20"
                size="lg"
                disabled={
                  !prompt.trim() || isGenerating || isLoading || !hasEnoughCredits
                }
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
                    <Sparkles className="w-4 h-4" /> Generate Thumbnails
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
                  You need {creditCost - (user?.creditBalance ?? 0)} more
                  credits.{" "}
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

      {/* Generated Images Grid */}
      {generatedImages.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-100">
            Generated Thumbnails
          </h2>
          <div
            className={`grid gap-4 ${
              generatedImages.length === 1
                ? "grid-cols-1 max-w-2xl"
                : generatedImages.length === 2
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-2"
            }`}
          >
            {generatedImages.map((image, index) => (
              <Card key={image.id}>
                <CardContent className="p-3 space-y-3">
                  <div className="relative rounded-lg overflow-hidden border border-white/[0.06] bg-[#0D0D14]">
                    <img
                      src={image.url}
                      alt={`Generated thumbnail ${index + 1}`}
                      className="w-full h-auto object-contain"
                      crossOrigin="anonymous"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-zinc-300 hover:text-violet-300"
                    onClick={() => handleDownload(image, index)}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Download
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Mobile: Fixed Generate button at bottom */}
      <MobileActionBar>
        <Button
          className="w-full shadow-lg shadow-violet-600/20"
          disabled={!prompt.trim() || isGenerating || isLoading || !hasEnoughCredits}
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
              <Sparkles className="w-4 h-4" /> Generate Thumbnails
            </>
          )}
        </Button>
      </MobileActionBar>

      {/* Processing State */}
      {isGenerating && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
            <GenesisLoader size="lg" />
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-200">
                Generating your thumbnails...
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                This usually takes 10-30 seconds
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spacer for mobile action bar */}
      <div className="h-20 lg:hidden" />
    </PageTransition>
  );
}
