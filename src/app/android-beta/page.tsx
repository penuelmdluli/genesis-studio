import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { AndroidBetaForm } from "./beta-form";

export const metadata: Metadata = {
  title: "Test the iVideo Studio Android app",
  description: "Join the free Android beta of iVideo Studio: AI movies, cartoons and dance reels on your phone.",
  openGraph: {
    title: "📱 Test the iVideo Studio Android app",
    description: "Be one of the first to make AI movies, cartoons and dance reels on your phone. Free beta.",
    images: ["https://cdn.ivideostudio.ai/marketing/ads/poster-ai-action-movie.jpg"],
  },
};

export default function AndroidBetaPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-24">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-300">
              📱 Android beta · free
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
              Help us launch iVideo Studio on Google Play
            </h1>
            <p className="mt-4 text-lg text-zinc-300">
              Be one of the first to make AI movies, 3D cartoons, dance reels and ads straight from your phone. Google asks
              every new app for a group of real testers, and we would love you to be one of them.
            </p>
            <ol className="mt-6 space-y-3 text-sm text-zinc-300">
              {[
                ["1", "Leave the email you use on Google Play (your Gmail)."],
                ["2", "We add you to the tester list and email your install link, usually within a few days."],
                ["3", "Install the app and keep it for 14 days. Use it whenever you like."],
              ].map(([n, t]) => (
                <li key={n} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold">{n}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </div>
          <AndroidBetaForm />
        </div>
      </main>
    </div>
  );
}
