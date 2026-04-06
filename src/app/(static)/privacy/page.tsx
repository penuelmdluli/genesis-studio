import { Navbar } from "@/components/layout/navbar";

export const metadata = {
  title: "Privacy Policy — Genesis Studio",
  description: "Genesis Studio privacy policy — how we handle your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-24">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-zinc-500 mb-8">Last updated: April 6, 2026</p>
        <div className="space-y-6 text-zinc-300 leading-relaxed text-sm">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Information We Collect</h2>
            <p>We collect information you provide directly: name, email address, and payment information when you subscribe or purchase credits. We also collect usage data including videos generated, features used, and platform interactions.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">How We Use Your Information</h2>
            <p>We use your information to provide and improve our services, process payments, send service notifications, and communicate with you about your account. We do not sell your personal information to third parties.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Data Storage</h2>
            <p>Your account data is stored securely using Supabase (PostgreSQL). Videos and media files are stored on Cloudflare R2 with zero-egress pricing. Authentication is handled by Clerk with industry-standard security.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Video Content</h2>
            <p>Videos you generate are stored according to your plan&apos;s retention policy. Free plan videos are retained for 30 days. Paid plan videos are retained for up to 1 year (or indefinitely on Studio plan). You can delete your videos at any time.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Third-Party Services</h2>
            <p>We use third-party services for AI video generation (RunPod, FAL.AI), payments (Stripe, PayStack), authentication (Clerk), and analytics. These services have their own privacy policies.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Your Rights</h2>
            <p>You can access, update, or delete your personal information through your account settings. You can request a full data export or account deletion by contacting us. We comply with applicable data protection laws including POPIA (South Africa).</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Contact</h2>
            <p>For privacy concerns, contact us at <a href="mailto:hello@genesis-studio.app" className="text-violet-400 hover:text-violet-300">hello@genesis-studio.app</a>.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
