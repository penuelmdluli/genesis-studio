import { Navbar } from "@/components/layout/navbar";

export const metadata = {
  title: "Terms of Service — Genesis Studio",
  description: "Genesis Studio terms of service and usage agreement.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-24">
        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-zinc-500 mb-8">Last updated: April 6, 2026</p>
        <div className="space-y-6 text-zinc-300 leading-relaxed text-sm">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Genesis Studio, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Account Registration</h2>
            <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 13 years old to use the platform.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Credits and Payments</h2>
            <p>Credits are used to generate videos and access features. Credits are non-refundable except where required by law. Subscription plans renew automatically unless cancelled. Credit packs do not expire.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Content Ownership</h2>
            <p>You retain ownership of content you create using Genesis Studio. By publishing content to the Explore feed, you grant Genesis Studio a non-exclusive license to display your content on the platform. You may remove published content at any time.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Acceptable Use</h2>
            <p>You may not use Genesis Studio to create content that is illegal, harmful, abusive, or violates the rights of others. We reserve the right to remove content and suspend accounts that violate these terms.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Service Availability</h2>
            <p>We strive for high availability but do not guarantee uninterrupted service. AI model availability and generation times may vary. We reserve the right to modify features, pricing, and credit costs.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Limitation of Liability</h2>
            <p>Genesis Studio is provided &ldquo;as is&rdquo; without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:hello@genesis-studio.app" className="text-violet-400 hover:text-violet-300">hello@genesis-studio.app</a>.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
