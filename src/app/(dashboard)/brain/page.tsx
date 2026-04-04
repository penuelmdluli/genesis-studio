"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Modal } from "@/components/ui/modal";
import { VideoPlayer } from "@/components/ui/video-player";
import { PageTransition, StaggerGroup, StaggerItem, motion } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import {
  Brain,
  Sparkles,
  Zap,
  Film,
  Mic,
  Music,
  Subtitles,
  Play,
  Square,
  RefreshCw,
  Download,
  Share2,
  Edit3,
  Trash2,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  Clock,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Camera,
  Palette,
  Type,
  Wand2,
  ArrowRight,
  Monitor,
  Smartphone,
  SquareIcon,
  GripVertical,
  Copy,
  Save,
  History,
  Clapperboard,
} from "lucide-react";
import { VideoStyle, AspectRatio, ScenePlan, SceneDefinition, TransitionType, ModelId } from "@/types";
import { AI_MODELS } from "@/lib/constants";
import { formatDuration } from "@/lib/utils";

type BrainState = "input" | "planning" | "review" | "producing" | "completed" | "failed";

const STYLES: { value: VideoStyle; label: string; emoji: string }[] = [
  { value: "cinematic", label: "Cinematic", emoji: "🎬" },
  { value: "social", label: "Social", emoji: "📱" },
  { value: "commercial", label: "Commercial", emoji: "💼" },
  { value: "story", label: "Story", emoji: "📖" },
  { value: "meme", label: "Meme", emoji: "😂" },
  { value: "tutorial", label: "Tutorial", emoji: "📚" },
  { value: "documentary", label: "Documentary", emoji: "🎥" },
  { value: "music_video", label: "Music Video", emoji: "🎵" },
  { value: "explainer", label: "Explainer", emoji: "💡" },
  { value: "vlog", label: "Vlog", emoji: "🗣" },
];

const DURATIONS = [15, 30, 45, 60, 90, 120];

const EXAMPLE_CONCEPTS = [
  "30-second Instagram Reel for a coffee brand showing a barista making latte art in a cozy cafe",
  "60-second product launch for a sleek new tech gadget with futuristic visuals",
  "45-second motivational story about perseverance and never giving up",
  "15-second TikTok with dynamic transitions of city life at night",
];

const TRANSITION_OPTIONS: TransitionType[] = ["cut", "crossfade", "fade_black", "fade_white", "wipe_left", "wipe_right", "zoom_in", "zoom_out"];

export default function BrainStudioPage() {
  const { user } = useStore();
  const { toast } = useToast();

  // State
  const [brainState, setBrainState] = useState<BrainState>("input");
  const [concept, setConcept] = useState("");
  const [style, setStyle] = useState<VideoStyle>("cinematic");
  const [targetDuration, setTargetDuration] = useState(30);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("landscape");
  const [voiceover, setVoiceover] = useState(true);
  const [voiceoverLanguage, setVoiceoverLanguage] = useState("en-US");
  const [music, setMusic] = useState(true);
  const [captions, setCaptions] = useState(true);

  // Production state
  const [productionId, setProductionId] = useState<string | null>(null);
  const [plan, setPlan] = useState<ScenePlan | null>(null);
  const [totalCredits, setTotalCredits] = useState(0);
  const [progress, setProgress] = useState(0);
  const [sceneStatuses, setSceneStatuses] = useState<Array<{ sceneNumber: number; status: string; progress: number; outputVideoUrl?: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [outputVideoUrls, setOutputVideoUrls] = useState<Record<string, string> | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Loading states
  const [isPlanning, setIsPlanning] = useState(false);
  const [isProducing, setIsProducing] = useState(false);

  // Poll for production status
  const pollStatus = useCallback(async () => {
    if (!productionId) return;
    try {
      const res = await fetch(`/api/brain/status?id=${productionId}`);
      if (!res.ok) return;
      const data = await res.json();

      setProgress(data.progress);
      setSceneStatuses(data.scenes || []);

      if (data.status === "completed") {
        setBrainState("completed");
        setOutputVideoUrls(data.outputVideoUrls);
        setThumbnailUrl(data.thumbnailUrl);
        return true; // Stop polling
      } else if (data.status === "failed") {
        setBrainState("failed");
        setError(data.errorMessage || "Production failed");
        return true; // Stop polling
      }
    } catch {
      // Polling failure, continue
    }
    return false;
  }, [productionId]);

  useEffect(() => {
    if (brainState !== "producing" || !productionId) return;
    const interval = setInterval(async () => {
      const done = await pollStatus();
      if (done) clearInterval(interval);
    }, 3000);
    return () => clearInterval(interval);
  }, [brainState, productionId, pollStatus]);

  // Handlers
  const handlePlan = async () => {
    if (!concept.trim() || concept.length < 10) {
      toast("Concept must be at least 10 characters", "error");
      return;
    }

    setIsPlanning(true);
    setError(null);
    setBrainState("planning");

    try {
      const res = await fetch("/api/brain/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept,
          targetDuration,
          style,
          aspectRatio,
          voiceover,
          voiceoverLanguage,
          captions,
          music,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate plan");
      }

      setProductionId(data.productionId);
      setPlan(data.plan);
      setTotalCredits(data.totalCredits);
      setBrainState("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Planning failed");
      setBrainState("input");
      toast(err instanceof Error ? err.message : "Planning failed", "error");
    } finally {
      setIsPlanning(false);
    }
  };

  const handleProduce = async () => {
    if (!productionId || !plan) return;

    setIsProducing(true);
    setError(null);

    try {
      const res = await fetch("/api/brain/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId, plan }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start production");

      setBrainState("producing");
      setProgress(10);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Production failed");
      toast(err instanceof Error ? err.message : "Production failed", "error");
    } finally {
      setIsProducing(false);
    }
  };

  const handleCancel = async () => {
    if (!productionId) return;
    try {
      await fetch("/api/brain/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId }),
      });
      toast("Production cancelled. Credits refunded.", "success");
      setBrainState("input");
      setProductionId(null);
      setPlan(null);
    } catch {
      toast("Failed to cancel", "error");
    }
  };

  const handleEditScene = (sceneIndex: number, field: keyof SceneDefinition, value: unknown) => {
    if (!plan) return;
    const updated = { ...plan };
    updated.scenes = [...updated.scenes];
    updated.scenes[sceneIndex] = { ...updated.scenes[sceneIndex], [field]: value };
    setPlan(updated);
  };

  const handleRemoveScene = (sceneIndex: number) => {
    if (!plan || plan.scenes.length <= 1) return;
    const updated = { ...plan };
    updated.scenes = updated.scenes.filter((_, i) => i !== sceneIndex);
    updated.scenes.forEach((s, i) => (s.sceneNumber = i + 1));
    updated.totalDuration = updated.scenes.reduce((sum, s) => sum + s.duration, 0);
    setPlan(updated);
  };

  const handleAddScene = (afterIndex: number) => {
    if (!plan) return;
    const newScene: SceneDefinition = {
      sceneNumber: afterIndex + 2,
      description: "New scene",
      prompt: "Describe this scene...",
      negativePrompt: "",
      modelId: "wan-2.2",
      duration: 5,
      resolution: "720p",
      cameraMovement: "slow push-in",
      transitionIn: "crossfade",
      transitionOut: "crossfade",
    };
    const updated = { ...plan };
    updated.scenes = [...updated.scenes];
    updated.scenes.splice(afterIndex + 1, 0, newScene);
    updated.scenes.forEach((s, i) => (s.sceneNumber = i + 1));
    updated.totalDuration = updated.scenes.reduce((sum, s) => sum + s.duration, 0);
    setPlan(updated);
  };

  // Rough credit estimate before planning
  const estimatedCredits = Math.max(3, Math.ceil(targetDuration / 8)) * 10 + 2 + 3 +
    (voiceover ? 3 : 0) + (music ? 2 : 0) + (captions ? 1 : 0);

  const isLocked = !user || (!user.isOwner && user.plan === "free");

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="violet" className="animate-pulse-glow">
                <Brain className="w-3 h-3 mr-1" /> AI DIRECTOR
              </Badge>
              <Badge variant="default">NEW</Badge>
            </div>
            <h1 className="text-3xl font-bold gradient-text">Brain Studio</h1>
            <p className="text-zinc-500 mt-1">
              Type one concept. Get a finished multi-scene video.
            </p>
          </div>
          {brainState !== "input" && brainState !== "planning" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBrainState("input");
                setPlan(null);
                setProductionId(null);
                setError(null);
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> New Production
            </Button>
          )}
        </div>

        {/* Locked State */}
        {isLocked && (
          <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] to-transparent">
            <CardContent className="p-8 text-center">
              <Brain className="w-16 h-16 text-violet-400/50 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-zinc-200 mb-2">Unlock the AI Director</h2>
              <p className="text-zinc-500 mb-6 max-w-md mx-auto">
                Brain Studio creates multi-scene, directed videos with transitions, music, voiceover, and captions — all from one sentence.
              </p>
              <a href="/pricing">
                <Button className="shadow-lg shadow-violet-600/20">
                  <Sparkles className="w-4 h-4" /> Upgrade to Creator — $15/mo
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* ═══ STATE 1: INPUT ═══ */}
        {!isLocked && brainState === "input" && (
          <div className="space-y-6">
            <Card className="glass-strong">
              <CardContent className="p-6 space-y-6">
                {/* Concept */}
                <div>
                  <label className="text-sm font-medium text-zinc-300 mb-2 block">
                    Describe your video concept
                  </label>
                  <Textarea
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="Create a 30-second ad for my coffee brand showing a barista making latte art, customers enjoying it in a cozy cafe, and the logo at the end..."
                    className="min-h-[120px] text-base"
                    maxLength={5000}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-zinc-600">{concept.length}/5000</span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {EXAMPLE_CONCEPTS.map((ex, i) => (
                        <button
                          key={i}
                          onClick={() => setConcept(ex)}
                          className="text-[10px] px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-violet-500/30 transition-colors truncate max-w-[180px]"
                        >
                          {ex.slice(0, 40)}...
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Style + Duration + Aspect Ratio */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Style */}
                  <div>
                    <label className="text-xs text-zinc-500 font-medium mb-2 block">Style</label>
                    <div className="grid grid-cols-5 gap-1">
                      {STYLES.slice(0, 5).map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setStyle(s.value)}
                          className={`p-2 rounded-lg text-center text-xs transition-all ${
                            style === s.value
                              ? "bg-violet-500/15 border border-violet-500/30 text-violet-300"
                              : "bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <div className="text-lg mb-0.5">{s.emoji}</div>
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-5 gap-1 mt-1">
                      {STYLES.slice(5).map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setStyle(s.value)}
                          className={`p-2 rounded-lg text-center text-xs transition-all ${
                            style === s.value
                              ? "bg-violet-500/15 border border-violet-500/30 text-violet-300"
                              : "bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <div className="text-lg mb-0.5">{s.emoji}</div>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="text-xs text-zinc-500 font-medium mb-2 block">Duration</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {DURATIONS.map((d) => (
                        <button
                          key={d}
                          onClick={() => setTargetDuration(d)}
                          className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            targetDuration === d
                              ? "bg-violet-500/15 border border-violet-500/30 text-violet-300"
                              : "bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aspect Ratio */}
                  <div>
                    <label className="text-xs text-zinc-500 font-medium mb-2 block">Aspect Ratio</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { value: "landscape" as const, icon: Monitor, label: "16:9" },
                        { value: "portrait" as const, icon: Smartphone, label: "9:16" },
                        { value: "square" as const, icon: SquareIcon, label: "1:1" },
                      ].map((ar) => (
                        <button
                          key={ar.value}
                          onClick={() => setAspectRatio(ar.value)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all ${
                            aspectRatio === ar.value
                              ? "bg-violet-500/15 border border-violet-500/30 text-violet-300"
                              : "bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <ar.icon className="w-5 h-5" />
                          <span className="text-xs font-medium">{ar.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: "voiceover", icon: Mic, label: "Voiceover", state: voiceover, setter: setVoiceover, credits: 3 },
                    { key: "music", icon: Music, label: "Music", state: music, setter: setMusic, credits: 2 },
                    { key: "captions", icon: Subtitles, label: "Captions", state: captions, setter: setCaptions, credits: 1 },
                  ].map((toggle) => (
                    <button
                      key={toggle.key}
                      onClick={() => toggle.setter(!toggle.state)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        toggle.state
                          ? "bg-violet-500/15 border border-violet-500/30 text-violet-300"
                          : "bg-white/[0.03] border border-white/[0.06] text-zinc-500"
                      }`}
                    >
                      <toggle.icon className="w-4 h-4" />
                      {toggle.label}
                      {toggle.state && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      <span className="text-[10px] text-zinc-600">+{toggle.credits}cr</span>
                    </button>
                  ))}
                </div>

                {/* Language (if voiceover on) */}
                {voiceover && (
                  <div className="max-w-xs">
                    <label className="text-xs text-zinc-500 font-medium mb-1.5 block">Voiceover Language</label>
                    <Select
                      value={voiceoverLanguage}
                      onChange={(v) => setVoiceoverLanguage(v)}
                      options={[
                        { value: "en-US", label: "English (US)" },
                        { value: "en-GB", label: "English (UK)" },
                        { value: "es-ES", label: "Spanish" },
                        { value: "fr-FR", label: "French" },
                        { value: "de-DE", label: "German" },
                        { value: "zu-ZA", label: "Zulu" },
                        { value: "af-ZA", label: "Afrikaans" },
                      ]}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Card className="glass-strong">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-violet-400" />
                      <span className="text-sm text-zinc-400">Estimated cost:</span>
                      <span className="text-lg font-bold text-violet-300">~{estimatedCredits}</span>
                      <span className="text-xs text-zinc-500">credits</span>
                    </div>
                    <span className="text-xs text-zinc-600">|</span>
                    <span className="text-xs text-zinc-500">
                      ~{Math.ceil(targetDuration / 5)} scenes
                    </span>
                  </div>
                  <Button
                    size="lg"
                    onClick={handlePlan}
                    disabled={concept.length < 10 || isPlanning}
                    loading={isPlanning}
                    className="shadow-lg shadow-violet-600/20 px-8"
                  >
                    <Brain className="w-5 h-5" />
                    Generate Production Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══ STATE 2: PLANNING (Loading) ═══ */}
        {brainState === "planning" && (
          <Card className="glass-strong">
            <CardContent className="p-12 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 mx-auto mb-6"
              >
                <Brain className="w-16 h-16 text-violet-400" />
              </motion.div>
              <h2 className="text-xl font-bold text-zinc-200 mb-2">Genesis Brain is directing...</h2>
              <p className="text-zinc-500 mb-4">
                Writing your script, designing shots, selecting models, planning transitions
              </p>
              <div className="flex justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-violet-500"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ STATE 3: REVIEW (Shot List) ═══ */}
        {brainState === "review" && plan && (
          <div className="space-y-4">
            <Card className="glass-strong">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{plan.title}</CardTitle>
                  <p className="text-xs text-zinc-500 mt-1">
                    {plan.scenes.length} scenes | {plan.totalDuration}s total | {plan.overallStyle} style
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setBrainState("input")}>
                    <Edit3 className="w-4 h-4" /> Edit Concept
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Scene Cards */}
            <StaggerGroup className="space-y-3">
              {plan.scenes.map((scene, i) => (
                <StaggerItem key={i}>
                  <Card className="glass-strong hover:border-white/[0.12] transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Scene number */}
                        <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-300 font-bold text-sm shrink-0">
                          {scene.sceneNumber}
                        </div>

                        <div className="flex-1 min-w-0 space-y-3">
                          {/* Description */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-200 truncate">{scene.description}</span>
                            <Badge variant="default" className="text-[10px] shrink-0">{scene.modelId}</Badge>
                            <Badge variant="violet" className="text-[10px] shrink-0">{scene.duration}s</Badge>
                          </div>

                          {/* Prompt (editable) */}
                          <Textarea
                            value={scene.prompt}
                            onChange={(e) => handleEditScene(i, "prompt", e.target.value)}
                            className="min-h-[60px] text-xs"
                          />

                          {/* Controls row */}
                          <div className="flex flex-wrap gap-2">
                            <Select
                              value={scene.modelId}
                              onChange={(v) => handleEditScene(i, "modelId", v)}
                              options={Object.entries(AI_MODELS).map(([id, m]) => ({ value: id, label: m.name }))}
                            />
                            <Select
                              value={String(scene.duration)}
                              onChange={(v) => handleEditScene(i, "duration", parseInt(v))}
                              options={[3, 4, 5, 6, 7, 8, 10].map((d) => ({ value: String(d), label: `${d}s` }))}
                            />
                            <Select
                              value={scene.transitionOut}
                              onChange={(v) => handleEditScene(i, "transitionOut", v)}
                              options={TRANSITION_OPTIONS.map((t) => ({ value: t, label: t.replace("_", " ") }))}
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            onClick={() => handleAddScene(i)}
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            title="Add scene after"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveScene(i)}
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Remove scene"
                            disabled={plan.scenes.length <= 1}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerGroup>

            {/* Voiceover Script (if applicable) */}
            {voiceover && plan.voiceoverScript && (
              <Card className="glass-strong">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Mic className="w-4 h-4 text-violet-400" /> Voiceover Script
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={plan.voiceoverScript}
                    onChange={(e) => setPlan({ ...plan, voiceoverScript: e.target.value })}
                    className="min-h-[80px]"
                  />
                  <p className="text-xs text-zinc-600 mt-1">
                    {plan.voiceoverScript.split(/\s+/).length} words | ~{Math.ceil(plan.voiceoverScript.split(/\s+/).length / 150 * 60)}s speaking time
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Produce Button */}
            <Card className="glass-strong">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-violet-400" />
                      <span className="text-lg font-bold text-violet-300">{totalCredits}</span>
                      <span className="text-xs text-zinc-500">credits</span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {plan.scenes.length} scenes | {plan.totalDuration}s
                    </span>
                  </div>
                  <Button
                    size="lg"
                    onClick={handleProduce}
                    disabled={isProducing}
                    loading={isProducing}
                    className="shadow-lg shadow-violet-600/20 px-8"
                  >
                    <Clapperboard className="w-5 h-5" />
                    Produce Video ({totalCredits} credits)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══ STATE 4: PRODUCING ═══ */}
        {brainState === "producing" && (
          <div className="space-y-4">
            <Card className="glass-strong">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-zinc-200">Producing...</h2>
                  <Button variant="ghost" size="sm" onClick={handleCancel} className="text-red-400 hover:text-red-300">
                    <Square className="w-4 h-4" /> Cancel
                  </Button>
                </div>

                <Progress value={progress} className="mb-4" />
                <p className="text-sm text-zinc-500 text-center">{progress}% complete</p>
              </CardContent>
            </Card>

            {/* Scene Progress */}
            <StaggerGroup className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {sceneStatuses.map((scene) => (
                <StaggerItem key={scene.sceneNumber}>
                  <Card className="glass-strong">
                    <CardContent className="p-3 text-center">
                      <div className="text-sm font-medium text-zinc-400 mb-1">Scene {scene.sceneNumber}</div>
                      <Badge
                        variant={
                          scene.status === "completed" ? "emerald"
                            : scene.status === "processing" ? "cyan"
                            : scene.status === "failed" ? "red"
                            : "default"
                        }
                      >
                        {scene.status === "processing" && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                        {scene.status}
                      </Badge>
                      {scene.progress > 0 && scene.status !== "completed" && (
                        <Progress value={scene.progress} className="mt-2 h-1" />
                      )}
                    </CardContent>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        )}

        {/* ═══ STATE 5: COMPLETED ═══ */}
        {brainState === "completed" && outputVideoUrls && (
          <div className="space-y-4">
            <Card className="glass-strong overflow-hidden">
              <CardContent className="p-0">
                {outputVideoUrls[aspectRatio] || Object.values(outputVideoUrls)[0] ? (
                  <VideoPlayer
                    src={outputVideoUrls[aspectRatio] || Object.values(outputVideoUrls)[0]}
                    poster={thumbnailUrl || undefined}
                    title={plan?.title || concept.slice(0, 50)}
                    autoPlay
                    className={aspectRatio === "portrait" ? "aspect-[9/16] max-h-[70vh] mx-auto" : "aspect-video"}
                  />
                ) : (
                  <div className="aspect-video bg-black flex items-center justify-center">
                    <p className="text-zinc-500">Video processing...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={async () => {
                  const videoUrl = outputVideoUrls?.[aspectRatio] || Object.values(outputVideoUrls || {})[0];
                  if (!videoUrl) return;
                  try {
                    const res = await fetch(videoUrl);
                    const blob = await res.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = blobUrl;
                    a.download = `${(plan?.title || concept.slice(0, 50)).replace(/[^a-zA-Z0-9]/g, "_")}.mp4`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                    toast("Download started", "success");
                  } catch {
                    toast("Download failed", "error");
                  }
                }}
              >
                <Download className="w-4 h-4" /> Download
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  const shareUrl = window.location.origin + "/gallery";
                  await navigator.clipboard.writeText(shareUrl);
                  toast("Link copied to clipboard", "success");
                }}
              >
                <Share2 className="w-4 h-4" /> Share
              </Button>
              <Button variant="outline" onClick={() => setBrainState("review")}>
                <Edit3 className="w-4 h-4" /> Edit & Reproduce
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setBrainState("input");
                  setPlan(null);
                  setProductionId(null);
                }}
              >
                <Plus className="w-4 h-4" /> New Production
              </Button>
            </div>

            {/* Scene strip */}
            {sceneStatuses.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {sceneStatuses.filter(s => s.outputVideoUrl).map((scene) => (
                  <div key={scene.sceneNumber} className="shrink-0 w-32">
                    <div className="aspect-video rounded-lg bg-black overflow-hidden relative group cursor-pointer">
                      <video
                        src={scene.outputVideoUrl}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        onMouseEnter={(e) => { e.currentTarget.currentTime = 0; e.currentTarget.play().catch(() => {}); }}
                        onMouseLeave={(e) => e.currentTarget.pause()}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1 text-center">Scene {scene.sceneNumber}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ STATE 6: FAILED ═══ */}
        {brainState === "failed" && (
          <Card className="border-red-500/20 bg-gradient-to-br from-red-500/[0.04] to-transparent">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400/60 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-zinc-200 mb-2">Production Failed</h2>
              <p className="text-sm text-zinc-500 mb-2">{error || "Something went wrong."}</p>
              <p className="text-xs text-emerald-400 mb-6">Credits have been automatically refunded.</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setBrainState("review")}>
                  <Edit3 className="w-4 h-4" /> Edit Plan & Retry
                </Button>
                <Button variant="outline" onClick={() => setBrainState("input")}>
                  Start Over
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
