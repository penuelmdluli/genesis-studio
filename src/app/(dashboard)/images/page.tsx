"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import {
  Sparkles,
  Image as ImageIcon,
  Download,
  Loader2,
  Wand2,
  Square,
  RectangleHorizontal,
  RectangleVertical,
} from "lucide-react";

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

export default function ImagesPage() {
  const { user, updateCreditBalance } = useStore();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>("landscape");
  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);

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
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setImages([]);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), aspectRatio, numImages: 4 }),
      });

      const data = await res.json();
      if (res.ok) {
        setImages(data.images || []);
        updateCreditBalance((user?.creditBalance ?? 0) - creditCost);
        toast(`Generated ${data.images?.length || 0} images!`, "success");
      } else {
        toast(data.error || "Generation failed", "error");
      }
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (url: string, index: number) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `genesis-image-${index + 1}.jpg`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast("Download failed", "error");
    }
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
                  {isEnhancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
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

          {/* Generated Images */}
          {images.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <label className="text-sm font-medium text-zinc-300 block mb-3">Generated Images</label>
                <div className="grid grid-cols-2 gap-3">
                  {images.map((url, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden border border-white/[0.06]">
                      <img src={url} alt={`Generated ${i + 1}`} className="w-full aspect-square object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => handleDownload(url, i)}
                          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                        >
                          <Download className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div>
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
    </PageTransition>
  );
}
