"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
import {
  GenerationProgress,
  useGenerationProgress,
} from "@/components/ui/generation-progress";
import {
  Music2,
  Upload,
  X,
  Lock,
  Play,
  Sparkles,
  CheckCircle2,
  Monitor,
  Smartphone,
  SquareIcon,
  RectangleHorizontal,
  FileAudio,
  User,
  Zap,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

interface PlatformPreset {
  id: string;
  name: string;
  icon: typeof Monitor;
  aspectRatio: "16:9" | "9:16" | "1:1";
}

// ─── Data ────────────────────────────────────────────────────────────

const PLATFORM_PRESETS: PlatformPreset[] = [
  { id: "tiktok", name: "TikTok / Reels", icon: Smartphone, aspectRatio: "9:16" },
  { id: "youtube", name: "YouTube", icon: Monitor, aspectRatio: "16:9" },
  { id: "instagram", name: "Instagram", icon: SquareIcon, aspectRatio: "1:1" },
];

const GENRES = [
  { id: "hiphop", name: "Hip-Hop", emoji: "🎤", desc: "Bars, flow, attitude" },
  { id: "pop", name: "Pop", emoji: "🎵", desc: "Catchy, colorful, fun" },
  { id: "rnb", name: "R&B", emoji: "💜", desc: "Smooth, soulful, vibes" },
  { id: "rock", name: "Rock", emoji: "🎸", desc: "Raw energy, grit" },
  { id: "afrobeats", name: "Afrobeats", emoji: "🥁", desc: "Rhythm, dance, culture" },
  { id: "gospel", name: "Gospel", emoji: "🙏", desc: "Uplifting, powerful" },
  { id: "electronic", name: "Electronic", emoji: "🎧", desc: "Beats, synths, drops" },
  { id: "acoustic", name: "Acoustic", emoji: "🪕", desc: "Intimate, stripped-back" },
];

const ENERGY_LEVELS = [
  { id: "low", name: "Low", desc: "Ballad, emotional", color: "from-blue-500/20 to-blue-600/20" },
  { id: "medium", name: "Medium", desc: "Groove, steady", color: "from-green-500/20 to-green-600/20" },
  { id: "high", name: "High", desc: "Energetic, dance", color: "from-orange-500/20 to-orange-600/20" },
  { id: "explosive", name: "Explosive", desc: "Intense, max movement", color: "from-red-500/20 to-red-600/20" },
];

const STAGE_OPTIONS = [
  { id: "concert", name: "Concert Stage", desc: "Big lights, crowd silhouettes", emoji: "🎤" },
  { id: "studio", name: "Recording Studio", desc: "Mic, headphones, booth", emoji: "🎙️" },
  { id: "outdoor", name: "Outdoor / Nature", desc: "Golden hour, cinematic", emoji: "🌅" },
  { id: "neon-club", name: "Neon Club", desc: "Dark, neon lights, smoke", emoji: "🪩" },
  { id: "rooftop", name: "Rooftop", desc: "City skyline, night", emoji: "🌃" },
  { id: "abstract", name: "Abstract", desc: "Particles, colors, artistic", emoji: "🎨" },
  { id: "custom", name: "Custom", desc: "Describe your own", emoji: "✨" },
];

const SCENE_OPTIONS = [2, 3, 4, 5, 6];
const CREDITS_PER_SCENE = 20;

// ─── Component ───────────────────────────────────────────────────────

export default function MusicVideoPage() {
  const { user, updateCreditBalance, isInitialized } = useStore();
  const { toast } = useToast();
  const progress = useGenerationProgress();

  // Uploads
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);

  // Settings
  const [genre, setGenre] = useState("hiphop");
  const [energy, setEnergy] = useState("high");
  const [sceneCount, setSceneCount] = useState(4);
  const [stage, setStage] = useState("concert");
  const [customStage, setCustomStage] = useState("");

  // Platform
  const [selectedPlatform, setSelectedPlatform] = useState("tiktok");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("9:16");

  // Generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const faceInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const generateLockRef = useRef(false);

  const isLoading = !isInitialized;
  const userPlan = user?.plan || "free";
  const isPlanAllowed = userPlan === "creator" || userPlan === "pro" || userPlan === "studio" || !!user?.isOwner;

  // ─── Credit Calculation ───────────────────────────────────────────

  const totalCreditCost = sceneCount * CREDITS_PER_SCENE;
  const totalDuration = sceneCount * 5;
  const hasEnoughCredits = user?.isOwner || (user?.creditBalance ?? 0) >= totalCreditCost;

  // ─── Face Upload ──────────────────────────────────────────────────

  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("Image too large (max 10MB)", "error");
      return;
    }
    setFaceFile(file);
    const reader = new FileReader();
    reader.onload = () => setFacePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFaceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("Image too large (max 10MB)", "error");
      return;
    }
    setFaceFile(file);
    const reader = new FileReader();
    reader.onload = () => setFacePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeFace = () => {
    setFaceFile(null);
    setFacePreview(null);
  };

  // ─── Music Upload ─────────────────────────────────────────────────

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast("Audio too large (max 50MB)", "error");
      return;
    }
    setMusicFile(file);
  };

  const handleMusicDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const validTypes = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav", "audio/wave"];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav)$/i)) {
      toast("Please upload an MP3 or WAV file", "error");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast("Audio too large (max 50MB)", "error");
      return;
    }
    setMusicFile(file);
  };

  const removeMusic = () => {
    setMusicFile(null);
  };

  // ─── Platform Selection ───────────────────────────────────────────

  const handleSelectPlatform = (p: PlatformPreset) => {
    setSelectedPlatform(p.id);
    setAspectRatio(p.aspectRatio);
  };

  // ─── Generate ─────────────────────────────────────────────────────

  const canGenerate =
    faceFile &&
    musicFile &&
    hasEnoughCredits &&
    isPlanAllowed &&
    !isLoading;

  const handleGenerate = async () => {
    if (generateLockRef.current) return;
    generateLockRef.current = true;
    setError(null);
    setResultVideoUrl(null);
    setJobId(null);

    if (!faceFile) { setError("Please upload a face photo."); generateLockRef.current = false; return; }
    if (!musicFile) { setError("Please upload a song."); generateLockRef.current = false; return; }
    if (!hasEnoughCredits) { setError(`Need ${totalCreditCost} credits, have ${user?.creditBalance ?? 0}.`); generateLockRef.current = false; return; }

    setIsGenerating(true);

    // Build progress steps
    const progressSteps = [
      "Uploading files",
      ...Array.from({ length: sceneCount }, (_, i) => `Generating scene ${i + 1}/${sceneCount}`),
      "Assembling video",
      "Done!",
    ];
    progress.start(progressSteps);

    try {
      const { uploadFile } = await import("@/lib/upload-client");

      // Upload face
      toast("Uploading face photo...", "info");
      const faceUrl = await uploadFile(faceFile, "image");

      // Upload music
      toast("Uploading song...", "info");
      const musicUrl = await uploadFile(musicFile, "audio");

      progress.advanceStep("Generating scenes...");
      progress.setProgress(15);

      const res = await fetch("/api/music-video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceUrl,
          musicUrl,
          genre,
          energy,
          sceneCount,
          stage: stage === "custom" ? customStage : stage,
          aspectRatio,
          platform: selectedPlatform,
        }),
      });

      const data = await res.json();

      if (res.ok && data.jobId) {
        setJobId(data.jobId);
        updateCreditBalance((user?.creditBalance ?? 0) - (data.creditsCost || totalCreditCost));
        toast("Music video generation started!", "success");
        progress.setProgress(20, "Generating scenes...");
      } else {
        setError(data.error || "Generation failed.");
        toast(data.error || "Generation failed", "error");
        progress.fail(data.error || "Generation failed");
      }
    } catch (err) {
      console.error("Music video generation failed:", err);
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

      const totalSteps = sceneCount + 2;
      const progressPct = Math.min(20 + pollCount * (60 / totalSteps), 90);
      progress.setProgress(progressPct);

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
          progress.complete("Your music video is ready!");
          toast("Your music video is ready!", "success");
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

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <PageTransition className="space-y-6">
      {/* ─── Hero Section ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 via-pink-600/15 to-amber-500/10 border border-violet-500/20 p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(236,72,153,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(168,85,247,0.06),transparent_50%)]" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-pink-500 to-amber-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Music2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Music Video Creator</h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Upload a face and a song — AI creates a cinematic music video with perfect lip-sync
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {["Multi-angle shots", "Beat-matched cuts", "Genre-specific motion", "Studio quality"].map(chip => (
              <span
                key={chip}
                className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.10] text-[11px] text-zinc-300 font-medium"
              >
                {chip}
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
                  Upgrade to create AI music videos — starts at R220/month.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 1: Upload Section ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white">1</div>
            Upload Face & Song
            {faceFile && musicFile && (
              <span className="text-[10px] text-emerald-400 font-normal ml-auto">Ready</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Face Upload */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                <User className="w-3 h-3 inline mr-1" />
                Face / Character Photo <span className="text-red-400">*</span>
              </label>
              {facePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-white/[0.12] bg-black/30 aspect-square">
                  <img src={facePreview} alt="Face" className="w-full h-full object-cover" />
                  <button
                    onClick={removeFace}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-red-500/80 text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-white/10 hover:border-pink-500/40 bg-white/[0.04] hover:bg-pink-500/5 cursor-pointer transition-all duration-300 group"
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={handleFaceDrop}
                >
                  <input
                    ref={faceInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFaceUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-2 group-hover:bg-pink-500/20 transition-colors">
                    <User className="w-6 h-6 text-pink-400" />
                  </div>
                  <span className="text-sm font-medium text-zinc-400 group-hover:text-pink-300 transition-colors">
                    Drop face photo or click
                  </span>
                  <span className="text-xs text-zinc-500 mt-1">PNG, JPEG, WebP — max 10MB</span>
                </label>
              )}
            </div>

            {/* Music Upload */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                <FileAudio className="w-3 h-3 inline mr-1" />
                Song / Music <span className="text-red-400">*</span>
              </label>
              {musicFile ? (
                <div className="relative flex flex-col items-center justify-center h-48 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                  <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center mb-3">
                    <Music2 className="w-6 h-6 text-violet-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-200 text-center truncate max-w-full px-2">
                    {musicFile.name}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {(musicFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                  <button
                    onClick={removeMusic}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-red-500/80 text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 bg-white/[0.04] hover:bg-violet-500/5 cursor-pointer transition-all duration-300 group"
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={handleMusicDrop}
                >
                  <input
                    ref={musicInputRef}
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/mp3,.mp3,.wav"
                    onChange={handleMusicUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-2 group-hover:bg-violet-500/20 transition-colors">
                    <Music2 className="w-6 h-6 text-violet-400" />
                  </div>
                  <span className="text-sm font-medium text-zinc-400 group-hover:text-violet-300 transition-colors">
                    Drop your song or click
                  </span>
                  <span className="text-xs text-zinc-500 mt-1">MP3, WAV — max 50MB</span>
                </label>
              )}
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
            <Sparkles className="w-3 h-3 inline mr-1 text-pink-400" />
            Clear front-facing photo works best. The AI will animate this person singing your song.
          </p>
        </CardContent>
      </Card>

      {/* ─── STEP 2: Performance Settings ─────────────────────────── */}
      <Card className={!faceFile || !musicFile ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white">2</div>
            Performance Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Genre */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Genre</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGenre(g.id)}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl text-left transition-all duration-200 ${
                    genre === g.id
                      ? "bg-pink-500/15 border border-pink-500/40 ring-1 ring-pink-500/20 shadow-lg shadow-pink-500/10"
                      : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-pink-500/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{g.emoji}</span>
                    <span className={`text-xs font-semibold ${genre === g.id ? "text-pink-300" : "text-zinc-300"}`}>
                      {g.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400">{g.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Energy Level */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Energy Level</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ENERGY_LEVELS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setEnergy(e.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-200 ${
                    energy === e.id
                      ? `bg-gradient-to-br ${e.color} border border-pink-500/40 ring-1 ring-pink-500/20`
                      : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08]"
                  }`}
                >
                  <span className={`text-xs font-semibold ${energy === e.id ? "text-zinc-200" : "text-zinc-300"}`}>
                    {e.name}
                  </span>
                  <p className="text-[10px] text-zinc-400">{e.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Number of Scenes */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Number of Scenes</label>
            <div className="flex gap-2">
              {SCENE_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setSceneCount(n)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-3 rounded-xl transition-all duration-200 ${
                    sceneCount === n
                      ? "bg-violet-500/20 border border-violet-500/40 text-violet-300"
                      : "bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:bg-white/[0.08]"
                  }`}
                >
                  <span className="text-sm font-bold">{n}</span>
                  <span className="text-[9px]">scenes</span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-[11px] text-zinc-400">
                {sceneCount} scenes x 5s = {totalDuration}s total
              </span>
              <span className="text-[11px] text-amber-400 font-medium">
                {totalCreditCost} credits
              </span>
            </div>
          </div>

          {/* Stage / Background */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Stage / Background</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STAGE_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStage(s.id)}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl text-left transition-all duration-200 ${
                    stage === s.id
                      ? "bg-violet-500/15 border border-violet-500/40 ring-1 ring-violet-500/20"
                      : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-violet-500/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{s.emoji}</span>
                    <span className={`text-[11px] font-semibold ${stage === s.id ? "text-violet-300" : "text-zinc-300"}`}>
                      {s.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400">{s.desc}</p>
                </button>
              ))}
            </div>
            {stage === "custom" && (
              <input
                type="text"
                value={customStage}
                onChange={(e) => setCustomStage(e.target.value)}
                placeholder="Describe your stage / background..."
                className="w-full mt-3 px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/[0.12] text-sm text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── STEP 3: Platform & Aspect Ratio ──────────────────────── */}
      <Card className={!faceFile || !musicFile ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white">3</div>
            Platform & Aspect Ratio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Platform */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Platform</label>
            <div className="grid grid-cols-3 gap-1.5">
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

          {/* Aspect Ratio */}
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
        </CardContent>
      </Card>

      {/* ─── Credit Breakdown & Generate ───────────────────────────── */}
      <Card className={!faceFile || !musicFile ? "opacity-50 pointer-events-none" : "border-pink-500/20"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-amber-400" />
            Create Your Music Video
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Credit breakdown */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Scenes ({sceneCount} x {CREDITS_PER_SCENE} credits)</span>
              <span className="text-xs text-zinc-300">{totalCreditCost} credits</span>
            </div>
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
            className="w-full h-14 bg-gradient-to-r from-violet-600 via-pink-500 to-amber-500 hover:from-violet-500 hover:via-pink-400 hover:to-amber-400 text-white font-semibold rounded-xl shadow-lg shadow-pink-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 text-base"
          >
            {!isPlanAllowed ? (
              <span className="flex items-center gap-2"><Lock className="w-4 h-4" />Upgrade to Create</span>
            ) : (
              <span className="flex items-center gap-2"><Play className="w-5 h-5" />Drop the Beat</span>
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
        <Card className={resultVideoUrl ? "border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.02] to-pink-500/[0.02]" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              {resultVideoUrl ? (
                <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Your Music Video Is Ready</>
              ) : (
                <><Music2 className="w-4 h-4 text-pink-400" /> Creating Your Music Video...</>
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
                    download={`music-video-${jobId || "video"}.mp4`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 text-sm font-medium transition-colors border border-pink-500/20"
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
          className="w-full shadow-lg shadow-pink-600/20 h-12 bg-gradient-to-r from-violet-600 via-pink-500 to-amber-500"
          disabled={!canGenerate || isGenerating}
          loading={isGenerating}
          onClick={handleGenerate}
        >
          {isGenerating ? "Creating your video..." : !isPlanAllowed ? (
            <><Lock className="w-4 h-4" /> Upgrade to Create</>
          ) : (
            <><Play className="w-4 h-4" /> Drop the Beat — {totalCreditCost} cr</>
          )}
        </Button>
      </MobileActionBar>

      <div className="h-20 lg:hidden" />
    </PageTransition>
  );
}
