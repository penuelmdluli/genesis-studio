"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { uploadFile } from "@/lib/upload-client";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
import {
  Zap,
  Upload,
  Link as LinkIcon,
  User,
  Settings2,
  Play,
  Download,
  X,
  Film,
  Volume2,
  VolumeX,
  ExternalLink,
  Loader2,
  Check,
  Video,
  Share2,
} from "lucide-react";

const CREDIT_COST = 1500;
const DURATIONS = [5, 10, 15, 20, 30];
const ASPECT_RATIOS = [
  { value: "9:16", label: "9:16 Portrait" },
  { value: "16:9", label: "16:9 Landscape" },
  { value: "1:1", label: "1:1 Square" },
];

type ReferenceTab = "url" | "upload";
type CharacterTab = "upload" | "library";
type JobStatus = "idle" | "uploading" | "scraping" | "submitting" | "in_queue" | "processing" | "completed" | "failed";

interface MbsCharacter {
  id: string;
  name: string;
  description: string | null;
  portrait_url: string;
}

const STORAGE_KEY = "mimic_active_job";

const STATUS_LABELS: Record<JobStatus, string> = {
  idle: "",
  uploading: "Uploading files...",
  scraping: "Fetching video from URL...",
  submitting: "Submitting to Kling...",
  in_queue: "In queue — waiting for GPU...",
  processing: "Generating your video...",
  completed: "Done!",
  failed: "Generation failed",
};

const STATUS_PROGRESS: Record<JobStatus, number> = {
  idle: 0,
  uploading: 10,
  scraping: 20,
  submitting: 30,
  in_queue: 40,
  processing: 65,
  completed: 100,
  failed: 0,
};

export default function MimicStudioPage() {
  const { user, updateCreditBalance, addNotification, isInitialized } = useStore();
  const { toast } = useToast();

  // Character image
  const [characterTab, setCharacterTab] = useState<CharacterTab>("upload");
  const [characterImage, setCharacterImage] = useState<File | null>(null);
  const [characterImagePreview, setCharacterImagePreview] = useState<string | null>(null);
  const [libraryCharacter, setLibraryCharacter] = useState<MbsCharacter | null>(null);
  const [libraryCharacters, setLibraryCharacters] = useState<MbsCharacter[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const characterImageRef = useRef<HTMLInputElement>(null);

  // Reference video
  const [referenceTab, setReferenceTab] = useState<ReferenceTab>("url");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [referenceVideo, setReferenceVideo] = useState<File | null>(null);
  const [referenceVideoPreview, setReferenceVideoPreview] = useState<string | null>(null);
  const referenceVideoRef = useRef<HTMLInputElement>(null);

  // Settings
  const [duration, setDuration] = useState(10);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [keepAudio, setKeepAudio] = useState(true);
  const [prompt, setPrompt] = useState("");

  // Generation state
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [outputVideoUrl, setOutputVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const generateLockRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const credits = user?.creditBalance ?? 0;
  const hasEnoughCredits = user?.isOwner || credits >= CREDIT_COST;

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Restore in-flight job on mount (survives refresh)
  useEffect(() => {
    const savedJobId = localStorage.getItem(STORAGE_KEY);
    if (!savedJobId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mimic/status/${savedJobId}`);
        if (!res.ok) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        setJobId(savedJobId);

        if (data.status === "completed") {
          setJobStatus("completed");
          setOutputVideoUrl(data.outputVideoUrl);
          setIsGenerating(false);
          localStorage.removeItem(STORAGE_KEY);
        } else if (data.status === "failed") {
          setJobStatus("failed");
          setError(data.error || "Generation failed");
          setIsGenerating(false);
          localStorage.removeItem(STORAGE_KEY);
        } else {
          setJobStatus(data.status as JobStatus);
          setIsGenerating(true);
          startPolling(savedJobId);
        }
      } catch {
        // Network blip, leave key in place — next mount will retry
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCharacterImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("Image too large (max 10MB)", "error");
      return;
    }
    setLibraryCharacter(null);
    setCharacterImage(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setCharacterImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Lazy-load the character library when the user switches to the Library tab
  useEffect(() => {
    if (characterTab !== "library" || libraryCharacters.length > 0 || libraryLoading) return;
    let cancelled = false;
    setLibraryLoading(true);
    fetch("/api/mbs/characters")
      .then((res) => (res.ok ? res.json() : { characters: [] }))
      .then((data) => {
        if (!cancelled) setLibraryCharacters(data.characters || []);
      })
      .catch(() => { /* silent — empty grid handles itself */ })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterTab]);

  const handleLibrarySelect = (c: MbsCharacter) => {
    setCharacterImage(null);
    setCharacterImagePreview(null);
    if (characterImageRef.current) characterImageRef.current.value = "";
    setLibraryCharacter(c);
    setError(null);
  };

  const handleReferenceVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast("Video too large (max 100MB)", "error");
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.duration > 30) {
        toast("Video must be 30 seconds or shorter", "error");
        URL.revokeObjectURL(url);
        return;
      }
      setReferenceVideo(file);
      setReferenceVideoPreview(url);
      setError(null);
    };
    video.onerror = () => {
      toast("Could not read video file", "error");
      URL.revokeObjectURL(url);
    };
    video.src = url;
  };

  const clearCharacterImage = () => {
    setCharacterImage(null);
    setCharacterImagePreview(null);
    setLibraryCharacter(null);
    if (characterImageRef.current) characterImageRef.current.value = "";
  };

  const clearReferenceVideo = () => {
    setReferenceVideo(null);
    if (referenceVideoPreview) URL.revokeObjectURL(referenceVideoPreview);
    setReferenceVideoPreview(null);
    if (referenceVideoRef.current) referenceVideoRef.current.value = "";
  };

  const hasReference = referenceTab === "url" ? referenceUrl.trim().length > 0 : !!referenceVideo;
  const hasCharacter = !!characterImage || !!libraryCharacter;
  const canGenerate = hasCharacter && hasReference && hasEnoughCredits && !isGenerating;

  // Poll for job status
  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/mimic/status/${id}`);
        const data = await res.json();

        if (data.status === "completed") {
          setJobStatus("completed");
          setOutputVideoUrl(data.outputVideoUrl);
          setIsGenerating(false);
          toast("Your Mimic video is ready!", "success");
          if (pollRef.current) clearInterval(pollRef.current);
          localStorage.removeItem(STORAGE_KEY);

          // In-app notification (bell icon)
          addNotification({
            type: "success",
            title: "Mimic video is ready!",
            message: "Your character mimic video has finished rendering. View it now.",
            link: "/mimic",
          });

          // Browser notification (background tab)
          if (typeof window !== "undefined" && Notification.permission === "granted") {
            new Notification("Genesis Studio", {
              body: "Your Mimic Studio video is ready!",
              icon: "/icon-192.png",
            });
          }
        } else if (data.status === "failed") {
          setJobStatus("failed");
          setError(data.error || "Generation failed");
          setIsGenerating(false);
          toast("Generation failed", "error");
          if (pollRef.current) clearInterval(pollRef.current);
          localStorage.removeItem(STORAGE_KEY);

          addNotification({
            type: "error",
            title: "Mimic generation failed",
            message: "Something went wrong. Your credits have been refunded.",
            link: "/mimic",
          });
        } else if (data.status === "in_queue") {
          setJobStatus("in_queue");
        } else if (data.status === "processing") {
          setJobStatus("processing");
        }
      } catch {
        // Network blip, keep polling
      }
    }, 5000);
  }, [toast]);

  const handleGenerate = async () => {
    if (generateLockRef.current || isGenerating) return;
    generateLockRef.current = true;
    setError(null);
    setOutputVideoUrl(null);
    setIsGenerating(true);

    try {
      setJobStatus("uploading");
      toast("Uploading files...", "info");

      // Use library character URL directly, or upload the user's file
      const characterImageUrl = libraryCharacter
        ? libraryCharacter.portrait_url
        : await uploadFile(characterImage!, "image");

      // Upload reference video if provided directly
      let referenceVideoUrl: string | undefined;
      if (referenceTab === "upload" && referenceVideo) {
        referenceVideoUrl = await uploadFile(referenceVideo, "video");
      }

      setJobStatus("submitting");

      const res = await fetch("/api/mimic/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImageUrl,
          referenceUrl: referenceTab === "url" ? referenceUrl.trim() : undefined,
          referenceVideoUrl,
          durationSec: duration,
          aspectRatio,
          keepVideoSound: keepAudio,
          prompt: prompt.trim() || undefined,
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
      localStorage.setItem(STORAGE_KEY, data.jobId);
      setJobStatus("in_queue");
      updateCreditBalance(credits - CREDIT_COST);
      toast("Mimic generation started!", "info");

      // Start polling
      startPolling(data.jobId);
    } catch (err) {
      console.error("Mimic generation failed:", err);
      setError("Network error. Please try again.");
      setJobStatus("failed");
      toast("Network error", "error");
    } finally {
      generateLockRef.current = false;
      if (jobStatus === "failed") setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = jobId ? `${process.env.NEXT_PUBLIC_APP_URL || "https://genesisstudio.app"}/explore/${jobId}` : (process.env.NEXT_PUBLIC_APP_URL || "https://genesisstudio.app");
    const shareText = "Check out this AI video I made with Genesis Studio Mimic Studio!";

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Mimic Studio Video", text: shareText, url: shareUrl });
        toast("Shared!", "success");
        return;
      } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast("Share link copied!", "success");
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`, "_blank");
    }
  };

  const resetGeneration = () => {
    setJobStatus("idle");
    setJobId(null);
    setOutputVideoUrl(null);
    setError(null);
    setIsGenerating(false);
    if (pollRef.current) clearInterval(pollRef.current);
    localStorage.removeItem(STORAGE_KEY);
  };

  const isActive = jobStatus !== "idle" && jobStatus !== "completed" && jobStatus !== "failed";

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-600/20 shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">Mimic Studio</h1>
              <Badge className="bg-violet-500/15 text-violet-300 border border-violet-500/30 text-[10px] sm:text-xs shrink-0">
                AI Powered
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
              Transform any character into a performer. Upload your character image, provide a reference video, and watch them perform.
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
          {[
            { num: 1, label: "Character", done: !!characterImage },
            { num: 2, label: "Reference", done: hasReference },
            { num: 3, label: "Generate", done: jobStatus === "completed" },
          ].map((step, i) => (
            <div key={step.num} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium transition-all ${
                step.done
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "bg-white/[0.05] text-zinc-400 border border-white/[0.10]"
              }`}>
                {step.done ? (
                  <Check className="w-3 h-3 text-violet-400" />
                ) : (
                  <span className="w-3 h-3 flex items-center justify-center text-[10px]">{step.num}</span>
                )}
                {step.label}
              </div>
              {i < 2 && <div className={`w-4 sm:w-6 h-px ${step.done ? "bg-violet-500/40" : "bg-white/[0.06]"}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Inputs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Step 1: Character Image */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-cyan-400" />
                Step 1: Your Character
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabs — Upload vs Library */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/[0.10]">
                {([
                  { key: "upload" as const, label: "Upload", icon: Upload },
                  { key: "library" as const, label: "Studio Library", icon: User },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setCharacterTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      characterTab === tab.key
                        ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                        : "text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5 shrink-0" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Selected character preview (works for both upload + library) */}
              {(characterImagePreview || libraryCharacter) ? (
                <div className="relative rounded-xl overflow-hidden border border-white/[0.12] bg-black/30">
                  <img
                    src={libraryCharacter?.portrait_url || characterImagePreview || ""}
                    alt={libraryCharacter?.name || "Character"}
                    className="w-full h-48 object-contain"
                  />
                  {libraryCharacter && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-xs text-cyan-300 font-medium">
                      {libraryCharacter.name}
                    </div>
                  )}
                  <button
                    onClick={clearCharacterImage}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-red-500/80 text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : characterTab === "upload" ? (
                <label className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 bg-white/[0.04] hover:bg-violet-500/5 cursor-pointer transition-all duration-300 group">
                  <input
                    ref={characterImageRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleCharacterImageUpload}
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-3 group-hover:bg-cyan-500/20 transition-colors">
                    <User className="w-7 h-7 text-cyan-400" />
                  </div>
                  <span className="text-sm font-medium text-zinc-400 group-hover:text-cyan-300 transition-colors">
                    Upload your character image
                  </span>
                  <span className="text-xs text-zinc-400 mt-1">
                    PNG, JPG, or WEBP — max 10MB. Full body works best.
                  </span>
                </label>
              ) : (
                <div className="rounded-xl border border-white/[0.10] bg-white/[0.04] p-3">
                  {libraryLoading ? (
                    <div className="flex items-center justify-center h-44 text-zinc-400 text-sm gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading characters…
                    </div>
                  ) : libraryCharacters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-44 text-zinc-400 text-sm">
                      No characters available yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
                      {libraryCharacters.map((char) => (
                        <button
                          key={char.id}
                          onClick={() => handleLibrarySelect(char)}
                          className="relative aspect-[3/4] rounded-lg overflow-hidden border border-white/[0.10] hover:border-cyan-500/40 transition-all duration-200"
                        >
                          <img
                            src={char.portrait_url}
                            alt={char.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/85 to-transparent">
                            <div className="text-[11px] font-medium text-white truncate">
                              {char.name}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Reference Video */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Video className="w-4 h-4 text-violet-400" />
                Step 2: The Motion to Mimic
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/[0.10]">
                {([
                  { key: "url" as const, label: "Paste URL", icon: LinkIcon },
                  { key: "upload" as const, label: "Upload Video", icon: Upload },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setReferenceTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      referenceTab === tab.key
                        ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                        : "text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5 shrink-0" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* URL Tab */}
              {referenceTab === "url" && (
                <div className="space-y-2">
                  <Input
                    placeholder="Paste TikTok, Instagram, Facebook, or YouTube URL"
                    value={referenceUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setReferenceUrl(e.target.value); setError(null); }}
                    className="bg-white/[0.05] border-white/[0.12] text-sm"
                  />
                  <p className="text-[11px] text-zinc-400">
                    We&apos;ll download the video for you. Max 30 seconds.
                  </p>
                </div>
              )}

              {/* Upload Tab */}
              {referenceTab === "upload" && (
                <div>
                  {referenceVideoPreview && referenceVideo ? (
                    <div className="relative rounded-xl overflow-hidden border border-white/[0.12] bg-black/30">
                      <video
                        src={referenceVideoPreview}
                        className="w-full h-56 object-contain"
                        controls
                        muted
                        loop
                      />
                      <button
                        onClick={clearReferenceVideo}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-red-500/80 text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="default" className="text-[10px] bg-black/60 backdrop-blur">
                          {referenceVideo.name}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-56 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 bg-white/[0.04] hover:bg-violet-500/5 cursor-pointer transition-all duration-300 group">
                      <input
                        ref={referenceVideoRef}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={handleReferenceVideoUpload}
                        className="hidden"
                      />
                      <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-3 group-hover:bg-violet-500/20 transition-colors">
                        <Video className="w-7 h-7 text-violet-400" />
                      </div>
                      <span className="text-sm font-medium text-zinc-400 group-hover:text-violet-300 transition-colors">
                        Upload a reference video
                      </span>
                      <span className="text-xs text-zinc-400 mt-1">
                        MP4, WebM, or MOV — max 30 seconds, 100MB
                      </span>
                    </label>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Settings2 className="w-4 h-4 text-amber-400" />
                Step 3: Customize
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Duration */}
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-2 block">Duration</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        duration === d
                          ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.10]"
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-2 block">Aspect Ratio</label>
                <div className="flex gap-1.5 flex-wrap">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar.value}
                      onClick={() => setAspectRatio(ar.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        aspectRatio === ar.value
                          ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          : "bg-white/[0.05] text-zinc-400 hover:text-zinc-300 border border-white/[0.10]"
                      }`}
                    >
                      {ar.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Keep Audio Toggle */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  {keepAudio ? (
                    <Volume2 className="w-4 h-4 text-violet-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-zinc-400" />
                  )}
                  <span className="text-xs font-medium text-zinc-300">Keep original audio</span>
                </div>
                <button
                  onClick={() => setKeepAudio(!keepAudio)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    keepAudio ? "bg-violet-600" : "bg-white/[0.08]"
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    keepAudio ? "translate-x-5" : ""
                  }`} />
                </button>
              </div>

              {/* Optional Prompt */}
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-2 block">
                  Scene description (optional)
                </label>
                <Textarea
                  placeholder="e.g. Dancing in a neon-lit studio, cyberpunk atmosphere..."
                  value={prompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                  className="h-20 text-sm bg-white/[0.05] border-white/[0.12]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Generation Status */}
          {jobStatus !== "idle" && (
            <Card glow={jobStatus === "completed"}>
              <CardContent className="py-6">
                {/* Active generation */}
                {isActive && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                      <span className="text-sm font-medium text-zinc-200">
                        {STATUS_LABELS[jobStatus]}
                      </span>
                    </div>
                    <Progress value={STATUS_PROGRESS[jobStatus]} className="h-1.5" />
                  </div>
                )}

                {/* Completed */}
                {jobStatus === "completed" && outputVideoUrl && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Check className="w-5 h-5" />
                      <span className="text-sm font-bold">Your Mimic video is ready!</span>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-white/[0.12] bg-black/30">
                      <video
                        src={outputVideoUrl}
                        className="w-full max-h-[500px] object-contain"
                        controls
                        autoPlay
                        loop
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <a
                        href={outputVideoUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                      <button
                        onClick={handleShare}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Share
                      </button>
                      <a
                        href="/gallery"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-medium transition-colors"
                      >
                        <Film className="w-3.5 h-3.5" /> View in Gallery
                      </a>
                      <button
                        onClick={resetGeneration}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-medium transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5" /> Generate Another
                      </button>
                    </div>
                  </div>
                )}

                {/* Failed */}
                {jobStatus === "failed" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-red-400">
                      <X className="w-5 h-5" />
                      <span className="text-sm font-medium">{error || "Generation failed"}</span>
                    </div>
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
          )}
        </div>

        {/* Right Column: Summary (Desktop) */}
        <div className="hidden lg:block">
          <div className="sticky top-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-zinc-300">Generation Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Character</span>
                    <span className={characterImage ? "text-violet-300" : "text-zinc-400"}>
                      {characterImage ? characterImage.name.slice(0, 20) : "Not uploaded"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Reference</span>
                    <span className={hasReference ? "text-violet-300" : "text-zinc-400"}>
                      {referenceTab === "url" && referenceUrl ? "URL provided" : referenceVideo ? referenceVideo.name.slice(0, 20) : "Not provided"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Duration</span>
                    <span className="text-zinc-300">{duration}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Aspect Ratio</span>
                    <span className="text-zinc-300">{aspectRatio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-200">Audio</span>
                    <span className="text-zinc-300">{keepAudio ? "Keep original" : "Muted"}</span>
                  </div>
                </div>

                <div className="h-px bg-white/[0.06]" />

                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Cost</span>
                  <span className="text-sm font-bold text-violet-300">{CREDIT_COST.toLocaleString()} credits</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Your balance</span>
                  <span className={`text-sm font-bold ${hasEnoughCredits ? "text-emerald-400" : "text-red-400"}`}>
                    {credits.toLocaleString()} credits
                  </span>
                </div>

                {!hasEnoughCredits && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-[11px] text-red-400 font-medium">
                      Need {(CREDIT_COST - credits).toLocaleString()} more credits
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
                  <Zap className="w-4 h-4 mr-1.5" />
                  Generate Mimic Video
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
            <span className="font-bold text-violet-300">{CREDIT_COST.toLocaleString()}</span>
            <span className="text-zinc-400 ml-1.5">Balance: {credits.toLocaleString()}</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={!canGenerate}
            loading={isGenerating}
            onClick={handleGenerate}
          >
            <Zap className="w-3.5 h-3.5 mr-1" />
            Generate
          </Button>
        </div>
      </MobileActionBar>
      <div className="h-20 lg:hidden" />
    </PageTransition>
  );
}
