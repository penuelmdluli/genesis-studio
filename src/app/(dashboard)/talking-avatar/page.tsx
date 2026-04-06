"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { VOICE_OPTIONS } from "@/lib/constants";
import { ComingSoonGate } from "@/components/ui/coming-soon";
import {
  MessageCircle,
  Upload,
  Mic,
  Zap,
  Play,
  Square,
  Image as ImageIcon,
  X,
  Lock,
  Globe,
  Clock,
  Loader2,
} from "lucide-react";

type InputMode = "script" | "audio";

const DURATIONS = [10, 15, 30, 60] as const;

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "pt", label: "Portuguese" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "ko", label: "Korean" },
] as const;

function computeCreditCost(duration: number): number {
  return Math.ceil(duration / 10) * 15;
}

export default function TalkingAvatarPage() {
  const { user, updateCreditBalance } = useStore();
  const { toast } = useToast();

  // Form state
  const [faceImage, setFaceImage] = useState<File | null>(null);
  const [faceImagePreview, setFaceImagePreview] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("script");
  const [scriptText, setScriptText] = useState("");
  const [voiceId, setVoiceId] = useState(VOICE_OPTIONS[0]?.id || "voice-aria");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(10);
  const [language, setLanguage] = useState("en");

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  // Refs
  const faceInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const generateLockRef = useRef(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  const handlePreviewVoice = useCallback((vid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingVoice === vid && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      setPreviewingVoice(null);
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setLoadingPreview(vid);
    const audio = new Audio(`/api/voiceover/preview?voiceId=${vid}`);
    previewAudioRef.current = audio;
    audio.oncanplaythrough = () => {
      setLoadingPreview(null);
      setPreviewingVoice(vid);
      audio.play();
    };
    audio.onended = () => setPreviewingVoice(null);
    audio.onerror = () => { setLoadingPreview(null); setPreviewingVoice(null); };
    audio.load();
  }, [previewingVoice]);

  const isLoading = !user;
  const userPlan = user?.plan || "free";
  const isPlanAllowed = userPlan === "pro" || userPlan === "studio" || !!user?.isOwner;
  const creditCost = computeCreditCost(duration);
  const hasEnoughCredits = user?.isOwner || (user?.creditBalance ?? 0) >= creditCost;

  // --- File Handlers ---

  const handleFaceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Image too large. Maximum size is 10MB.");
      toast("Image too large (max 10MB)", "error");
      return;
    }
    setFaceImage(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setFaceImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearFaceImage = () => {
    setFaceImage(null);
    setFaceImagePreview(null);
    if (faceInputRef.current) faceInputRef.current.value = "";
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setError("Audio file too large. Maximum size is 25MB.");
      toast("Audio too large (max 25MB)", "error");
      return;
    }
    setAudioFile(file);
    setAudioFileName(file.name);
    setError(null);
  };

  const clearAudio = () => {
    setAudioFile(null);
    setAudioFileName(null);
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  // --- Upload to R2 ---

  const uploadFileToR2 = async (
    file: File,
    purpose: "image" | "audio"
  ): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("purpose", purpose);
    const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
    if (!uploadRes.ok) {
      const err = await uploadRes.json();
      throw new Error(err.error || "Failed to upload file");
    }
    const { downloadUrl } = await uploadRes.json();
    return downloadUrl;
  };

  // --- Generate ---

  const canGenerate =
    faceImage &&
    (inputMode === "script" ? scriptText.trim().length > 0 : !!audioFile) &&
    hasEnoughCredits &&
    isPlanAllowed &&
    !isLoading;

  const handleGenerate = async () => {
    if (generateLockRef.current) return;
    generateLockRef.current = true;
    setError(null);
    setResultVideoUrl(null);
    setJobId(null);

    if (!faceImage) {
      setError("Please upload a face photo.");
      generateLockRef.current = false;
      return;
    }
    if (inputMode === "script" && !scriptText.trim()) {
      setError("Please enter a script for the avatar to speak.");
      generateLockRef.current = false;
      return;
    }
    if (inputMode === "audio" && !audioFile) {
      setError("Please upload an audio file.");
      generateLockRef.current = false;
      return;
    }
    if (!hasEnoughCredits) {
      setError(`Not enough credits. You need ${creditCost} but have ${user?.creditBalance ?? 0}.`);
      generateLockRef.current = false;
      return;
    }

    setIsGenerating(true);
    try {
      toast("Uploading files...", "info");

      const imageUrl = await uploadFileToR2(faceImage, "image");

      let audioUrl: string | undefined;
      if (inputMode === "audio" && audioFile) {
        audioUrl = await uploadFileToR2(audioFile, "audio");
      }

      toast("Starting avatar generation...", "info");

      const res = await fetch("/api/talking-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          text: inputMode === "script" ? scriptText.trim() : undefined,
          audioUrl: inputMode === "audio" ? audioUrl : undefined,
          voiceId: inputMode === "script" ? voiceId : undefined,
          duration,
          language,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setJobId(data.jobId);
        updateCreditBalance((user?.creditBalance ?? 0) - data.creditsCost);
        toast("Talking avatar generation started! This may take a few minutes.", "success");
      } else {
        setError(data.error || "Generation failed.");
        toast(data.error || "Generation failed", "error");
      }
    } catch (err) {
      console.error("Talking avatar generation failed:", err);
      setError("Network error. Please try again.");
      toast("Network error.", "error");
    } finally {
      setIsGenerating(false);
      generateLockRef.current = false;
    }
  };

  // --- Drag & Drop ---

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Image too large. Maximum size is 10MB.");
      toast("Image too large (max 10MB)", "error");
      return;
    }
    setFaceImage(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setFaceImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <ComingSoonGate featureId="talking-avatar" featureName="Talking Avatar">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-600/20">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Talking Avatar</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Upload a face photo and give it a voice with AI lip sync
            </p>
          </div>
        </div>
        <p className="text-[11px] text-zinc-600 ml-[52px]">
          HeyGen alternative — 90% less
        </p>
      </div>

      {/* Plan Gate */}
      {!isPlanAllowed && !isLoading && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-300">Pro plan required</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Talking Avatar is available on Pro and Studio plans. Upgrade to unlock this feature.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Inputs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Step 1: Face Photo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ImageIcon className="w-4 h-4 text-violet-400" />
                Face Photo
                <span className="text-[10px] text-zinc-600 font-normal ml-1">Step 1</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {faceImagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-black/30">
                  <img
                    src={faceImagePreview}
                    alt="Face preview"
                    className="w-full h-56 object-contain"
                  />
                  <button
                    onClick={clearFaceImage}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-red-500/80 text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center h-56 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 bg-white/[0.02] hover:bg-violet-500/5 cursor-pointer transition-all duration-300 group"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <input
                    ref={faceInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFaceImageUpload}
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-3 group-hover:bg-violet-500/20 transition-colors">
                    <Upload className="w-7 h-7 text-violet-400" />
                  </div>
                  <span className="text-sm font-medium text-zinc-400 group-hover:text-violet-300 transition-colors">
                    Drop a face photo or click to upload
                  </span>
                  <span className="text-xs text-zinc-600 mt-1">
                    PNG, JPEG or WebP — max 10MB — clear front-facing face works best
                  </span>
                </label>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Input Method */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Mic className="w-4 h-4 text-violet-400" />
                Voice Input
                <span className="text-[10px] text-zinc-600 font-normal ml-1">Step 2</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                {([
                  { key: "script" as const, label: "Type Script", icon: MessageCircle },
                  { key: "audio" as const, label: "Upload Audio", icon: Upload },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setInputMode(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      inputMode === tab.key
                        ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Script Mode */}
              {inputMode === "script" && (
                <div className="space-y-3">
                  <Textarea
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    placeholder="Type what the avatar should say..."
                    className="min-h-[120px] bg-white/[0.03] border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 resize-none"
                  />
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Voice</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {VOICE_OPTIONS.map((voice) => (
                        <button
                          key={voice.id}
                          onClick={() => setVoiceId(voice.id)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            voiceId === voice.id
                              ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                              : "bg-white/[0.03] text-zinc-500 hover:text-zinc-300 border border-white/[0.06]"
                          }`}
                        >
                          <span>
                            <span>{voice.name}</span>
                            <span className="ml-1 text-[10px] text-zinc-600">
                              {voice.gender === "female" ? "F" : "M"} / {voice.language}
                            </span>
                          </span>
                          <span
                            onClick={(e) => handlePreviewVoice(voice.id, e)}
                            className={`ml-1 flex h-5 w-5 items-center justify-center rounded-full transition-all ${
                              previewingVoice === voice.id
                                ? "bg-violet-500 text-white"
                                : "bg-zinc-700/50 text-zinc-400 hover:bg-violet-500/30 hover:text-violet-300"
                            }`}
                            title={previewingVoice === voice.id ? "Stop" : "Preview"}
                          >
                            {loadingPreview === voice.id ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : previewingVoice === voice.id ? (
                              <Square className="h-2 w-2" />
                            ) : (
                              <Play className="h-2.5 w-2.5 ml-px" />
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Audio Upload Mode */}
              {inputMode === "audio" && (
                <div>
                  {audioFileName ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                      <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                        <Mic className="w-5 h-5 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-300 truncate">{audioFileName}</p>
                        <p className="text-[10px] text-zinc-600">Ready to use</p>
                      </div>
                      <button
                        onClick={clearAudio}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 bg-white/[0.02] hover:bg-violet-500/5 cursor-pointer transition-all duration-300 group">
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/mpeg,audio/wav,audio/mp3,audio/x-wav"
                        onChange={handleAudioUpload}
                        className="hidden"
                      />
                      <Mic className="w-6 h-6 text-violet-400 mb-2" />
                      <span className="text-sm font-medium text-zinc-400 group-hover:text-violet-300 transition-colors">
                        Upload audio file
                      </span>
                      <span className="text-xs text-zinc-600 mt-1">MP3 or WAV — max 25MB</span>
                    </label>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Settings & Generate */}
        <div className="space-y-4">
          {/* Duration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-violet-400" />
                Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      duration === d
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                        : "bg-white/[0.03] text-zinc-500 hover:text-zinc-300 border border-white/[0.06]"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Language */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-violet-400" />
                Language
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-1.5">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      language === lang.code
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                        : "bg-white/[0.03] text-zinc-500 hover:text-zinc-300 border border-white/[0.06]"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Credit Cost */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-amber-400" />
                Cost Estimate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Duration</span>
                <span className="text-xs text-zinc-300">{duration}s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Rate</span>
                <span className="text-xs text-zinc-300">15 credits / 10s</span>
              </div>
              <div className="h-px bg-white/[0.06]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">Total</span>
                <span className="text-sm font-bold text-amber-400">{creditCost} credits</span>
              </div>
              {!hasEnoughCredits && !user?.isOwner && (
                <p className="text-[11px] text-red-400">
                  Insufficient credits. You have {user?.creditBalance ?? 0}.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-500 hover:to-fuchsia-400 text-white font-medium rounded-xl shadow-lg shadow-violet-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </span>
            ) : !isPlanAllowed ? (
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Pro plan required
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                Generate Avatar
              </span>
            )}
          </Button>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Result */}
      {jobId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Play className="w-4 h-4 text-violet-400" />
              Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resultVideoUrl ? (
              <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-black/30">
                <video
                  src={resultVideoUrl}
                  className="w-full max-h-[480px] object-contain"
                  controls
                  autoPlay
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mb-3" />
                <p className="text-sm text-zinc-400">Generating your talking avatar...</p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  Job ID: {jobId} — This may take 1-3 minutes
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </PageTransition>
    </ComingSoonGate>
  );
}
