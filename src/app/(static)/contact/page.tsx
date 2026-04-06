import { Navbar } from "@/components/layout/navbar";

export const metadata = {
  title: "Contact — Genesis Studio",
  description: "Get in touch with the Genesis Studio team.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-24">
        <h1 className="text-4xl font-bold mb-6">Contact Us</h1>
        <div className="space-y-6 text-zinc-300 leading-relaxed">
          <p>We&apos;d love to hear from you. Whether you have a question, feedback, or need help — reach out anytime.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <h3 className="text-lg font-semibold text-white mb-2">Email</h3>
              <a href="mailto:hello@genesis-studio.app" className="text-violet-400 hover:text-violet-300">
                hello@genesis-studio.app
              </a>
            </div>
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <h3 className="text-lg font-semibold text-white mb-2">Social</h3>
              <a href="https://twitter.com/genesisstudio" className="text-violet-400 hover:text-violet-300" target="_blank" rel="noopener noreferrer">
                @genesisstudio on X
              </a>
            </div>
          </div>
          <div className="mt-8 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <h3 className="text-lg font-semibold text-white mb-2">For Enterprise</h3>
            <p className="text-sm text-zinc-400">
              Need custom volumes, white-label solutions, or API access for your business?
              Email us at <a href="mailto:enterprise@genesis-studio.app" className="text-violet-400 hover:text-violet-300">enterprise@genesis-studio.app</a>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
