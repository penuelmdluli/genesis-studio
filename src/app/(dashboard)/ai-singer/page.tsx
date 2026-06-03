"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/motion";
import { GenerationProgress, useGenerationProgress } from "@/components/ui/generation-progress";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { uploadFile } from "@/lib/upload-client";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
import { TrendingBar } from "@/components/trending-bar";
import {
  Music2,
  Upload,
  X,
  Sparkles,
  Download,
  Play,
  Loader2,
  User,
  Mic2,
  FileAudio,
  Smartphone,
  Monitor,
  Wand2,
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────

const GENRES = [
  { id: "pop", name: "Pop", emoji: "🎵" },
  { id: "hiphop", name: "Hip-Hop", emoji: "🎤" },
  { id: "rnb", name: "R&B", emoji: "💜" },
  { id: "afrobeats", name: "Afrobeats", emoji: "🥁" },
  { id: "gospel", name: "Gospel", emoji: "🙏" },
  { id: "rock", name: "Rock", emoji: "🎸" },
  { id: "jazz", name: "Jazz", emoji: "🎷" },
  { id: "electronic", name: "Electronic", emoji: "🎧" },
  { id: "acoustic", name: "Acoustic", emoji: "🪕" },
  { id: "amapiano", name: "Amapiano", emoji: "🪩" },
];

const BACKING_TRACKS = [
  { id: "bt-amapiano", name: "Amapiano Groove", genre: "amapiano", bpm: 115, url: "/audio/amapiano-groove.mp3" },
  { id: "bt-trap", name: "Trap Beat", genre: "hiphop", bpm: 140, url: "/audio/trap-beat.mp3" },
  { id: "bt-rnb", name: "Smooth R&B", genre: "rnb", bpm: 90, url: "/audio/smooth-rnb.mp3" },
  { id: "bt-pop", name: "Pop Energy", genre: "pop", bpm: 120, url: "/audio/pop-energy.mp3" },
  { id: "bt-gospel", name: "Gospel Piano", genre: "gospel", bpm: 80, url: "/audio/gospel-piano.mp3" },
  { id: "bt-drill", name: "UK Drill", genre: "hiphop", bpm: 142, url: "/audio/uk-drill.mp3" },
  { id: "bt-afro", name: "Afrobeats Hit", genre: "afrobeats", bpm: 108, url: "/audio/afrobeats-hit.mp3" },
  { id: "bt-acoustic", name: "Acoustic Ballad", genre: "acoustic", bpm: 75, url: "/audio/acoustic-ballad.mp3" },
];

const MOODS = ["hype", "emotional", "romantic", "dark", "motivational", "fun", "spiritual"] as const;

const DURATIONS = [
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
];

type SongSource = "lyrics" | "upload" | "ai-generate";
type JobStatus = "idle" | "uploading" | "generating_song" | "creating_lipsync" | "finalizing" | "completed" | "failed";

const PROGRESS_STEPS = [
  "Generating song from lyrics",
  "Creating lip-sync video",
  "Finalizing & rendering",
];

const LYRICS_PLACEHOLDER = `[Verse 1]
Walking through the city lights tonight
Every shadow dancing, feeling right
The rhythm in my heart won't let me stop

[Chorus]
We're burning bright like stars on fire
Higher and higher, we won't tire
This is our moment, our desire`;

// ─── Component ───────────────────────────────────────────────────────

export default function AiSingerPage() {
  const { user, updateCreditBalance, addNotification } = useStore();
  const { toast } = useToast();
  const progress = useGenerationProgress();

  // Face image
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);

  // Song source
  const [songSource, setSongSource] = useState<SongSource>("lyrics");
  const [lyrics, setLyrics] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [genre, setGenre] = useState("pop");
  const [songFile, setSongFile] = useState<File | null>(null);
  const [songFileName, setSongFileName] = useState("");
  const [songUrl, setSongUrl] = useState<string | null>(null);
  const [selectedBackingTrack, setSelectedBackingTrack] = useState<string | null>(null);
  const songInputRef = useRef<HTMLInputElement>(null);

  // AI Generate
  const [aiTheme, setAiTheme] = useState("");
  const [aiMood, setAiMood] = useState<typeof MOODS[number] | "">("");
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);

  // Settings
  const [duration, setDuration] = useState(30);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");

  // Generation
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [outputVideoUrl, setOutputVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const generateLockRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const credits = user?.creditBalance ?? 0;
  const creditCost = 30 + duration;
  const hasEnoughCredits = user?.isOwner || credits >= creditCost;
  const hasFace = !!faceFile;
  const hasSong = songSource === "lyrics" || songSource === "ai-generate" ? lyrics.trim().length > 20 : !!(songFile || songUrl);
  const canGenerate = hasFace && hasSong && hasEnoughCredits && !isGenerating;

  // ─── Cleanup ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ─── Sync progress with job status ────────────────────────────────

  useEffect(() => {
    if (jobStatus === "generating_song") {
      progress.setProgress(20, "Generating song from lyrics...");
    } else if (jobStatus === "creating_lipsync") {
      progress.advanceStep();
      progress.setProgress(55, "Creating lip-sync video...");
    } else if (jobStatus === "finalizing") {
      progress.advanceStep();
      progress.setProgress(85, "Finalizing & rendering...");
    } else if (jobStatus === "completed") {
      progress.complete("Your AI singer video is ready!");
    } else if (jobStatus === "failed") {
      progress.fail(error || "Generation failed");
    }
  }, [jobStatus]);

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

  const removeFace = () => {
    setFaceFile(null);
    setFacePreview(null);
    if (faceInputRef.current) faceInputRef.current.value = "";
  };

  // ─── Song Upload ──────────────────────────────────────────────────

  const handleSongUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast("Audio too large (max 50MB)", "error");
      return;
    }
    setSongFile(file);
    setSongFileName(file.name);
  };

  const removeSong = () => {
    setSongFile(null);
    setSongFileName("");
    setSongUrl(null);
    setSelectedBackingTrack(null);
    if (songInputRef.current) songInputRef.current.value = "";
  };

  // ─── AI Lyrics Generation ────────────────────────────────────────

  const handleGenerateLyrics = async () => {
    if (!aiTheme.trim() || isGeneratingLyrics) return;
    setIsGeneratingLyrics(true);
    try {
      const res = await fetch("/api/ai-singer/generate-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: aiTheme.trim(),
          genre,
          mood: aiMood || undefined,
          duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to generate lyrics", "error");
        return;
      }
      if (data.lyrics) setLyrics(data.lyrics);
      if (data.title) setSongTitle(data.title);
      setSongSource("lyrics");
      toast("Lyrics generated! Review and edit them below.", "success");
    } catch {
      toast("Network error generating lyrics", "error");
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  // ─── Backing Track Selection ──────────────────────────────────────

  const handleSelectBackingTrack = (track: typeof BACKING_TRACKS[number]) => {
    setSongUrl(track.url);
    setSelectedBackingTrack(track.id);
    setSongFile(null);
    setSongFileName(track.name);
    setSongSource("upload");
    setGenre(track.genre);
    toast(`Selected: ${track.name}`, "info");
  };

  // ─── Polling ──────────────────────────────────────────────────────

  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "completed" && data.outputVideoUrl) {
          if (pollRef.current) clearInterval(pollRef.current);
          setJobStatus("completed");
          setOutputVideoUrl(data.outputVideoUrl);
          setIsGenerating(false);
          toast("Your AI Singer video is ready!", "success");
          addNotification({
            type: "success",
            title: "AI Singer video ready!",
            message: "Your music video with lip-sync is done. View it now.",
            link: "/ai-singer",
          });
        } else if (data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setJobStatus("failed");
          setError(data.errorMessage || "Generation failed");
          setIsGenerating(false);
          toast("Generation failed", "error");
        } else if (data.status === "processing") {
          // Map intermediate statuses
          if (data.stage === "lipsync") setJobStatus("creating_lipsync");
          else if (data.stage === "finalizing") setJobStatus("finalizing");
        }
      } catch {
        // Network blip — keep polling
      }
    }, 5000);
  }, [toast, addNotification]);

  // ─── Generate ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (generateLockRef.current || isGenerating) return;
    generateLockRef.current = true;
    setError(null);
    setOutputVideoUrl(null);
    setIsGenerating(true);
    setJobStatus("uploading");
    progress.start(PROGRESS_STEPS);
    progress.setProgress(5, "Uploading files...");

    try {
      toast("Uploading face image...", "info");
      const faceImageUrl = await uploadFile(faceFile!, "image");

      let resolvedSongUrl: string | undefined;
      if (songSource === "upload" && songFile) {
        toast("Uploading song...", "info");
        resolvedSongUrl = await uploadFile(songFile, "audio");
      } else if (songSource === "upload" && songUrl) {
        resolvedSongUrl = songUrl;
      }

      setJobStatus("generating_song");

      const res = await fetch("/api/ai-singer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceImageUrl,
          lyrics: songSource === "lyrics" || songSource === "ai-generate" ? lyrics.trim() : undefined,
          genre,
          songUrl: resolvedSongUrl,
          songTitle: songTitle.trim() || undefined,
          duration,
          aspectRatio,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Generation failed");
        setJobStatus("failed");
        toast(data.error || "Generation failed", "error");
        return;
      }

      setJobId(data.jobId);
      updateCreditBalance(credits - creditCost);
      toast("AI Singer generation started!", "info");
      startPolling(data.jobId);
    } catch (err) {
      console.error("AI Singer generation failed:", err);
      setError("Network error. Please try again.");
      setJobStatus("failed");
      toast("Network error", "error");
    } finally {
      generateLockRef.current = false;
      if (jobStatus === "failed") setIsGenerating(false);
    }
  };

  const resetGeneration = () => {
    setJobStatus("idle");
    setJobId(null);
    setOutputVideoUrl(null);
    setError(null);
    setIsGenerating(false);
    progress.reset();
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const isActive = isGenerating && jobStatus !== "idle" && jobStatus !== "completed" && jobStatus !== "failed";

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 via-pink-600/15 to-amber-500/10 border border-violet-500/20 p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(236,72,153,0.08),transparent_60%)]" />
        <div className="relative flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-pink-500 to-amber-500 flex items-center justify-center shadow-lg shadow-pink-500/20 shrink-0">
            <Music2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">AI Singer</h1>
              <Badge className="bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[10px] sm:text-xs">
                NEW
              </Badge>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              Type your lyrics. Pick a genre. Upload a face. Get a music video with perfect lip sync.
            </p>
          </div>
        </div>
      </div>

      {/* Trending Bar */}
      <TrendingBar
        filter="music"
        onSelectTrend={(trend) => {
          if (trend.lyrics) {
            setLyrics(trend.lyrics);
            setSongSource("lyrics");
          }
          if (trend.title) setSongTitle(trend.title);
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ─── Left Panel: Inputs ────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Face Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-pink-400" />
                Upload the Singer&apos;s Face
              </CardTitle>
            </CardHeader>
            <CardContent>
              {facePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-white/[0.12] bg-black/30 aspect-video max-h-48">
                  <img src={facePreview} alt="Singer face" className="w-full h-full object-contain" />
                  <button
                    onClick={removeFace}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-red-500/80 text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed border-white/10 hover:border-pink-500/40 bg-white/[0.04] hover:bg-pink-500/5 cursor-pointer transition-all group">
                  <input
                    ref={faceInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFaceUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-3 group-hover:bg-pink-500/20 transition-colors">
                    <User className="w-6 h-6 text-pink-400" />
                  </div>
                  <span className="text-sm font-medium text-zinc-400 group-hover:text-pink-300 transition-colors">
                    Drop a face photo or click to upload
                  </span>
                  <span className="text-xs text-zinc-500 mt-1">PNG, JPG, or WEBP — max 10MB</span>
                </label>
              )}
            </CardContent>
          </Card>

          {/* Song Source */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Mic2 className="w-4 h-4 text-violet-400" />
                Song Source
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/[0.10]">
                {([
                  { key: "lyrics" as const, label: "Write Lyrics", icon: Mic2 },
                  { key: "ai-generate" as const, label: "AI Write For Me", icon: Wand2 },
                  { key: "upload" as const, label: "Upload Song", icon: FileAudio },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setSongSource(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      songSource === tab.key
                        ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                        : "text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5 shrink-0" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {songSource === "lyrics" ? (
                <div className="space-y-3">
                  <Input
                    placeholder="Song title (optional)"
                    value={songTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSongTitle(e.target.value)}
                    className="bg-white/[0.05] border-white/[0.12] text-sm"
                  />
                  <Textarea
                    placeholder={LYRICS_PLACEHOLDER}
                    value={lyrics}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLyrics(e.target.value)}
                    className="h-44 text-sm bg-white/[0.05] border-white/[0.12] font-mono"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Use [Verse], [Chorus], [Bridge] tags to structure your song. Min 20 characters.
                  </p>

                  {/* Genre Selector */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">Genre</label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {GENRES.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setGenre(g.id)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl text-left transition-all duration-200 ${
                            genre === g.id
                              ? "bg-pink-500/15 border border-pink-500/40 ring-1 ring-pink-500/20 shadow-lg shadow-pink-500/10"
                              : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-pink-500/20"
                          }`}
                        >
                          <span className="text-base">{g.emoji}</span>
                          <span className={`text-[11px] font-semibold ${genre === g.id ? "text-pink-300" : "text-zinc-300"}`}>
                            {g.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Backing Tracks */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">Or pick a backing track:</label>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
                      {BACKING_TRACKS.map((track) => (
                        <button
                          key={track.id}
                          onClick={() => handleSelectBackingTrack(track)}
                          className={`flex-shrink-0 flex flex-col items-start gap-0.5 p-2.5 rounded-xl transition-all duration-200 min-w-[120px] ${
                            selectedBackingTrack === track.id
                              ? "bg-violet-500/15 border border-violet-500/40 ring-1 ring-violet-500/20"
                              : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-violet-500/20"
                          }`}
                        >
                          <span className={`text-[11px] font-semibold ${selectedBackingTrack === track.id ? "text-violet-300" : "text-zinc-300"}`}>
                            {track.name}
                          </span>
                          <span className="text-[10px] text-zinc-500">{track.genre} &middot; {track.bpm} BPM</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : songSource === "ai-generate" ? (
                <div className="space-y-3">
                  {/* Theme Input */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Theme</label>
                    <Input
                      placeholder="e.g. breakup song about moving on, party anthem for summer"
                      value={aiTheme}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAiTheme(e.target.value)}
                      className="bg-white/[0.05] border-white/[0.12] text-sm"
                    />
                  </div>

                  {/* Mood Selector */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Mood</label>
                    <div className="flex flex-wrap gap-1.5">
                      {MOODS.map((m) => (
                        <button
                          key={m}
                          onClick={() => setAiMood(aiMood === m ? "" : m)}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${
                            aiMood === m
                              ? "bg-pink-500/20 text-pink-300 border border-pink-500/40"
                              : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.10] hover:border-pink-500/20"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Genre Selector */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">Genre</label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {GENRES.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setGenre(g.id)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl text-left transition-all duration-200 ${
                            genre === g.id
                              ? "bg-pink-500/15 border border-pink-500/40 ring-1 ring-pink-500/20 shadow-lg shadow-pink-500/10"
                              : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-pink-500/20"
                          }`}
                        >
                          <span className="text-base">{g.emoji}</span>
                          <span className={`text-[11px] font-semibold ${genre === g.id ? "text-pink-300" : "text-zinc-300"}`}>
                            {g.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate Button */}
                  <Button
                    variant="primary"
                    className="w-full"
                    disabled={!aiTheme.trim() || isGeneratingLyrics}
                    loading={isGeneratingLyrics}
                    onClick={handleGenerateLyrics}
                  >
                    <Wand2 className="w-4 h-4 mr-1.5" />
                    Generate Lyrics (5 credits)
                  </Button>

                  {/* Backing Tracks */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">Or pick a backing track:</label>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
                      {BACKING_TRACKS.map((track) => (
                        <button
                          key={track.id}
                          onClick={() => handleSelectBackingTrack(track)}
                          className={`flex-shrink-0 flex flex-col items-start gap-0.5 p-2.5 rounded-xl transition-all duration-200 min-w-[120px] ${
                            selectedBackingTrack === track.id
                              ? "bg-violet-500/15 border border-violet-500/40 ring-1 ring-violet-500/20"
                              : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-violet-500/20"
                          }`}
                        >
                          <span className={`text-[11px] font-semibold ${selectedBackingTrack === track.id ? "text-violet-300" : "text-zinc-300"}`}>
                            {track.name}
                          </span>
                          <span className="text-[10px] text-zinc-500">{track.genre} &middot; {track.bpm} BPM</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {songFile || songUrl ? (
                    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileAudio className="w-4 h-4 text-violet-400 shrink-0" />
                          <span className="text-sm font-medium text-zinc-200 truncate">{songFileName}</span>
                        </div>
                        <button
                          onClick={removeSong}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 bg-white/[0.04] hover:bg-violet-500/5 cursor-pointer transition-all group">
                      <input
                        ref={songInputRef}
                        type="file"
                        accept="audio/mpeg,audio/wav,audio/mp3,.mp3,.wav"
                        onChange={handleSongUpload}
                        className="hidden"
                      />
                      <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-3 group-hover:bg-violet-500/20 transition-colors">
                        <Upload className="w-6 h-6 text-violet-400" />
                      </div>
                      <span className="text-sm font-medium text-zinc-400 group-hover:text-violet-300 transition-colors">
                        Upload your own song or beat
                      </span>
                      <span className="text-xs text-zinc-500 mt-1">MP3 or WAV — max 50MB</span>
                    </label>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Duration */}
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-2 block">Duration</label>
                <div className="flex gap-1.5">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setDuration(d.value)}
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                        duration === d.value
                          ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.10]"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-2 block">Aspect Ratio</label>
                <div className="flex gap-1.5">
                  {([
                    { value: "9:16" as const, label: "Portrait (9:16)", icon: Smartphone },
                    { value: "16:9" as const, label: "Landscape (16:9)", icon: Monitor },
                  ]).map((ar) => (
                    <button
                      key={ar.value}
                      onClick={() => setAspectRatio(ar.value)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                        aspectRatio === ar.value
                          ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.10]"
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
        </div>

        {/* ─── Right Panel: Output / Summary ─────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="sticky top-6 space-y-4">
            {/* Output Area */}
            <Card className={outputVideoUrl ? "border-emerald-500/20" : ""}>
              <CardHeader>
                <CardTitle className="text-sm text-zinc-300">
                  {outputVideoUrl ? "Your Music Video" : isActive ? "Generating..." : "Preview"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {outputVideoUrl ? (
                  <div className="space-y-4">
                    <div className="rounded-xl overflow-hidden border border-white/[0.12] bg-black/30">
                      <video
                        src={outputVideoUrl}
                        className="w-full max-h-[400px] object-contain"
                        controls
                        autoPlay
                        loop
                      />
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={outputVideoUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                      <button
                        onClick={resetGeneration}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-medium transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> New
                      </button>
                    </div>
                  </div>
                ) : isActive || jobStatus === "failed" ? (
                  <GenerationProgress
                    steps={progress.steps}
                    percent={progress.percent}
                    stageMessage={progress.stageMessage}
                    showTimer
                    timerActive={progress.isActive}
                  />
                ) : (
                  /* Idle placeholder */
                  <div className="flex flex-col items-center justify-center h-64 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center animate-pulse">
                        <Music2 className="w-8 h-8 text-violet-400" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-pink-500/20 flex items-center justify-center animate-bounce">
                        <Mic2 className="w-3 h-3 text-pink-400" />
                      </div>
                    </div>
                    <p className="text-sm text-zinc-400 mt-4 text-center">
                      Your AI-generated music video<br />will appear here
                    </p>
                  </div>
                )}

                {jobStatus === "failed" && (
                  <div className="space-y-3 mt-4">
                    <p className="text-xs text-zinc-400">Credits have been automatically refunded.</p>
                    <button
                      onClick={resetGeneration}
                      className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-medium transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary Card (Desktop) */}
            <Card className="hidden lg:block">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-300">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Face</span>
                    <span className={hasFace ? "text-violet-300" : "text-zinc-500"}>
                      {faceFile ? faceFile.name.slice(0, 20) : "Not uploaded"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Song</span>
                    <span className={hasSong ? "text-violet-300" : "text-zinc-500"}>
                      {songSource === "lyrics" || songSource === "ai-generate"
                        ? lyrics.length > 20 ? "Lyrics provided" : "Not written"
                        : songFile || songUrl ? songFileName.slice(0, 20) || "Backing track" : "Not uploaded"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Genre</span>
                    <span className="text-zinc-300">{GENRES.find(g => g.id === genre)?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Duration</span>
                    <span className="text-zinc-300">{duration}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Ratio</span>
                    <span className="text-zinc-300">{aspectRatio}</span>
                  </div>
                </div>

                <div className="h-px bg-white/[0.06]" />

                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Cost</span>
                  <span className="text-sm font-bold text-violet-300">{creditCost} credits</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Balance</span>
                  <span className={`text-sm font-bold ${hasEnoughCredits ? "text-emerald-400" : "text-red-400"}`}>
                    {credits.toLocaleString()} credits
                  </span>
                </div>

                {!hasEnoughCredits && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-[11px] text-red-400 font-medium">
                      Need {(creditCost - credits)} more credits
                    </p>
                    <button
                      onClick={() => useStore.getState().setCreditPurchaseOpen(true)}
                      className="mt-1.5 text-[11px] text-red-300 underline hover:text-red-200"
                    >
                      Buy credits
                    </button>
                  </div>
                )}

                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={!canGenerate}
                  loading={isGenerating}
                  onClick={handleGenerate}
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Create AI Singer Video
                </Button>

                {error && jobStatus === "idle" && (
                  <p className="text-[11px] text-red-400 text-center">{error}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile Action Bar */}
      <MobileActionBar>
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="text-xs">
            <span className="text-zinc-200">Cost: </span>
            <span className="font-bold text-violet-300">{creditCost}</span>
            <span className="text-zinc-400 ml-1.5">Bal: {credits.toLocaleString()}</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={!canGenerate}
            loading={isGenerating}
            onClick={handleGenerate}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Create
          </Button>
        </div>
      </MobileActionBar>
      <div className="h-20 lg:hidden" />
    </PageTransition>
  );
}
