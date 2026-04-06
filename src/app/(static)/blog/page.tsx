import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";

export const metadata = {
  title: "Blog — Genesis Studio",
  description: "Latest news, tutorials, and updates from Genesis Studio.",
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-24">
        <h1 className="text-4xl font-bold mb-6">Blog</h1>
        <p className="text-zinc-400 mb-12">News, tutorials, and updates from the Genesis Studio team.</p>

        <article className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-6">
          <p className="text-xs text-violet-400 font-medium mb-2">April 2026</p>
          <h2 className="text-xl font-semibold text-white mb-2">Genesis Studio is Live</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            We&apos;re excited to launch Genesis Studio — an AI video creation platform
            with 10+ models, native audio generation, motion control, and Brain Studio
            for multi-scene short films. Start creating with 50 free credits.
          </p>
          <Link href="/generate" className="inline-block mt-4 text-sm text-violet-400 hover:text-violet-300">
            Start creating &rarr;
          </Link>
        </article>
      </main>
    </div>
  );
}
