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
import { VideoPlayer, CaptionCue } from "@/components/ui/video-player";
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
  Volume2,
} from "lucide-react";
import { GenesisLoader, GenesisButtonLoader } from "@/components/ui/genesis-loader";
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
  const [soundEffects, setSoundEffects] = useState(false);

  // Production state
  const [productionId, setProductionId] = useState<string | null>(null);
  const [plan, setPlan] = useState<ScenePlan | null>(null);
  const [totalCredits, setTotalCredits] = useState(0);
  const [progress, setProgress] = useState(0);
  const [sceneStatuses, setSceneStatuses] = useState<Array<{ sceneNumber: number; status: string; progress: number; outputVideoUrl?: string; modelId?: string; duration?: number; errorMessage?: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [outputVideoUrls, setOutputVideoUrls] = useState<Record<string, string> | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [captionCues, setCaptionCues] = useState<CaptionCue[]>([]);

  // Parse SRT time "HH:MM:SS,mmm" to seconds
  const parseSrtTime = (srt: string): number => {
    const parts = srt.split(/[:,]/);
    if (parts.length < 4) return 0;
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]) + parseInt(parts[3]) / 1000;
  };

  // Parse caption metadata from API into CaptionCue[]
  const parseCaptionsFromMetadata = (captionsUrlStr: string) => {
    try {
      const meta = typeof captionsUrlStr === "string" ? JSON.parse(captionsUrlStr) : captionsUrlStr;
      const entries = meta?.entries as Array<{ startTime: string; endTime: string; text: string }> | undefined;
      if (!entries || entries.length === 0) return;
      const cues: CaptionCue[] = entries.map((e) => ({
        startTime: typeof e.startTime === "number" ? e.startTime : parseSrtTime(e.startTime),
        endTime: typeof e.endTime === "number" ? e.endTime : parseSrtTime(e.endTime),
        text: e.text,
      }));
      setCaptionCues(cues);
    } catch {
      // Invalid caption data — skip silently
    }
  };

  // Loading states
  const [isPlanning, setIsPlanning] = useState(false);
  const [isProducing, setIsProducing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);

  // Restore in-progress production on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/brain/history?limit=1");
        if (!res.ok || cancelled) return;
        const { productions } = await res.json();
        if (cancelled || !productions?.length) return;

        const latest = productions[0];
        // Only restore if active or recently completed
        if (!["planning", "generating", "assembling", "review", "completed"].includes(latest.status)) return;

        // Fetch full status with plan and scenes
        const statusRes = await fetch(`/api/brain/status?id=${latest.id}`);
        if (!statusRes.ok || cancelled) return;
        const data = await statusRes.json();

        setProductionId(data.id);
        setConcept(data.concept || "");
        setStyle(data.style || "cinematic");
        setTargetDuration(data.targetDuration || 30);
        setTotalCredits(data.totalCredits || 0);
        setProgress(data.progress || 0);
        setSceneStatuses(data.scenes || []);

        if (data.plan) setPlan(data.plan);
        if (data.outputVideoUrls) setOutputVideoUrls(data.outputVideoUrls);
        if (data.thumbnailUrl) setThumbnailUrl(data.thumbnailUrl);
        if (data.captionsUrl) parseCaptionsFromMetadata(data.captionsUrl);

        if (data.status === "completed") {
          setBrainState("completed");
        } else if (data.status === "failed") {
          setBrainState("failed");
          setError(data.errorMessage || "Production failed");
        } else if (data.status === "review" || data.status === "planning") {
          setBrainState("review");
        } else {
          // generating or assembling — resume polling
          setBrainState("producing");
        }
      } catch {
        // Silent — just start fresh
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
        if (data.captionsUrl) parseCaptionsFromMetadata(data.captionsUrl);
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
          soundEffects,
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
        body: JSON.stringify({ productionId, plan, soundEffects }),
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
  const scenesEstimate = Math.max(3, Math.ceil(targetDuration / 8));
  const estimatedCredits = scenesEstimate * 10 + 2 + 3 +
    (voiceover ? 3 : 0) + (music ? 2 : 0) + (captions ? 1 : 0) +
    (soundEffects ? scenesEstimate * 30 : 0);

  const isLocked = !user || (!user.isOwner && user.plan === "free");

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="violet" className="animate-pulse-glow">
                <Brain className="w-3 h-3 mr-1" /> AI DIRECTOR
              </Badge>
              <Badge variant="default">NEW</Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Brain Studio</h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              Type one concept. Get a finished multi-scene video.
            </p>
          </div>
          {brainState !== "input" && brainState !== "planning" && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setBrainState("input");
                setPlan(null);
                setProductionId(null);
                setError(null);
              }}
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Production</span><span className="sm:hidden">New</span>
            </Button>
          )}
        </div>

        {/* Restoring in-progress production */}
        {isRestoring && (
          <Card className="border-violet-500/30 bg-violet-500/5">
            <CardContent className="flex items-center justify-center gap-3 py-12">
              <GenesisLoader size="sm" />
              <span className="text-zinc-400">Checking for in-progress productions...</span>
            </CardContent>
          </Card>
        )}

        {/* Locked State */}
        {!isRestoring && isLocked && (
          <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] to-transparent">
            <CardContent className="p-8 text-center">
              <Brain className="w-16 h-16 text-violet-400/50 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-zinc-200 mb-2">Unlock the AI Director</h2>
              <p className="text-zinc-500 mb-6 max-w-md mx-auto">
                Brain Studio creates multi-scene, directed videos with transitions, music, voiceover, and captions — all from one sentence.
              </p>
              <a href="/pricing">
                <Button className="shadow-lg shadow-violet-600/20">
                  <Sparkles className="w-4 h-4" /> Upgrade to Creator — $12/mo
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* ═══ STATE 1: INPUT ═══ */}
        {!isRestoring && !isLocked && brainState === "input" && (
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
                  </div>
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {EXAMPLE_CONCEPTS.slice(0, 3).map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => setConcept(ex)}
                        className="text-[10px] px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-violet-500/30 transition-colors truncate max-w-[200px]"
                      >
                        {ex.slice(0, 40)}...
                      </button>
                    ))}
                  </div>
                </div>

                {/* Style + Duration + Aspect Ratio */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Style */}
                  <div>
                    <label className="text-xs text-zinc-500 font-medium mb-2 block">Style</label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                      {STYLES.slice(0, 5).map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setStyle(s.value)}
                          className={`p-2 rounded-lg text-center text-[10px] sm:text-xs transition-all overflow-hidden ${
                            style === s.value
                              ? "bg-violet-500/15 border border-violet-500/30 text-violet-300"
                              : "bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <div className="text-base sm:text-lg mb-0.5">{s.emoji}</div>
                          <span className="truncate block">{s.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 mt-1">
                      {STYLES.slice(5).map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setStyle(s.value)}
                          className={`p-2 rounded-lg text-center text-[10px] sm:text-xs transition-all overflow-hidden ${
                            style === s.value
                              ? "bg-violet-500/15 border border-violet-500/30 text-violet-300"
                              : "bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <div className="text-base sm:text-lg mb-0.5">{s.emoji}</div>
                          <span className="truncate block">{s.label}</span>
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                  {[
                    { key: "voiceover", icon: Mic, label: "Voice", fullLabel: "Voiceover", state: voiceover, setter: setVoiceover, credits: 3 },
                    { key: "music", icon: Music, label: "Music", fullLabel: "Music", state: music, setter: setMusic, credits: 2 },
                    { key: "captions", icon: Subtitles, label: "Caps", fullLabel: "Captions", state: captions, setter: setCaptions, credits: 1 },
                    { key: "soundEffects", icon: Volume2, label: "SFX", fullLabel: "Sound Design", state: soundEffects, setter: setSoundEffects, credits: 30 },
                  ].map((toggle) => (
                    <button
                      key={toggle.key}
                      onClick={() => toggle.setter(!toggle.state)}
                      className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                        toggle.state
                          ? "bg-violet-500/15 border border-violet-500/30 text-violet-300"
                          : "bg-white/[0.03] border border-white/[0.06] text-zinc-500"
                      }`}
                    >
                      <toggle.icon className="w-4 h-4 shrink-0" />
                      <span className="sm:hidden">{toggle.label}</span>
                      <span className="hidden sm:inline">{toggle.fullLabel}</span>
                      {toggle.state && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      <span className="text-[10px] text-zinc-600 hidden sm:inline">+{toggle.credits}cr</span>
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
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-violet-400" />
                      <span className="text-xs sm:text-sm text-zinc-400">Est:</span>
                      <span className="text-base sm:text-lg font-bold text-violet-300">~{estimatedCredits}</span>
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
                    className="shadow-lg shadow-violet-600/20 w-full sm:w-auto sm:px-8"
                  >
                    <Brain className="w-5 h-5" />
                    <span className="sm:hidden">Generate Plan</span>
                    <span className="hidden sm:inline">Generate Production Plan</span>
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
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-sm sm:text-base truncate">{plan.title}</CardTitle>
                    <p className="text-[11px] sm:text-xs text-zinc-500 mt-1">
                      {plan.scenes.length} scenes | {plan.totalDuration}s | {plan.overallStyle}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setBrainState("input")}>
                    <Edit3 className="w-4 h-4" /> <span className="hidden sm:inline">Edit Concept</span><span className="sm:hidden">Edit</span>
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Scene Cards */}
            <StaggerGroup className="space-y-3">
              {plan.scenes.map((scene, i) => (
                <StaggerItem key={i}>
                  <Card className="glass-strong hover:border-white/[0.12] transition-colors">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-2 sm:gap-4">
                        {/* Scene number */}
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-300 font-bold text-xs sm:text-sm shrink-0">
                          {scene.sceneNumber}
                        </div>

                        <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                          {/* Description + badges */}
                          <div>
                            <p className="text-xs sm:text-sm font-medium text-zinc-200 truncate mb-1">{scene.description}</p>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="violet" className="text-[9px] sm:text-[10px] shrink-0">{scene.duration}s</Badge>
                            </div>
                          </div>

                          {/* Prompt (editable) */}
                          <Textarea
                            value={scene.prompt}
                            onChange={(e) => handleEditScene(i, "prompt", e.target.value)}
                            className="min-h-[50px] sm:min-h-[60px] text-xs"
                          />

                          {/* Controls row */}
                          <div className="grid grid-cols-1 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
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
                  <p className="text-xs text-zinc-600 mt-1 truncate">
                    {plan.voiceoverScript.split(/\s+/).length} words &middot; ~{Math.ceil(plan.voiceoverScript.split(/\s+/).length / 150 * 60)}s speaking time
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Produce Button */}
            <Card className="glass-strong">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-violet-400" />
                      <span className="text-base sm:text-lg font-bold text-violet-300">{totalCredits}</span>
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
                    className="shadow-lg shadow-violet-600/20 w-full sm:w-auto sm:px-8"
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
        {brainState === "producing" && (() => {
          const completedCount = sceneStatuses.filter(s => s.status === "completed").length;
          const totalCount = sceneStatuses.length || 1;
          const activeScene = sceneStatuses.find(s => s.status === "processing");
          const isAssembling = progress >= 70;
          const activeModel = activeScene?.modelId ? AI_MODELS[activeScene.modelId as ModelId] : null;
          const estMinutes = Math.max(1, Math.ceil((totalCount - completedCount) * 1.5));

          return (
          <div className="space-y-4">
            {/* Status Header */}
            <Card className="glass-strong border-violet-500/20 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600/5 via-transparent to-fuchsia-600/5" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                      <div className="absolute inset-0 w-3 h-3 rounded-full bg-red-500 animate-ping opacity-30" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-zinc-100">
                        {isAssembling ? "Assembling Final Video" : `Creating Scene ${completedCount + 1} of ${totalCount}`}
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {isAssembling
                          ? "Adding audio, merging scenes, finalizing..."
                          : activeModel
                            ? `Using ${activeModel.name}`
                            : "Generating with AI"}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleCancel} className="text-zinc-500 hover:text-red-400 transition-colors">
                    <Square className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Progress bar */}
                <div className="relative mb-2">
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-mono">{progress}%</span>
                  {!isAssembling && <span className="text-zinc-600">~{estMinutes} min remaining</span>}
                </div>
              </CardContent>
            </Card>

            {/* Scene Cards */}
            <div className="space-y-3">
              {sceneStatuses.map((scene) => {
                const scenePlan = plan?.scenes?.find((s: SceneDefinition) => s.sceneNumber === scene.sceneNumber);
                const model = scene.modelId ? AI_MODELS[scene.modelId as ModelId] : null;
                const isCompleted = scene.status === "completed";
                const isProcessing = scene.status === "processing";
                const isFailed = scene.status === "failed";
                const isQueued = !isCompleted && !isProcessing && !isFailed;

                return (
                  <Card
                    key={scene.sceneNumber}
                    className={`glass-strong overflow-hidden transition-all duration-500 ${
                      isProcessing ? "border-violet-500/30 shadow-lg shadow-violet-500/5" :
                      isCompleted ? "border-emerald-500/20" :
                      isFailed ? "border-red-500/20" :
                      "border-white/[0.06] opacity-75"
                    }`}
                  >
                    {/* Active scene glow */}
                    {isProcessing && (
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-600/[0.04] via-transparent to-fuchsia-600/[0.04] animate-pulse" />
                    )}

                    <CardContent className="p-0 relative">
                      <div className="flex">
                        {/* Video preview / status indicator */}
                        <div className={`w-36 sm:w-48 shrink-0 ${aspectRatio === "portrait" ? "aspect-[9/16]" : "aspect-video"} relative overflow-hidden bg-black/40`}>
                          {isCompleted && scene.outputVideoUrl ? (
                            <video
                              src={scene.outputVideoUrl}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              autoPlay
                              loop
                            />
                          ) : isProcessing ? (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/20 via-[#0D0D14] to-fuchsia-900/20">
                              <div className="relative">
                                <GenesisLoader size="md" />
                                <div className="absolute inset-0 w-8 h-8 rounded-full bg-violet-500/20 animate-ping" />
                              </div>
                            </div>
                          ) : isFailed ? (
                            <div className="w-full h-full flex items-center justify-center bg-red-950/20">
                              <X className="w-6 h-6 text-red-400/60" />
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900/40 via-[#0D0D14] to-zinc-800/20">
                              <div className="relative flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full border-2 border-zinc-700/50 border-t-violet-500/60 animate-spin" />
                                <Clock className="absolute w-3.5 h-3.5 text-zinc-500" />
                              </div>
                            </div>
                          )}

                          {/* Scene number overlay */}
                          <div className="absolute top-2 left-2">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold backdrop-blur-sm ${
                              isCompleted ? "bg-emerald-500/80 text-white" :
                              isProcessing ? "bg-violet-500/80 text-white" :
                              isFailed ? "bg-red-500/80 text-white" :
                              "bg-black/50 text-zinc-400"
                            }`}>
                              {isCompleted ? <Check className="w-3 h-3" /> : scene.sceneNumber}
                            </div>
                          </div>

                          {/* Duration badge */}
                          <div className="absolute bottom-2 right-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-zinc-300 font-mono backdrop-blur-sm">
                              {scene.duration || scenePlan?.duration || 5}s
                            </span>
                          </div>
                        </div>

                        {/* Scene info */}
                        <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-zinc-200 truncate">
                                {scenePlan?.description || `Scene ${scene.sceneNumber}`}
                              </h3>
                              <Badge
                                variant={isCompleted ? "emerald" : isProcessing ? "violet" : isFailed ? "red" : "default"}
                                className="shrink-0 text-[9px]"
                              >
                                {isCompleted ? "Ready" : isProcessing ? "Generating" : isFailed ? "Failed" : "In Queue"}
                              </Badge>
                            </div>
                            <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                              {scenePlan?.prompt?.slice(0, 120) || "..."}
                              {(scenePlan?.prompt?.length || 0) > 120 ? "..." : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {scenePlan?.cameraMovement && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-500 hidden sm:inline">
                                {scenePlan.cameraMovement}
                              </span>
                            )}
                            {isProcessing && scene.progress > 0 && (
                              <span className="text-[10px] font-mono text-violet-400">{scene.progress}%</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Processing progress bar */}
                      {isProcessing && (
                        <div className="h-0.5 bg-white/[0.04]">
                          <motion.div
                            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                            initial={{ width: "10%" }}
                            animate={{ width: `${Math.max(scene.progress, 20)}%` }}
                            transition={{ duration: 1 }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Post-Production Pipeline */}
            {isAssembling && (
              <Card className="glass-strong border-violet-500/10">
                <CardContent className="p-4">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Post-Production</h3>
                  <div className="space-y-2">
                    {[
                      { icon: Film, label: "Assembling scenes", done: progress >= 80 },
                      { icon: Mic, label: "Adding audio", done: progress >= 90 },
                      { icon: Music, label: "Mixing soundtrack", done: progress >= 95 },
                      { icon: Wand2, label: "Final rendering", done: progress >= 100 },
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          step.done ? "bg-emerald-500/20" :
                          progress >= (75 + i * 5) ? "bg-violet-500/20" :
                          "bg-white/[0.04]"
                        }`}>
                          {step.done ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : progress >= (75 + i * 5) ? (
                            <GenesisButtonLoader />
                          ) : (
                            <Clock className="w-3 h-3 text-zinc-600" />
                          )}
                        </div>
                        <span className={`text-sm ${step.done ? "text-zinc-300" : progress >= (75 + i * 5) ? "text-zinc-400" : "text-zinc-600"}`}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          );
        })()}

        {/* ═══ STATE 5: COMPLETED ═══ */}
        {brainState === "completed" && outputVideoUrls && (
          <div className="space-y-5">
            {/* Celebration header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clapperboard className="w-5 h-5 text-violet-400" />
                <h2 className="text-lg font-bold text-zinc-100">That&apos;s a Wrap!</h2>
              </div>
              <p className="text-xs text-zinc-500">{plan?.title || concept.slice(0, 60)}</p>
            </motion.div>

            {/* Main video with glow ring */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Card className="glass-strong overflow-hidden border-violet-500/20 shadow-xl shadow-violet-500/5">
                <CardContent className="p-0">
                  <div className="relative">
                    <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-violet-500/20 via-fuchsia-500/10 to-violet-500/20 blur-sm" />
                    <div className="relative">
                      {outputVideoUrls["final"] || outputVideoUrls[aspectRatio] || Object.values(outputVideoUrls)[0] ? (
                        <VideoPlayer
                          src={outputVideoUrls["final"] || outputVideoUrls[aspectRatio] || Object.values(outputVideoUrls)[0]}
                          poster={thumbnailUrl || undefined}
                          title={plan?.title || concept.slice(0, 50)}
                          autoPlay
                          captions={captionCues.length > 0 ? captionCues : undefined}
                          className={aspectRatio === "portrait" ? "aspect-[9/16] max-h-[70vh] mx-auto" : "aspect-video"}
                        />
                      ) : (
                        <div className="aspect-video bg-black flex items-center justify-center">
                          <p className="text-zinc-500">Video processing...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2"
            >
              <Button
                variant="primary"
                className="shadow-lg shadow-violet-600/20"
                onClick={async () => {
                  const videoUrl = outputVideoUrls?.["final"] || outputVideoUrls?.[aspectRatio] || Object.values(outputVideoUrls || {})[0];
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
            </motion.div>

            {/* Scene strip with hover-to-play */}
            {sceneStatuses.filter(s => s.outputVideoUrl).length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Individual Scenes</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                  {sceneStatuses.filter(s => s.outputVideoUrl).map((scene) => {
                    const scenePlan = plan?.scenes?.find((s: SceneDefinition) => s.sceneNumber === scene.sceneNumber);
                    return (
                      <div key={scene.sceneNumber} className="shrink-0 w-40 sm:w-48 group">
                        <div className="aspect-video rounded-xl bg-black overflow-hidden relative cursor-pointer ring-1 ring-white/[0.06] group-hover:ring-violet-500/30 transition-all">
                          <video
                            src={scene.outputVideoUrl}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            onMouseEnter={(e) => { e.currentTarget.currentTime = 0; e.currentTarget.play().catch(() => {}); }}
                            onMouseLeave={(e) => e.currentTarget.pause()}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                              <Play className="w-3.5 h-3.5 text-white ml-0.5" />
                            </div>
                          </div>
                          <div className="absolute top-1.5 left-1.5">
                            <div className="w-5 h-5 rounded-md bg-emerald-500/80 flex items-center justify-center backdrop-blur-sm">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          </div>
                          <div className="absolute bottom-1.5 right-1.5">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-zinc-300 font-mono backdrop-blur-sm">
                              {scene.duration || scenePlan?.duration || 5}s
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1.5 truncate px-0.5">
                          {scenePlan?.description || `Scene ${scene.sceneNumber}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
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
