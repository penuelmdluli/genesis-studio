"use client";

import { useState, useEffect, useRef } from "react";
import { GenesisLoader } from "@/components/ui/genesis-loader";
import { CheckCircle2, X, Clock } from "lucide-react";

export interface ProgressStep {
  label: string;
  status: "pending" | "active" | "done" | "error";
}

interface GenerationProgressProps {
  /** Array of steps to display */
  steps: ProgressStep[];
  /** Current progress percentage (0-100) */
  percent: number;
  /** Current stage description shown below the progress bar */
  stageMessage?: string;
  /** Whether to show the elapsed timer */
  showTimer?: boolean;
  /** Whether the timer is running */
  timerActive?: boolean;
  /** Reassurance message at the bottom */
  footerMessage?: string;
  /** Compact mode for inline use */
  compact?: boolean;
}

/**
 * Premium generation progress tracker.
 * Shows a gradient progress bar, step-by-step checklist with animated
 * status indicators, elapsed timer, and reassurance messaging.
 *
 * Usage:
 * ```tsx
 * <GenerationProgress
 *   steps={[
 *     { label: "Uploading files", status: "done" },
 *     { label: "Generating video", status: "active" },
 *     { label: "Finalizing", status: "pending" },
 *   ]}
 *   percent={45}
 *   stageMessage="AI is rendering your scene..."
 * />
 * ```
 */
export function GenerationProgress({
  steps,
  percent,
  stageMessage,
  showTimer = true,
  timerActive = true,
  footerMessage,
  compact = false,
}: GenerationProgressProps) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerActive && showTimer) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else if (!timerActive && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [timerActive, showTimer]);

  const clamped = Math.min(100, Math.max(0, percent));
  const isDone = clamped >= 100;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const defaultFooter = clamped < 30
    ? "You can leave this page — your video will be saved to the gallery"
    : clamped < 80
    ? "Almost there — adding the finishing touches"
    : clamped < 100
    ? "Saving your final video..."
    : "Complete!";

  return (
    <div className={`rounded-xl bg-white/[0.03] border border-white/[0.10] ${compact ? "p-4" : "p-6"}`}>
      {/* Progress bar */}
      <div className="relative h-2 rounded-full bg-white/[0.08] mb-4 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out ${
            isDone
              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
              : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500"
          }`}
          style={{ width: `${clamped}%` }}
        />
        {!isDone && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
        )}
      </div>

      {/* Stage message + timer */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          {!isDone && <GenesisLoader size="sm" />}
          {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
          <p className={`text-sm font-medium truncate ${isDone ? "text-emerald-400" : "text-zinc-200"}`}>
            {isDone ? "Complete!" : stageMessage || "Processing..."}
          </p>
        </div>
        {showTimer && (
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 flex-shrink-0 ml-3">
            <Clock className="w-3 h-3" />
            {formatTime(elapsed)}
          </div>
        )}
      </div>

      {/* Step checklist */}
      {steps.length > 0 && (
        <div className={`space-y-1.5 ${compact ? "" : "mb-4"}`}>
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                step.status === "done" ? "bg-emerald-500/20" :
                step.status === "active" ? "bg-violet-500/20" :
                step.status === "error" ? "bg-red-500/20" :
                "bg-white/[0.06]"
              }`}>
                {step.status === "done" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : step.status === "active" ? (
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                ) : step.status === "error" ? (
                  <X className="w-3 h-3 text-red-400" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                )}
              </div>
              <span className={`text-xs transition-colors duration-300 ${
                step.status === "done" ? "text-emerald-400" :
                step.status === "active" ? "text-zinc-200 font-medium" :
                step.status === "error" ? "text-red-400" :
                "text-zinc-500"
              }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer reassurance */}
      {!compact && !isDone && (
        <p className="text-[10px] text-zinc-400 text-center mt-3">
          {footerMessage || defaultFooter}
        </p>
      )}
    </div>
  );
}

// ─── Hook for managing progress state ────────────────────────────────

export function useGenerationProgress() {
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [percent, setPercent] = useState(0);
  const [stageMessage, setStageMessage] = useState("");
  const [isActive, setIsActive] = useState(false);

  const start = (initialSteps: string[]) => {
    setSteps(initialSteps.map((label, i) => ({
      label,
      status: i === 0 ? "active" : "pending",
    })));
    setPercent(5);
    setIsActive(true);
  };

  const advanceStep = (message?: string) => {
    setSteps(prev => {
      const activeIdx = prev.findIndex(s => s.status === "active");
      if (activeIdx < 0) return prev;
      const updated = [...prev];
      updated[activeIdx] = { ...updated[activeIdx], status: "done" };
      const nextIdx = updated.findIndex(s => s.status === "pending");
      if (nextIdx >= 0) updated[nextIdx] = { ...updated[nextIdx], status: "active" };
      return updated;
    });
    if (message) setStageMessage(message);
  };

  const setProgress = (pct: number, message?: string) => {
    setPercent(pct);
    if (message) setStageMessage(message);
  };

  const complete = (message?: string) => {
    setSteps(prev => prev.map(s => ({ ...s, status: "done" as const })));
    setPercent(100);
    setStageMessage(message || "Complete!");
    setIsActive(false);
  };

  const fail = (message?: string) => {
    setSteps(prev => prev.map(s =>
      s.status === "active" ? { ...s, status: "error" as const } : s
    ));
    setStageMessage(message || "Something went wrong");
    setIsActive(false);
  };

  const reset = () => {
    setSteps([]);
    setPercent(0);
    setStageMessage("");
    setIsActive(false);
  };

  return {
    steps,
    percent,
    stageMessage,
    isActive,
    start,
    advanceStep,
    setProgress,
    complete,
    fail,
    reset,
  };
}
