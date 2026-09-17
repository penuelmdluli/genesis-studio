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
import { Heart, Upload, Zap, Download, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";

// Face Blend — two partners' photos become one invented child's face, and that
// face is what every later scene is built from. The page does the three things
// the API cannot: it takes the two photos, it takes the consent, and it waits.
//
// The consent checkbox is not advisory. Nothing submits until it is ticked,
// and the API refuses the request as well — one of the two people in these
// photographs is not the person clicking the button.

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
  const [error, setError] = useState<string | null>(null);

  const lockRef = useRef(false);

  const hasCredits = !!user?.isOwner || (user?.creditBalance ?? 0) >= BLEND_CREDITS;
  const ready = !!fileA && !!fileB && consent;

  const onFile = (slot: "a" | "b", chosen: File | null) => {
    if (chosen && !chosen.type.startsWith("image/")) {
      toast("Choose a photo — JPG, PNG or WebP.", "error");
      return;
    }
    setChildFaceUrl(null);
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
          Two photos become one invented child&apos;s face — the face every later scene is built from.
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
