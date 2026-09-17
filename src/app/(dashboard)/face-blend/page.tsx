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
import { BLEND_CREDITS, BLEND_ESTIMATE_SECONDS, CONSENT_TEXT } from "@/lib/face-blend";
import {
  MONTAGE_CREDITS,
  MONTAGE_ESTIMATE_SECONDS,
  MONTAGE_SCENES,
} from "@/lib/child-montage";
import { Heart, Upload, Zap, Download, Sparkles, AlertCircle, CheckCircle2, Film } from "lucide-react";

// Face Blend — two partners' photos become one invented child's face, and that
// face is what every later scene is built from. The page does the three things
// the API cannot: it takes the two photos, it takes the consent, and it waits.
//
// The consent checkbox is not advisory. Nothing submits until it is ticked,
// and the API refuses the request as well — one of the two people in these
// photographs is not the person clicking the button.
//
// The montage is the second half of the page and the thing people came for: a
// short film of that child's day, made from the face they just paid for. It
// only appears once the face exists, because it is filmed from it — and it is
// charged separately, so someone who only wanted the photograph never pays for
// a film they did not ask for.

/** How often the montage job is polled while it is being joined. */
const POLL_MS = 5_000;
/** How long the page waits before sending them to the Gallery instead. */
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

export default function FaceBlendPage() {
  const { user, updateCreditBalance, setCreditPurchaseOpen, isInitialized } = useStore();
  const { toast } = useToast();

  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [previewA, setPreviewA] = useState<string | null>(null);
  const [previewB, setPreviewB] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState("");
  const [childFaceUrl, setChildFaceUrl] = useState<string | null>(null);
  const [blendJobId, setBlendJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The montage — filmed from the face above, charged on its own.
  const [montaging, setMontaging] = useState(false);
  const [montageStage, setMontageStage] = useState("");
  const [montageProgress, setMontageProgress] = useState(0);
  const [montageVideoUrl, setMontageVideoUrl] = useState<string | null>(null);
  const [montageError, setMontageError] = useState<string | null>(null);

  const lockRef = useRef(false);
  const montageLockRef = useRef(false);

  const hasCredits = !!user?.isOwner || (user?.creditBalance ?? 0) >= BLEND_CREDITS;
  const hasMontageCredits = !!user?.isOwner || (user?.creditBalance ?? 0) >= MONTAGE_CREDITS;
  const ready = !!fileA && !!fileB && consent;

  const onFile = (slot: "a" | "b", chosen: File | null) => {
    if (chosen && !chosen.type.startsWith("image/")) {
      toast("Choose a photo — JPG, PNG or WebP.", "error");
      return;
    }
    setChildFaceUrl(null);
    setBlendJobId(null);
    setMontageVideoUrl(null);
    setMontageError(null);
    setError(null);
    const setFile = slot === "a" ? setFileA : setFileB;
    const setPreview = slot === "a" ? setPreviewA : setPreviewB;
    setFile(chosen);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return chosen ? URL.createObjectURL(chosen) : null;
    });
  };

  const run = useCallback(async () => {
    if (lockRef.current || running || !fileA || !fileB) return;
    // No checkbox, no job. The button is disabled too; this is what catches a
    // keyboard submit.
    if (!consent) {
      toast("Please confirm both people consent to their photos being used.", "error");
      return;
    }
    if (!hasCredits) {
      setCreditPurchaseOpen(true);
      return;
    }

    lockRef.current = true;
    setRunning(true);
    setError(null);
    setChildFaceUrl(null);
    setBlendJobId(null);
    setMontageVideoUrl(null);
    setMontageError(null);
    setStage("Uploading both photos…");
    trackEvent("tool_started", { tool: "face-blend" });

    try {
      const [photoAUrl, photoBUrl] = await Promise.all([
        uploadFile(fileA, "image"),
        uploadFile(fileB, "image"),
      ]);

      setStage("Blending the two faces into one child…");

      const res = await fetch("/api/face-blend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoAUrl, photoBUrl, consent: true }),
      });
      const data = await res.json();

      if (!res.ok || !data.childFaceUrl) {
        setError(data.error || "Something went wrong.");
        trackEvent("tool_failed", { tool: "face-blend", status: res.status });
        return;
      }

      setChildFaceUrl(data.childFaceUrl);
      // Kept because the montage is filmed from this job's stored face: the
      // API takes the job id, never a url off the page.
      setBlendJobId(data.jobId || null);
      if (!user?.isOwner && data.creditsCost) {
        updateCreditBalance((user?.creditBalance ?? 0) - data.creditsCost);
      }
      setStage("Done");
      trackEvent("tool_completed", { tool: "face-blend" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setRunning(false);
      lockRef.current = false;
    }
  }, [fileA, fileB, consent, hasCredits, running, user, updateCreditBalance, setCreditPurchaseOpen, toast]);

  // The montage. Three scenes are filmed inside the generate request, which is
  // why it is allowed to take minutes; the join runs on afterwards on the video
  // service, which is what the poll below is waiting for.
  const makeMontage = useCallback(async () => {
    if (montageLockRef.current || montaging || !blendJobId) return;
    if (!hasMontageCredits) {
      setCreditPurchaseOpen(true);
      return;
    }

    montageLockRef.current = true;
    setMontaging(true);
    setMontageError(null);
    setMontageVideoUrl(null);
    setMontageProgress(5);
    setMontageStage("Filming first steps, breakfast and bedtime…");
    trackEvent("tool_started", { tool: "child-montage" });

    try {
      const res = await fetch("/api/child-montage/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blendJobId }),
      });
      const data = await res.json();

      if (!res.ok || !data.jobId) {
        // Every failing path on the API refunds before it answers, and its
        // message says so — so this is shown as written rather than rewritten.
        setMontageError(data.error || "Something went wrong.");
        trackEvent("tool_failed", { tool: "child-montage", status: res.status });
        return;
      }

      if (!user?.isOwner && data.creditsCost) {
        updateCreditBalance((user?.creditBalance ?? 0) - data.creditsCost);
      }

      setMontageProgress(80);
      setMontageStage("Putting the three scenes together with music…");

      const startedAt = Date.now();
      await new Promise<void>((resolve) => {
        const timer = setInterval(async () => {
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            clearInterval(timer);
            setMontageError("This took too long. Check your Gallery in a few minutes.");
            resolve();
            return;
          }
          try {
            const poll = await fetch(`/api/child-montage/${data.jobId}`);
            if (!poll.ok) return;
            const state = await poll.json();
            if (state.status === "completed" && state.videoUrl) {
              clearInterval(timer);
              setMontageVideoUrl(state.videoUrl);
              setMontageProgress(100);
              setMontageStage("Done");
              trackEvent("tool_completed", { tool: "child-montage" });
              resolve();
            } else if (state.status === "failed") {
              clearInterval(timer);
              setMontageError(state.errorMessage || "The montage failed. Your credits were refunded.");
              trackEvent("tool_failed", { tool: "child-montage" });
              resolve();
            } else if (typeof state.progress === "number") {
              setMontageProgress(Math.max(80, Math.min(99, state.progress)));
            }
          } catch {
            // Transient — keep polling.
          }
        }, POLL_MS);
      });
    } catch (err) {
      setMontageError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setMontaging(false);
      montageLockRef.current = false;
    }
  }, [blendJobId, hasMontageCredits, montaging, user, updateCreditBalance, setCreditPurchaseOpen]);

  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-[50vh] text-zinc-400">Loading…</div>;
  }

  const slot = (which: "a" | "b", label: string, file: File | null, preview: string | null) => (
    <label
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition ${
        file ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/[0.12] hover:border-violet-500/40"
      }`}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onFile(which, e.target.files?.[0] || null)}
      />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="max-h-44 rounded-lg object-contain" />
      ) : (
        <>
          <Upload className="w-7 h-7 text-zinc-500" />
          <span className="text-sm text-zinc-300">{label}</span>
          <span className="text-xs text-zinc-500">A clear, front-facing photo works best</span>
        </>
      )}
      {file && <span className="text-xs text-zinc-500 truncate max-w-full">{file.name}</span>}
    </label>
  );

  const actionButton = (
    <Button
      className="w-full shadow-lg shadow-violet-600/20"
      disabled={!ready || running}
      loading={running}
      onClick={run}
    >
      {running ? stage || "Working…" : (
        <>
          <Sparkles className="w-4 h-4" /> Create our child&apos;s face
        </>
      )}
    </Button>
  );

  return (
    <PageTransition className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Heart className="w-7 h-7 text-violet-400" />
          Face Blend
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Two photos become one invented child&apos;s face — and then a short film of their day.
          Made for an anniversary or a gender reveal, not for every afternoon.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">The two photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {slot("a", "Partner A", fileA, previewA)}
                {slot("b", "Partner B", fileB, previewB)}
              </div>

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
                    The child is invented by AI. It is not a photo of a real child.
                  </span>
                </span>
              </label>

              {!consent && (fileA || fileB) && (
                <p className="text-xs text-amber-400">
                  Tick the box above before you can create anything.
                </p>
              )}
            </CardContent>
          </Card>

          {(childFaceUrl || error) && (
            <Card glow>
              <CardHeader>
                <CardTitle className="text-base">Your child&apos;s face</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <p className="flex items-start gap-2 text-sm text-red-300">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
                  </p>
                )}
                {childFaceUrl && (
                  <>
                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Saved — everything you make next uses this face
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={childFaceUrl}
                      alt="The invented child's reference face"
                      className="rounded-xl max-h-96 object-contain bg-black/40"
                    />
                    <a
                      href={childFaceUrl}
                      download
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
                    >
                      <Download className="w-4 h-4" /> Download
                    </a>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* The film. Only offered once the face exists, because it is filmed
              from it — and charged separately, so the photograph on its own
              stays the price it was. */}
          {childFaceUrl && blendJobId && (
            <Card glow>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Film className="w-4 h-4 text-violet-400" /> A day with our child
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-zinc-400">
                  Three moments from one day in their life — {MONTAGE_SCENES.map((s) => s.title.toLowerCase()).join(", ")} —
                  filmed from the face above and joined into one short film with music under it.
                </p>

                {montageError && (
                  <p className="flex items-start gap-2 text-sm text-red-300">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {montageError}
                  </p>
                )}

                {montaging && (
                  <div className="space-y-2">
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-violet-500 transition-all duration-700"
                        style={{ width: `${montageProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-zinc-400">
                      {montageStage} This takes about {Math.round(MONTAGE_ESTIMATE_SECONDS / 60)} minutes — keep this page open.
                    </p>
                  </div>
                )}

                {montageVideoUrl ? (
                  <>
                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Saved to your Gallery
                    </div>
                    <video
                      src={montageVideoUrl}
                      controls
                      playsInline
                      className="w-full rounded-xl max-h-[70vh] bg-black/40"
                    />
                    <a
                      href={montageVideoUrl}
                      download
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
                    >
                      <Download className="w-4 h-4" /> Download the film
                    </a>
                  </>
                ) : (
                  <>
                    <Button
                      className="w-full shadow-lg shadow-violet-600/20"
                      disabled={montaging}
                      loading={montaging}
                      onClick={makeMontage}
                    >
                      {montaging ? "Making the montage…" : (
                        <>
                          <Film className="w-4 h-4" />
                          {montageError ? "Try the montage again" : "Make the montage"} — {MONTAGE_CREDITS} credits
                        </>
                      )}
                    </Button>
                    {!montaging && !hasMontageCredits && (
                      <p className="text-xs text-center text-amber-400">
                        You need {MONTAGE_CREDITS - (user?.creditBalance ?? 0)} more credits.{" "}
                        <button onClick={() => setCreditPurchaseOpen(true)} className="underline">
                          Buy credits
                        </button>
                      </p>
                    )}
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
                  <span className="text-zinc-400">Partner A</span>
                  <span className="text-zinc-200 truncate ml-2 max-w-[160px]">{fileA ? fileA.name : "None yet"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Partner B</span>
                  <span className="text-zinc-200 truncate ml-2 max-w-[160px]">{fileB ? fileB.name : "None yet"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Consent</span>
                  <span className={consent ? "text-emerald-400" : "text-amber-400"}>
                    {consent ? "Given" : "Required"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Est. time</span>
                  <span className="text-zinc-200">~{BLEND_ESTIMATE_SECONDS}s</span>
                </div>
              </div>

              <div className="border-t border-white/[0.10] pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-zinc-300">Cost</span>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-violet-400" />
                    <span className="text-xl font-bold text-violet-300">{BLEND_CREDITS}</span>
                    <span className="text-xs text-zinc-400">credits</span>
                  </div>
                </div>
                {/* Said here as well as on the button, so nobody reaches the
                    second step thinking the first price covered both. */}
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-zinc-400">Then the montage</span>
                  <span className="text-xs text-zinc-300">+{MONTAGE_CREDITS} credits</span>
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-zinc-400">Your balance</span>
                  <span className={`text-xs font-semibold ${hasCredits ? "text-emerald-400" : "text-red-400"}`}>
                    {(user?.creditBalance ?? 0).toLocaleString()} credits
                  </span>
                </div>
              </div>

              {running && <p className="text-xs text-zinc-400">{stage}</p>}

              {actionButton}

              {!hasCredits && (
                <p className="text-xs text-center text-amber-400">
                  You need {BLEND_CREDITS - (user?.creditBalance ?? 0)} more credits.{" "}
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
