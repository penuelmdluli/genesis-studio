import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";

export const metadata = {
  title: "About — Genesis Studio",
  description: "AI-powered video creation platform. Create stunning videos with text prompts, motion control, and native audio.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-24">
        <h1 className="text-4xl font-bold mb-6">About Genesis Studio</h1>
        <div className="space-y-6 text-zinc-300 leading-relaxed">
          <p>
            Genesis Studio is an AI video creation platform that puts the power of Hollywood-quality
            video production in everyone&apos;s hands. Using cutting-edge AI models, anyone can create
            professional videos from simple text descriptions.
          </p>
          <h2 className="text-2xl font-semibold text-white mt-8">What We Offer</h2>
          <ul className="list-disc list-inside space-y-2 text-zinc-400">
            <li>Text-to-video generation with 10+ AI models</li>
            <li>Native audio — dialogue, sound effects, and lip sync</li>
            <li>Motion control — transfer dance and movement to any character</li>
            <li>Brain Studio — AI-powered short film creation</li>
            <li>Auto captions, voiceover, upscaling, and thumbnails</li>
          </ul>
          <h2 className="text-2xl font-semibold text-white mt-8">Our Mission</h2>
          <p>
            We believe video creation should be accessible to everyone. Our platform removes the
            barriers of expensive equipment, complex software, and technical expertise — letting
            creators focus on their ideas.
          </p>
          <div className="mt-12 pt-8 border-t border-white/10">
            <Link
              href="/generate"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold text-sm shadow-lg shadow-violet-600/25 transition-all"
            >
              Start Creating
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
