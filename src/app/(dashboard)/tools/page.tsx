"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/motion";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/ui/toast";
import { uploadFile } from "@/lib/upload-client";
import { trackEvent } from "@/lib/analytics-events";
import { GenesisButtonLoader } from "@/components/ui/genesis-loader";
import { Upload, Zap, Download, ArrowLeft, Lock, CheckCircle2, AlertCircle } from "lucide-react";

// Creator Tools — one input, one button, one result. The registry on the
// server decides what exists, what it costs and who can use it; this page
// just renders it.

type InputKind = "video" | "image" | "audio" | "text";

interface ToolField {
  key: string;
  label: string;
  kind: "select" | "text" | "textarea" | "number";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  default?: string | number;
  required?: boolean;
  help?: string;
}

interface Tool {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  inputs: Array<{ kind: InputKind; key: string; label: string; required?: boolean }>;
  fields?: ToolField[];
  credits: number;
  minPlan: "free" | "creator" | "pro" | "studio";
  mode: "sync" | "job";
  outputKind: "image" | "video" | "audio";
  estimatedSeconds: number;
}

const PLAN_RANK = { free: 0, creator: 1, pro: 2, studio: 3 } as const;
const ACCEPT: Record<InputKind, string> = {
  video: "video/mp4,video/webm,video/quicktime",
  image: "image/jpeg,image/png,image/webp",
  audio: "audio/mpeg,audio/wav,audio/mp3",
  text: "",
};

export default function ToolsPage() {
  const { user, updateCreditBalance, setCreditPurchaseOpen, isInitialized } = useStore();
  const { toast } = useToast();

  const [tools, setTools] = useState<Tool[]>([]);
  const [selected, setSelected] = useState<Tool | null>(null);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; kind: Tool["outputKind"] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/tools")
      .then((r) => (r.ok ? r.json() : { tools: [] }))
      .then((d) => setTools(d.tools || []))
      .catch(() => {});
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pick = (tool: Tool) => {
    setSelected(tool);
    setFiles({});
    setPreviews({});
    setResult(null);
    setError(null);
    setProgress(0);
    const defaults: Record<string, string> = {};
    for (const f of tool.fields || []) if (f.default !== undefined) defaults[f.key] = String(f.default);
    setValues(defaults);
  };

  const onFile = (key: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
    setPreviews((prev) => {
      const next = { ...prev };
      if (prev[key]) URL.revokeObjectURL(prev[key]);
      if (file) next[key] = URL.createObjectURL(file);
      else delete next[key];
      return next;
    });
  };

  const userPlan = user?.plan || "free";
  const canUse = (tool: Tool) => !!user?.isOwner || PLAN_RANK[userPlan as keyof typeof PLAN_RANK] >= PLAN_RANK[tool.minPlan];
  const hasCredits = (tool: Tool) => !!user?.isOwner || (user?.creditBalance ?? 0) >= tool.credits;

  const ready =
    !!selected &&
    selected.inputs.every((i) => !i.required || !!files[i.key]) &&
    (selected.fields || []).every((f) => !f.required || !!values[f.key]);

  const run = useCallback(async () => {
    if (!selected || lockRef.current || running) return;
    if (!canUse(selected)) {
      toast(`${selected.name} needs the ${selected.minPlan} plan.`, "error");
      return;
    }
    if (!hasCredits(selected)) {
      setCreditPurchaseOpen(true);
      return;
    }
    lockRef.current = true;
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress(5);
    trackEvent("tool_started", { tool: selected.id });

    try {
      const inputs: Record<string, string> = { ...values };
      for (const spec of selected.inputs) {
        const f = files[spec.key];
        if (!f) continue;
        setStage(`Uploading ${spec.label.toLowerCase()}…`);
        inputs[spec.key] = await uploadFile(f, spec.kind === "text" ? "image" : spec.kind);
      }

      setStage("Working…");
      setProgress(20);
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: selected.id, inputs }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.upgrade) toast(data.error, "error");
        setError(data.error || "Something went wrong");
        trackEvent("tool_failed", { tool: selected.id, status: res.status });
        return;
      }
      if (!user?.isOwner) updateCreditBalance((user?.creditBalance ?? 0) - (data.creditsCost || selected.credits));

      if (data.status === "completed") {
        setResult({ url: data.outputUrl, kind: data.outputKind });
        setProgress(100);
        setStage("Done");
        trackEvent("tool_completed", { tool: selected.id });
        return;
      }

      // Job mode — poll.
      const jobId = data.jobId as string;
      const startedAt = Date.now();
      await new Promise<void>((resolve) => {
        pollRef.current = setInterval(async () => {
          try {
            const r = await fetch(`/api/tools/${jobId}`);
            if (!r.ok) return;
            const s = await r.json();
            if (s.status === "completed" && s.outputUrl) {
              if (pollRef.current) clearInterval(pollRef.current);
              setResult({ url: s.outputUrl, kind: s.outputKind });
              setProgress(100);
              setStage("Done");
              trackEvent("tool_completed", { tool: selected.id });
              resolve();
            } else if (s.status === "failed") {
              if (pollRef.current) clearInterval(pollRef.current);
              setError(s.errorMessage || "This tool failed. Your credits were refunded.");
              trackEvent("tool_failed", { tool: selected.id });
              resolve();
            } else {
              const elapsed = (Date.now() - startedAt) / 1000;
              setProgress(Math.min(90, 20 + Math.round((elapsed / selected.estimatedSeconds) * 70)));
              setStage(elapsed > selected.estimatedSeconds ? "Almost there…" : "Working…");
            }
          } catch {
            // transient; keep polling
          }
        }, 4000);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setRunning(false);
      lockRef.current = false;
    }
  }, [selected, values, files, running, user, updateCreditBalance, setCreditPurchaseOpen, toast]);

  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-[50vh] text-zinc-400">Loading…</div>;
  }

  return (
    <PageTransition className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Creator Tools</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Quick, one-click tools for the things every creator does daily. Credits are only charged when a tool succeeds.
        </p>
      </div>

      {!selected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((t) => {
            const locked = !canUse(t);
            return (
              <button
                key={t.id}
                onClick={() => pick(t)}
                className={`text-left rounded-2xl border p-5 transition-all hover:-translate-y-0.5 ${
                  locked
                    ? "border-white/[0.06] bg-white/[0.02] opacity-80"
                    : "border-white/[0.10] bg-gradient-to-br from-white/[0.04] to-transparent hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-3xl">{t.emoji}</span>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 whitespace-nowrap">
                    {t.credits} credits
                  </span>
                </div>
                <h3 className="mt-3 font-semibold text-zinc-100">{t.name}</h3>
                <p className="mt-1 text-sm text-zinc-400 leading-relaxed">{t.tagline}</p>
                {locked && (
                  <p className="mt-3 text-xs text-amber-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> {t.minPlan.charAt(0).toUpperCase() + t.minPlan.slice(1)} plan and up
                  </p>
                )}
              </button>
            );
          })}
          {tools.length === 0 && <p className="text-zinc-500 text-sm">Loading tools…</p>}
        </div>
      )}

      {selected && (
        <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
          <Card>
            <CardContent className="p-5 space-y-5">
              <button onClick={() => setSelected(null)} className="text-sm text-zinc-400 hover:text-white flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> All tools
              </button>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selected.emoji}</span>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">{selected.name}</h2>
                  <p className="text-sm text-zinc-400">{selected.tagline}</p>
                </div>
              </div>

              {selected.inputs.map((spec) => (
                <div key={spec.key}>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    {spec.label}
                    {spec.required && <span className="text-red-400"> *</span>}
                  </label>
                  <label
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition ${
                      files[spec.key] ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/[0.12] hover:border-violet-500/40"
                    }`}
                  >
                    <input
                      type="file"
                      accept={ACCEPT[spec.kind]}
                      className="hidden"
                      onChange={(e) => onFile(spec.key, e.target.files?.[0] || null)}
                    />
                    {previews[spec.key] && spec.kind === "image" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previews[spec.key]} alt="" className="max-h-40 rounded-lg object-contain" />
                    )}
                    {previews[spec.key] && spec.kind === "video" && (
                      <video src={previews[spec.key]} className="max-h-40 rounded-lg" controls muted />
                    )}
                    {previews[spec.key] && spec.kind === "audio" && <audio src={previews[spec.key]} controls className="w-full" />}
                    {!files[spec.key] && (
                      <>
                        <Upload className="w-6 h-6 text-zinc-500" />
                        <span className="text-sm text-zinc-400">Click to choose a {spec.kind}</span>
                      </>
                    )}
                    {files[spec.key] && <span className="text-xs text-zinc-500">{files[spec.key]?.name}</span>}
                  </label>
                </div>
              ))}

              {(selected.fields || []).map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    {f.label}
                    {f.required && <span className="text-red-400"> *</span>}
                  </label>
                  {f.kind === "select" ? (
                    <select
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500/50"
                    >
                      {(f.options || []).map((o) => (
                        <option key={o.value} value={o.value} className="bg-[#111118]">
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.kind === "textarea" ? (
                    <textarea
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      rows={5}
                      className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50"
                    />
                  ) : (
                    <input
                      type={f.kind === "number" ? "number" : "text"}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50"
                    />
                  )}
                  {f.help && <p className="text-xs text-zinc-500 mt-1">{f.help}</p>}
                </div>
              ))}

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-zinc-400 flex items-center gap-1">
                  <Zap className="w-4 h-4 text-violet-400" /> {selected.credits} credits · ~{selected.estimatedSeconds}s
                </span>
                <Button onClick={run} disabled={!ready || running || !canUse(selected)}>
                  {running ? <GenesisButtonLoader /> : <Zap className="w-4 h-4" />}
                  {running ? stage || "Working…" : canUse(selected) ? "Run" : "Upgrade to use"}
                </Button>
              </div>
              {!hasCredits(selected) && canUse(selected) && (
                <p className="text-xs text-amber-400">
                  You need {selected.credits} credits.{" "}
                  <button onClick={() => setCreditPurchaseOpen(true)} className="underline">
                    Buy credits
                  </button>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 min-h-[320px] flex flex-col">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Result</h3>
              {running && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-full max-w-xs h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-sm text-zinc-400">{stage}</p>
                  <p className="text-xs text-zinc-600">You can leave this page — finished videos also appear in your Gallery.</p>
                </div>
              )}
              {!running && error && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
              {!running && result && (
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Ready
                  </div>
                  {result.kind === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.url} alt="Result" className="rounded-xl max-h-[420px] object-contain bg-black/40" />
                  )}
                  {result.kind === "video" && <video src={result.url} controls className="rounded-xl max-h-[420px] bg-black" />}
                  {result.kind === "audio" && <audio src={result.url} controls className="w-full" />}
                  <a
                    href={result.url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 self-start rounded-lg bg-white/[0.06] hover:bg-white/[0.1] px-3 py-2 text-sm text-zinc-200"
                  >
                    <Download className="w-4 h-4" /> Download
                  </a>
                </div>
              )}
              {!running && !result && !error && (
                <div className="flex-1 flex items-center justify-center text-sm text-zinc-600">Your result will appear here.</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageTransition>
  );
}
