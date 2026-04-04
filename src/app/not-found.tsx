import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#07070A] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center font-bold text-3xl text-white mx-auto mb-8 shadow-lg shadow-violet-600/20">
          G
        </div>
        <h1 className="text-6xl font-extrabold text-zinc-100 mb-4">404</h1>
        <p className="text-lg text-zinc-400 mb-8">
          This page doesn't exist. It might have been moved or deleted.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold text-sm hover:from-violet-500 hover:to-violet-400 transition-all shadow-lg shadow-violet-600/20"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-zinc-300 font-semibold text-sm hover:bg-white/[0.08] transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
