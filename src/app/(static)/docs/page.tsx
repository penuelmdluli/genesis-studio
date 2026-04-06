import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";

export const metadata = {
  title: "API Documentation — Genesis Studio",
  description: "Genesis Studio API documentation for developers.",
};

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-24">
        <h1 className="text-4xl font-bold mb-6">API Documentation</h1>
        <div className="space-y-6 text-zinc-300 leading-relaxed">
          <p>
            The Genesis Studio API lets you generate AI videos programmatically.
            Available on Pro and Studio plans.
          </p>

          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <h2 className="text-xl font-semibold text-white mb-4">Quick Start</h2>
            <div className="bg-black/50 rounded-xl p-4 font-mono text-sm text-green-400 overflow-x-auto">
              <pre>{`curl -X POST https://genesis-studio-hazel.vercel.app/api/v1/generate \\
  -H "Authorization: Bearer gs_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "A cat sleeping on a windowsill",
    "modelId": "wan-2.2",
    "resolution": "720p",
    "duration": 5
  }'`}</pre>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <h2 className="text-xl font-semibold text-white mb-4">Authentication</h2>
            <p className="text-sm text-zinc-400">
              Generate an API key from your{" "}
              <Link href="/api-keys" className="text-violet-400 hover:text-violet-300">API Keys page</Link>.
              Include it in the <code className="px-1.5 py-0.5 rounded bg-white/10 text-xs">Authorization</code> header
              as a Bearer token.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <h2 className="text-xl font-semibold text-white mb-4">Endpoints</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs font-mono">POST</span>
                <code className="text-zinc-300">/api/v1/generate</code>
                <span className="text-zinc-500">— Generate a video</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-mono">GET</span>
                <code className="text-zinc-300">/api/v1/status/:jobId</code>
                <span className="text-zinc-500">— Check generation status</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-sm text-zinc-500">
              Need help? Contact us at{" "}
              <a href="mailto:hello@genesis-studio.app" className="text-violet-400">hello@genesis-studio.app</a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
