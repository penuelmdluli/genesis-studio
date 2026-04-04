"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-glow-center opacity-30" />

      <div className="relative z-10 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 mb-3">
          Something went wrong
        </h1>

        <p className="text-zinc-500 text-sm leading-relaxed mb-8">
          An unexpected error occurred. Our team has been notified.
          You can try again or return to the dashboard.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 text-white text-sm font-medium shadow-lg shadow-violet-600/20 hover:shadow-violet-500/30 transition-all duration-200 press-effect"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-zinc-300 text-sm font-medium hover:bg-white/[0.08] transition-all duration-200"
          >
            Dashboard
          </Link>
        </div>

        {error.digest && (
          <p className="mt-8 text-xs text-zinc-600 font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
