"use client";

import { useEffect } from "react";

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
    <div className="min-h-screen bg-[#07070A] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center font-bold text-3xl text-white mx-auto mb-8 shadow-lg shadow-red-600/20">
          !
        </div>
        <h1 className="text-4xl font-extrabold text-zinc-100 mb-4">Something went wrong</h1>
        <p className="text-zinc-400 mb-8">
          An unexpected error occurred. Our team has been notified.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold text-sm hover:from-violet-500 hover:to-violet-400 transition-all shadow-lg shadow-violet-600/20"
          >
            Try Again
          </button>
          <a
            href="/dashboard"
            className="px-6 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-zinc-300 font-semibold text-sm hover:bg-white/[0.08] transition-all"
          >
            Go to Dashboard
          </a>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-zinc-600">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
