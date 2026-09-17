"use client";

import { useCallback, useRef, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/motion";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { uploadFile } from "@/lib/upload-client";
import { trackEvent } from "@/lib/analytics-events";
import {
  ANNOUNCER_VOICES,
  CONSENT_TEXT,
  DEFAULT_ANNOUNCER,
  MAX_FEATURES,
  MIN_FEATURES,
  commercialCredits,
  estimatedSeconds,
  normaliseFeatures,
} from "@/lib/action-figure";
import { Package, Upload, Zap, Download, Share2, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";

// AI Action Figure — a selfie becomes a boxed collectible and then an advert
// for it. The page does three things the API cannot: it takes the photo, it
// takes the consent, and it waits. Everything else is server-side.

const PLAN_RANK = { free: 0, creator: 1, pro: 2, studio: 3 } as const;
const POLL_MS = 5000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

export default function ActionFigurePage() {
  const { user, updateCreditBalance, setCreditPurchaseOpen, isInitialized } = useStore();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [figureName, setFigureName] = useState("");
  const [featuresText, setFeaturesText] = useState("");
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_ANNOUNCER);

  const [writing, setWriting] = useState(false);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [figureImageUrl, setFigureImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lockRef = useRef(false);

  const features = normaliseFeatures(featuresText);
  const userPlan = user?.plan || "free";
  const canUse = !!user?.isOwner || PLAN_RANK[userPlan as keyof typeof PLAN_RANK] >= PLAN_RANK.creator;
  const credits = commercialCredits(Math.max(features.length, MIN_FEATURES));
  const hasCredits = !!user?.isOwner || (user?.creditBalance ?? 0) >= credits;
  const ready = !!file && consent && figureName.trim().length > 0 && features.length >= MIN_FEATURES;

  const onFile = (chosen: File | null) => {
    if (chosen && !chosen.type.startsWith("image/")) {
      toast("Choose a photo — JPG, PNG or WebP.", "error");
      return;
    }
    setFile(chosen);
    setVideoUrl(null);
    setFigureImageUrl(null);
    setError(null);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return chosen ? URL.createObjectURL(chosen) : null;
    });
  };

  // "Write them for me" — 5 credits, same helper shape as AI Singer's lyrics.
  const writeFeatures = async () => {
    if (writing || running) return;
    if (!figureName.trim()) {
      toast("Name your figure first — it goes on the box.", "error");
      return;
    }
    setWriting(true);
    try {
      const res = await fetch("/api/action-figure/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ figureName, about: featuresText }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.features)) {
        toast(data.error || "Couldn't write the features right now.", "error");
        return;
      }
      setFeaturesText(data.features.join("\n"));
      if (!user?.isOwner && data.creditsCost) {
        updateCreditBalance((user?.creditBalance ?? 0) - data.creditsCost);
      }
      toast("Features written — edit anything you like.", "success");
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setWriting(false);
    }
  };

  const run = useCallback(async () => {
    if (lockRef.current || running || !file) return;
    if (!consent) {
      toast("Please confirm the photo is yours to use.", "error");
      return;
    }
    if (!canUse) {
      toast("AI Action Figure needs the Creator plan or higher.", "error");
      return;
    }
    if (!hasCredits) {
      setCreditPurchaseOpen(true);
      return;
    }

    lockRef.current = true;
    setRunning(true);
    setError(null);
    setVideoUrl(null);
    setProgress(5);
    setStage("Uploading your photo…");
    trackEvent("tool_started", { tool: "action-figure" });

    try {
      const selfieUrl = await uploadFile(file, "image");

      setProgress(15);
      setStage("Boxing your figure and filming the advert…");

      const res = await fetch("/api/action-figure/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selfieUrl,
          figureName,
          features,
          voiceId,
          consent: true,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        trackEvent("tool_failed", { tool: "action-figure", status: res.status });
        return;
      }

      if (data.figureImageUrl) setFigureImageUrl(data.figureImageUrl);
      if (!user?.isOwner && data.creditsCost) {
        updateCreditBalance((user?.creditBalance ?? 0) - data.creditsCost);
      }

      setProgress(80);
      setStage("Adding the announcer and burning the features on…");

      const startedAt = Date.now();
      await new Promise<void>((resolve) => {
        const timer = setInterval(async () => {
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            clearInterval(timer);
            setError("This took too long. Check your Gallery in a few minutes.");
            resolve();
            return;
          }
          try {
            const poll = await fetch(`/api/action-figure/${data.jobId}`);
            if (!poll.ok) return;
            const state = await poll.json();
            if (state.figureImageUrl) setFigureImageUrl(state.figureImageUrl);
            if (state.status === "completed" && state.videoUrl) {
              clearInterval(timer);
              setVideoUrl(state.videoUrl);
              setProgress(100);
              setStage("Done");
              trackEvent("tool_completed", { tool: "action-figure" });
              resolve();
            } else if (state.status === "failed") {
              clearInterval(timer);
              setError(state.errorMessage || "The advert failed. Your credits were refunded.");
              trackEvent("tool_failed", { tool: "action-figure" });
              resolve();
            } else if (typeof state.progress === "number") {
              setProgress(Math.max(80, Math.min(99, state.progress)));
            }
          } catch {
            // Transient — keep polling.
          }
        }, POLL_MS);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setRunning(false);
      lockRef.current = false;
    }
  }, [file, consent, canUse, hasCredits, figureName, features, voiceId, running, user, updateCreditBalance, setCreditPurchaseOpen, toast]);

  const share = async () => {
    if (!videoUrl) return;
    const videoId = videoUrl.split("/").pop();
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai"}/explore/${videoId}`;
    const shareText = `${figureName} — the action figure. Made with iVideo Studio`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: figureName, text: shareText, url: shareUrl });
        return;
      } catch {
        // Cancelled, or unavailable — fall through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast("Share link copied to clipboard!", "success");
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`, "_blank");
    }
  };

  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-[50vh] text-zinc-400">Loading…</div>;
  }

  const actionButton = (
    <Button
      className="w-full shadow-lg shadow-violet-600/20"
      disabled={!ready || running || !canUse}
      loading={running}
      onClick={run}
    >
      {running ? stage || "Working…" : !canUse ? "Creator+ Plan Required" : (
        <>
          <Package className="w-4 h-4" /> Make my action figure
        </>
      )}
    </Button>
  );

  return (
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Package className="w-7 h-7 text-violet-400" />
          AI Action Figure
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          One selfie becomes a boxed collectible — and a toy advert for it, with an announcer reading your special features.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your photo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer transition ${
                  file ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/[0.12] hover:border-violet-500/40"
                }`}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] || null)}
                />
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className="max-h-56 rounded-lg object-contain" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-zinc-500" />
                    <span className="text-sm text-zinc-400">Click to choose a photo</span>
                    <span className="text-xs text-zinc-500">A clear head-and-shoulders selfie works best</span>
                  </>
                )}
                {file && <span className="text-xs text-zinc-500">{file.name}</span>}
              </label>

              {/* Mandatory. The API refuses without it, so this is not a formality. */}
              <label className="flex items-start gap-3 rounded-xl border border-white/[0.10] bg-white/[0.02] p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500"
                />
                <span className="text-sm text-zinc-300">
                  {CONSENT_TEXT}
                  <span className="block text-xs text-zinc-500 mt-1">
                    This tool will not make a figure of a well-known public figure.
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">The figure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Name on the box <span className="text-red-400">*</span>
                </label>
                <input
                  value={figureName}
                  onChange={(e) => setFigureName(e.target.value)}
                  placeholder="e.g. CAPTAIN SIHLE"
                  maxLength={24}
                  className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Special features <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  rows={5}
                  placeholder={"Never misses a deadline\nComes with laptop and cold coffee\nKung-fu grip on the aux cable"}
                  className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  One per line, {MIN_FEATURES}–{MAX_FEATURES} of them. Each one gets its own shot, read out and burned on screen.
                  {" "}
                  <span className={features.length >= MIN_FEATURES ? "text-emerald-400" : "text-zinc-500"}>
                    {features.length} so far.
                  </span>
                </p>
                <button
                  type="button"
                  onClick={writeFeatures}
                  disabled={writing || running}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 px-3 py-1.5 text-xs font-medium text-violet-200 disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" /> {writing ? "Writing…" : "Write them for me"}
                  <span className="text-violet-400/80">· 5 credits</span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Announcer</label>
                <select
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500/50"
                >
                  {ANNOUNCER_VOICES.map((v) => (
                    <option key={v.id} value={v.id} className="bg-[#111118]">
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {(figureImageUrl || videoUrl || error) && (
            <Card glow>
              <CardHeader>
                <CardTitle className="text-base">Result</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <p className="flex items-start gap-2 text-sm text-red-300">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
                  </p>
                )}
                {figureImageUrl && !videoUrl && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500">Your figure, boxed. The advert is still rendering.</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={figureImageUrl} alt="Boxed action figure" className="rounded-xl max-h-96 object-contain bg-black/40" />
                  </div>
                )}
                {videoUrl && (
                  <>
                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Ready — it is in your Gallery too
                    </div>
                    <div className="rounded-xl overflow-hidden border border-white/[0.10]">
                      <video src={videoUrl} controls className="w-full max-h-[480px] bg-[#0D0D14]" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={videoUrl}
                        download
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
                      >
                        <Download className="w-4 h-4" /> Download
                      </a>
                      <button
                        onClick={share}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 text-sm font-medium transition-colors"
                      >
                        <Share2 className="w-4 h-4" /> Share
                      </button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="hidden lg:block space-y-4">
          <Card glow className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Photo</span>
                  <span className="text-zinc-200 truncate ml-2 max-w-[160px]">{file ? file.name : "None yet"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Features</span>
                  <span className="text-zinc-200">{features.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Est. time</span>
                  <span className="text-zinc-200">~{Math.round(estimatedSeconds(Math.max(features.length, MIN_FEATURES)) / 60)} min</span>
                </div>
              </div>

              <div className="border-t border-white/[0.10] pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-zinc-300">Cost</span>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-violet-400" />
                    <span className="text-xl font-bold text-violet-300">{credits}</span>
                    <span className="text-xs text-zinc-400">credits</span>
                  </div>
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-zinc-400">Your balance</span>
                  <span className={`text-xs font-semibold ${hasCredits ? "text-emerald-400" : "text-red-400"}`}>
                    {(user?.creditBalance ?? 0).toLocaleString()} credits
                  </span>
                </div>
              </div>

              {running && (
                <div className="space-y-2">
                  <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-zinc-400">{stage}</p>
                  <p className="text-[10px] text-zinc-600">Keep this tab open — it takes a few minutes.</p>
                </div>
              )}

              {actionButton}

              {!hasCredits && canUse && (
                <p className="text-xs text-center text-amber-400">
                  You need {credits - (user?.creditBalance ?? 0)} more credits.{" "}
                  <button onClick={() => setCreditPurchaseOpen(true)} className="underline">
                    Buy credits
                  </button>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <MobileActionBar>{actionButton}</MobileActionBar>
      <div className="h-20 lg:hidden" />
    </PageTransition>
  );
}
