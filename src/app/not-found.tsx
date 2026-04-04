import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Atmospheric background */}
      <div className="absolute inset-0 bg-glow-center opacity-50" />
      <div className="absolute inset-0 bg-grid opacity-30" />

      <div className="relative z-10 text-center max-w-md mx-auto">
        {/* 404 number with gradient */}
        <div className="text-[120px] sm:text-[160px] font-extrabold leading-none gradient-text select-none">
          404
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 mt-2 mb-3">
          Page not found
        </h1>

        <p className="text-zinc-500 text-sm leading-relaxed mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 text-white text-sm font-medium shadow-lg shadow-violet-600/20 hover:shadow-violet-500/30 transition-all duration-200 press-effect"
          >
            Go Home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-zinc-300 text-sm font-medium hover:bg-white/[0.08] transition-all duration-200"
          >
            Dashboard
          </Link>
        </div>

        {/* Decorative element */}
        <div className="mt-16 flex items-center justify-center gap-2 opacity-30">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center font-bold text-[8px] text-white">
            G
          </div>
          <span className="text-xs text-zinc-600">Genesis Studio</span>
        </div>
      </div>
    </div>
  );
}
