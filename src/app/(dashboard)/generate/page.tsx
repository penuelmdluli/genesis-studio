"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/hooks/use-store";
import { AI_MODELS, RESOLUTIONS, DURATIONS, FPS_OPTIONS, MODEL_ACCESS } from "@/lib/constants";
import { estimateCreditCost } from "@/lib/utils";
import { ModelId, GenerationType } from "@/types";
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
  Loader2,
} from "lucide-react";

const TYPE_OPTIONS: { value: GenerationType; label: string; icon: typeof Film; desc: string }[] = [
  { value: "t2v", label: "Text to Video", icon: Film, desc: "Generate from text prompt" },
  { value: "i2v", label: "Image to Video", icon: ImageIcon, desc: "Animate a still image" },
  { value: "v2v", label: "Video to Video", icon: RefreshCw, desc: "Style transfer & retarget" },
];

export default function GeneratePage() {
  const { form, setFormField, user, addJob, updateCreditBalance } = useStore();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inputImagePreview, setInputImagePreview] = useState<string | null>(null);

  const userPlan = user?.plan || "free";
  const availableModels = MODEL_ACCESS[userPlan] || MODEL_ACCESS.free;
  const currentModel = AI_MODELS[form.modelId];
  const creditCost = estimateCreditCost(form.modelId, form.resolution, form.duration, form.isDraft);
  const hasEnoughCredits = (user?.creditBalance ?? 0) >= creditCost;

  const availableResolutions = RESOLUTIONS.filter((r) => {
    const modelMaxRes = currentModel?.maxResolution;
    const resOrder = ["480p", "720p", "1080p", "4k"];
    return resOrder.indexOf(r.value) <= resOrder.indexOf(modelMaxRes || "720p");
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormField("inputImage", file);
      const reader = new FileReader();
      reader.onload = () => setInputImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!form.prompt.trim() || !hasEnoughCredits) return;

    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          modelId: form.modelId,
          prompt: form.prompt,
          negativePrompt: form.negativePrompt || undefined,
          resolution: form.resolution,
          duration: form.duration,
          fps: form.fps,
          seed: form.seed,
          guidanceScale: form.guidanceScale,
          numInferenceSteps: form.numInferenceSteps,
          isDraft: form.isDraft,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addJob({
          id: data.jobId,
          userId: user?.id || "",
          status: "queued",
          type: form.type,
          modelId: form.modelId,
          prompt: form.prompt,
          resolution: form.resolution,
          duration: form.duration,
          fps: form.fps,
          isDraft: form.isDraft,
          creditsCost: creditCost,
          progress: 0,
          createdAt: new Date().toISOString(),
        });
        updateCreditBalance((user?.creditBalance ?? 0) - creditCost);
      }
    } catch (err) {
      console.error("Generation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Generate Video</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Create AI-generated videos from text, images, or other videos.
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
                      className={`p-3 rounded-lg border text-left transition-all ${
                        isActive
                          ? "border-violet-500/50 bg-violet-500/10"
                          : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
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

          {/* Prompt */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <label className="text-sm font-medium text-zinc-300">Prompt</label>
              <Textarea
                placeholder="Describe your video... e.g., 'A majestic eagle soaring over snow-capped mountains at golden hour, cinematic 4K'"
                value={form.prompt}
                onChange={(e) => setFormField("prompt", e.target.value)}
                rows={4}
                className="text-base"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">{form.prompt.length} characters</span>
                <Button variant="ghost" size="sm" className="text-xs">
                  <Wand2 className="w-3 h-3" /> Enhance with AI
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Image Upload (for I2V) */}
          {form.type === "i2v" && (
            <Card>
              <CardContent className="p-4">
                <label className="text-sm font-medium text-zinc-300 block mb-2">
                  Input Image
                </label>
                {inputImagePreview ? (
                  <div className="relative">
                    <img
                      src={inputImagePreview}
                      alt="Input"
                      className="w-full max-h-64 object-contain rounded-lg border border-zinc-700"
                    />
                    <button
                      onClick={() => {
                        setInputImagePreview(null);
                        setFormField("inputImage", undefined as unknown as File);
                      }}
                      className="absolute top-2 right-2 p-1 rounded bg-black/60 text-zinc-300 hover:text-white"
                    >
                      &#x2715;
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed border-zinc-700 hover:border-violet-500/50 cursor-pointer transition-colors">
                    <Upload className="w-8 h-8 text-zinc-500 mb-2" />
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
                {availableModels.map((modelId) => {
                  const model = AI_MODELS[modelId];
                  if (!model) return null;
                  const isSelected = form.modelId === modelId;
                  const supportsType = model.types.includes(form.type);
                  const tierColors: Record<string, string> = {
                    flagship: "text-violet-400",
                    workhorse: "text-emerald-400",
                    speed: "text-amber-400",
                    turbo: "text-cyan-400",
                    realism: "text-pink-400",
                    budget: "text-indigo-400",
                  };

                  return (
                    <button
                      key={modelId}
                      onClick={() => supportsType && setFormField("modelId", modelId)}
                      disabled={!supportsType}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        !supportsType
                          ? "opacity-40 cursor-not-allowed border-zinc-800"
                          : isSelected
                          ? "border-violet-500/50 bg-violet-500/10"
                          : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-xs font-bold uppercase ${tierColors[model.tier] || "text-zinc-400"}`}>
                          {model.tier}
                        </span>
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">Resolution</label>
                  <Select
                    value={form.resolution}
                    onChange={(e) => setFormField("resolution", e.target.value)}
                  >
                    {availableResolutions.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">Duration</label>
                  <Select
                    value={form.duration.toString()}
                    onChange={(e) => setFormField("duration", parseInt(e.target.value))}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>{d}s</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">FPS</label>
                  <Select
                    value={form.fps.toString()}
                    onChange={(e) => setFormField("fps", parseInt(e.target.value))}
                  >
                    {FPS_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f} fps</option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Draft Mode Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <div>
                  <div className="text-sm font-medium text-amber-300">Draft Mode</div>
                  <div className="text-xs text-zinc-500">Fast preview, 70% cheaper. Refine later.</div>
                </div>
                <button
                  onClick={() => setFormField("isDraft", !form.isDraft)}
                  className={`w-11 h-6 rounded-full transition-colors ${
                    form.isDraft ? "bg-amber-500" : "bg-zinc-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      form.isDraft ? "translate-x-5.5" : "translate-x-0.5"
                    }`}
                    style={{ transform: form.isDraft ? "translateX(22px)" : "translateX(2px)" }}
                  />
                </button>
              </div>

              {/* Advanced Settings */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
              >
                <Settings2 className="w-3 h-3" />
                Advanced Settings
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-3 gap-4 pt-2 border-t border-zinc-800">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1.5">Seed</label>
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
                    <label className="text-xs text-zinc-400 block mb-1.5">Guidance Scale</label>
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
                    <label className="text-xs text-zinc-400 block mb-1.5">Inference Steps</label>
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

          {/* Negative Prompt */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <label className="text-sm font-medium text-zinc-300">
                Negative Prompt <span className="text-zinc-600">(optional)</span>
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

        {/* Right Column: Summary & Generate */}
        <div className="space-y-4">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Generation Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Type</span>
                  <span className="text-zinc-200 capitalize">
                    {form.type === "t2v" ? "Text to Video" : form.type === "i2v" ? "Image to Video" : "Video to Video"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Model</span>
                  <span className="text-zinc-200">{currentModel?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Resolution</span>
                  <span className="text-zinc-200">{form.resolution}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Duration</span>
                  <span className="text-zinc-200">{form.duration}s @ {form.fps}fps</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Mode</span>
                  <Badge variant={form.isDraft ? "amber" : "violet"}>
                    {form.isDraft ? "Draft" : "Full Quality"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Est. Time</span>
                  <span className="text-zinc-200">
                    ~{Math.round((currentModel?.avgGenerationTime || 60) * (form.isDraft ? 0.3 : 1))}s
                  </span>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-zinc-300">Cost</span>
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4 text-violet-400" />
                    <span className="text-lg font-bold text-violet-300">{creditCost}</span>
                    <span className="text-xs text-zinc-500">credits</span>
                  </div>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-zinc-500">Your balance</span>
                  <span className={`text-xs font-medium ${hasEnoughCredits ? "text-emerald-400" : "text-red-400"}`}>
                    {user?.creditBalance?.toLocaleString() ?? 50} credits
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={!form.prompt.trim() || !hasEnoughCredits || isGenerating}
                loading={isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating ? (
                  "Generating..."
                ) : !hasEnoughCredits ? (
                  "Not enough credits"
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Generate Video
                  </>
                )}
              </Button>

              {!hasEnoughCredits && (
                <p className="text-xs text-center text-red-400">
                  You need {creditCost - (user?.creditBalance ?? 0)} more credits.{" "}
                  <a href="/pricing" className="underline">Buy credits</a>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
