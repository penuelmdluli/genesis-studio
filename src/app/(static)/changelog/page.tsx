import { Navbar } from "@/components/layout/navbar";

export const metadata = {
  title: "Changelog — Genesis Studio",
  description: "What's new in Genesis Studio.",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-24">
        <h1 className="text-4xl font-bold mb-6">Changelog</h1>
        <p className="text-zinc-400 mb-12">What&apos;s new in Genesis Studio.</p>

        <div className="space-y-8">
          <div className="relative pl-6 border-l-2 border-violet-500/30">
            <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-violet-500" />
            <p className="text-xs text-violet-400 font-medium mb-1">April 6, 2026</p>
            <h3 className="text-lg font-semibold text-white mb-2">Launch</h3>
            <ul className="text-sm text-zinc-400 space-y-1 list-disc list-inside">
              <li>10+ AI video engines for every style and use case</li>
              <li>Native audio generation with dialogue and lip sync</li>
              <li>Motion Control for dance and gesture transfer</li>
              <li>Brain Studio for multi-scene short films</li>
              <li>Talking Avatar, Auto Captions, AI Voiceover</li>
              <li>Video Upscaler and AI Thumbnails</li>
              <li>Explore community feed with recreate flow</li>
              <li>4 pricing tiers: Free, Creator, Pro, Studio</li>
              <li>API access for Pro and Studio plans</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
