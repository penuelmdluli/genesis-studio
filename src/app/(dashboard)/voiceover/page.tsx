"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { VOICE_OPTIONS } from "@/lib/constants";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
import { GenesisButtonLoader, GenesisLoader } from "@/components/ui/genesis-loader";
import { Mic, Play, Square, Download, Zap, AlertCircle, RefreshCw } from "lucide-react";

const LANGUAGE_FLAGS: Record<string, string> = {
  en: "\u{1F1FA}\u{1F1F8}",
  "en-ZA": "\u{1F1FF}\u{1F1E6}",
  ja: "\u{1F1EF}\u{1F1F5}",
  es: "\u{1F1EA}\u{1F1F8}",
  fr: "\u{1F1EB}\u{1F1F7}",
  de: "\u{1F1E9}\u{1F1EA}",
};

const MAX_CHARS = 5000;
const CHARS_PER_30S = 150;
const CREDITS_PER_30S = 3;

function estimateVoiceover(charCount: number) {
  const durationSeconds = Math.max((charCount / CHARS_PER_30S) * 30, 0);
  const credits = Math.ceil(charCount / CHARS_PER_30S) * CREDITS_PER_30S;
  return { durationSeconds, credits };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export default function VoiceoverPage() {
  const { user, updateCreditBalance, isInitialized } = useStore();
  const { toast } = useToast();

  const [text, setText] = useState("");
  const [selectedVoiceId, setSelectedVoiceId] = useState(VOICE_OPTIONS[0]?.id ?? "");
  const [speed, setSpeed] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const generateLockRef = useRef(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  const handlePreviewVoice = useCallback((voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // If already playing this voice, stop it
    if (previewingVoice === voiceId && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
      setPreviewingVoice(null);
      setLoadingPreview(null);
      return;
    }

    // Stop any current preview — clear callbacks to prevent stale playback
    if (previewAudioRef.current) {
      previewAudioRef.current.oncanplaythrough = null;
      previewAudioRef.current.onended = null;
      previewAudioRef.current.onerror = null;
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }

    setLoadingPreview(voiceId);
    setPreviewingVoice(null);
    const audio = new Audio(`/api/voiceover/preview?voiceId=${voiceId}`);
    previewAudioRef.current = audio;

    audio.oncanplaythrough = () => {
      // Only play if this audio is still the active one (prevents race conditions)
      if (previewAudioRef.current !== audio) return;
      setLoadingPreview(null);
      setPreviewingVoice(voiceId);
      audio.play();
    };
    audio.onended = () => {
      if (previewAudioRef.current !== audio) return;
      setPreviewingVoice(null);
    };
    audio.onerror = () => {
      if (previewAudioRef.current !== audio) return;
      setLoadingPreview(null);
      setPreviewingVoice(null);
    };
    audio.load();
  }, [previewingVoice]);

  const isLoading = !isInitialized;
  const charCount = text.length;

  const { durationSeconds, credits: creditCost } = useMemo(
    () => estimateVoiceover(charCount),
    [charCount]
  );

  const hasEnoughCredits =
    user?.isOwner || (user?.creditBalance ?? 0) >= creditCost;

  const canGenerate =
    charCount >= 10 &&
    charCount <= MAX_CHARS &&
    selectedVoiceId &&
    hasEnoughCredits &&
    !isGenerating;

  const handleGenerate = async () => {
    if (!canGenerate || generateLockRef.current) return;
    generateLockRef.current = true;
    setIsGenerating(true);
    setAudioUrl(null);
    setJobId(null);
    setGenerationError(null);

    try {
      const selectedVoice = VOICE_OPTIONS.find((v) => v.id === selectedVoiceId);
      const res = await fetch("/api/voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voiceId: selectedVoiceId,
          speed,
          language: selectedVoice?.language ?? "en",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || "Generation failed. Please try again.";
        setGenerationError(msg);
        toast(msg, "error");
        return;
      }

      // Update local credit balance
      if (data.newBalance !== undefined) {
        updateCreditBalance(data.newBalance);
      }

      setJobId(data.jobId);

      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        toast("Voiceover ready! Your audio has been generated.", "success");
      } else {
        toast("Processing... Your voiceover is being generated.", "success");
      }
    } catch {
      setGenerationError("Network error. Please check your connection and try again.");
      toast("Something went wrong. Please try again.", "error");
    } finally {
      setIsGenerating(false);
      generateLockRef.current = false;
    }
  };

  return (
    <PageTransition>
      <div className="bg-[#0A0A0F] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-5">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20">
                <Mic className="h-5 w-5 text-violet-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">AI Voiceover</h1>
            </div>
            <p className="text-zinc-400">
              Generate professional voiceovers from text using AI voices.
            </p>
          </div>

          {/* Script Input */}
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-100">Script</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Enter your voiceover script here... (min 10 characters)"
                value={text}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_CHARS) setText(e.target.value);
                }}
                rows={6}
                className="min-h-[150px] resize-y border-zinc-700 bg-zinc-800/60 text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:ring-violet-500/20"
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">
                  {charCount > 0 && (
                    <>
                      Est. duration:{" "}
                      <span className="text-zinc-300">{formatDuration(durationSeconds)}</span>
                      {" \u00B7 "}
                      Cost:{" "}
                      <span className="text-violet-400">{creditCost} credits</span>
                    </>
                  )}
                </span>
                <span
                  className={
                    charCount > MAX_CHARS * 0.9
                      ? "text-amber-400"
                      : "text-zinc-500"
                  }
                >
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Voice Selector */}
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-100">Voice</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {VOICE_OPTIONS.map((voice) => {
                  const isSelected = selectedVoiceId === voice.id;
                  return (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoiceId(voice.id)}
                      className={`group relative flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30"
                          : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-600 hover:bg-zinc-800/70"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-sm font-medium text-zinc-100">
                          {voice.name}
                        </span>
                        <span className="text-base">
                          {LANGUAGE_FLAGS[voice.language] ?? "\u{1F30D}"}
                        </span>
                      </div>
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                              voice.gender === "female"
                                ? "bg-pink-500/20 text-pink-400"
                                : "bg-sky-500/20 text-sky-400"
                            }`}
                          >
                            {voice.gender === "female" ? "F" : "M"}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {voice.language.toUpperCase()}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handlePreviewVoice(voice.id, e)}
                          className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                            previewingVoice === voice.id
                              ? "bg-violet-500 text-white"
                              : "bg-zinc-700/50 text-zinc-400 hover:bg-violet-500/30 hover:text-violet-300"
                          }`}
                          title={previewingVoice === voice.id ? "Stop preview" : "Preview voice"}
                        >
                          {loadingPreview === voice.id ? (
                            <GenesisButtonLoader />
                          ) : previewingVoice === voice.id ? (
                            <Square className="h-3 w-3" />
                          ) : (
                            <Play className="h-3.5 w-3.5 ml-0.5" />
                          )}
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Speed Slider */}
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-100">Speed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-zinc-400">0.5x</span>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-violet-500 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
                />
                <span className="text-sm text-zinc-400">2.0x</span>
              </div>
              <div className="text-center">
                <span className="rounded-lg bg-zinc-800 px-3 py-1 text-sm font-medium text-violet-400">
                  {speed.toFixed(1)}x
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <div className="flex flex-col items-center gap-4">
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || isLoading}
              loading={isGenerating}
              className="h-14 w-full max-w-md rounded-xl bg-violet-600 text-base font-semibold text-white transition-all hover:bg-violet-500 disabled:opacity-50 sm:w-auto sm:min-w-[280px]"
            >
              <span className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Generate Voiceover
                {charCount >= 10 && (
                  <span className="ml-1 text-sm text-violet-200">
                    ({creditCost} credits)
                  </span>
                )}
              </span>
            </Button>

            {!hasEnoughCredits && charCount >= 10 && (
              <p className="text-sm text-amber-400">
                Not enough credits. You need {creditCost} credits but have{" "}
                {user?.creditBalance ?? 0}.
              </p>
            )}
          </div>

          {/* Error State */}
          {generationError && !isGenerating && !audioUrl && (
            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-300 font-medium">Generation Failed</p>
                    <p className="text-sm text-zinc-400 mt-1">{generationError}</p>
                    <button
                      onClick={handleGenerate}
                      disabled={!canGenerate}
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

          {/* Audio Player */}
          {audioUrl && (
            <Card className="border-zinc-800 bg-zinc-900/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-zinc-100">
                  <Play className="h-5 w-5 text-violet-400" />
                  Your Voiceover
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <audio
                  controls
                  src={audioUrl}
                  className="w-full rounded-lg"
                  controlsList="noplaybackrate"
                />
                <a
                  href={audioUrl}
                  download={`voiceover-${jobId || "audio"}.mp3`}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 hover:text-white"
                >
                  <Download className="h-4 w-4" />
                  Download MP3
                </a>
              </CardContent>
            </Card>
          )}

          {/* Processing State (no audio yet, but job submitted) */}
          {isGenerating && !audioUrl && (
            <Card className="border-zinc-800 bg-zinc-900/60">
              <CardContent className="flex flex-col items-center gap-3 py-8">
                <GenesisLoader size="md" />
                <p className="text-sm text-zinc-400">
                  Generating your voiceover... This may take up to a minute.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Mobile: Fixed Generate button at bottom */}
      <MobileActionBar>
        <Button
          className="w-full shadow-lg shadow-violet-600/20"
          disabled={!canGenerate || isLoading}
          loading={isGenerating}
          onClick={handleGenerate}
        >
          {isGenerating ? (
            "Generating Voiceover..."
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Generate Voiceover
              {charCount >= 10 && (
                <span className="ml-1 text-sm text-violet-200">
                  ({creditCost} credits)
                </span>
              )}
            </>
          )}
        </Button>
      </MobileActionBar>

      {/* Spacer for mobile action bar */}
      <div className="h-20 lg:hidden" />
    </PageTransition>
  );
}
