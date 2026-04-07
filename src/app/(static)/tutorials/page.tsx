import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";

export const metadata = {
  title: "Tutorials — Genesis Studio",
  description: "Learn how to create amazing AI videos with Genesis Studio.",
};

export default function TutorialsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-24">
        <h1 className="text-4xl font-bold mb-6">Tutorials</h1>
        <p className="text-zinc-400 mb-12">Learn how to get the most out of Genesis Studio.</p>

        <div className="grid gap-6">
          {[
            { title: "Your First AI Video", desc: "Generate a video from a text prompt in under 60 seconds.", link: "/generate" },
            { title: "Motion Control Guide", desc: "Transfer dance moves and gestures to any character using a reference video.", link: "/motion-control" },
            { title: "Brain Studio: Short Films", desc: "Write a script and let AI create a multi-scene short film with audio.", link: "/brain" },
            { title: "Native Audio Videos", desc: "Create videos with dialogue, sound effects, and lip sync using our audio-enabled engines.", link: "/generate" },
            { title: "Writing Great Prompts", desc: "Tips for writing prompts that produce cinematic, high-quality video results.", link: "/generate" },
            { title: "Using the API", desc: "Generate videos programmatically with the Genesis Studio REST API.", link: "/docs" },
          ].map((tut) => (
            <Link key={tut.title} href={tut.link}
              className="block p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.10] transition-all">
              <h3 className="text-lg font-semibold text-white mb-1">{tut.title}</h3>
              <p className="text-sm text-zinc-400">{tut.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
