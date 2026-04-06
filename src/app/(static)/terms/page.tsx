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
            <p>By accessing or using Genesis Studio (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, do not use the Platform. These Terms constitute a legally binding agreement between you and Genesis Studio.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Eligibility</h2>
            <p>You must be at least 13 years old to use Genesis Studio. If you are under 18, you must have parental or guardian consent. By using the Platform, you represent that you meet these requirements.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Account Registration</h2>
            <p>You must provide accurate, complete information when creating an account. You are responsible for maintaining the security of your account credentials and for all activity under your account. Notify us immediately of any unauthorized use.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Credits and Payments</h2>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Credits are used to generate videos and access AI features.</li>
              <li>Free accounts receive 50 credits upon registration.</li>
              <li>Subscription plans renew automatically unless cancelled before the billing date.</li>
              <li>Credit packs are one-time purchases and do not expire.</li>
              <li>We reserve the right to modify credit costs and pricing with 30 days notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Refund Policy</h2>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li><strong className="text-zinc-200">Failed generations:</strong> Credits are automatically refunded when a generation fails due to a system error.</li>
              <li><strong className="text-zinc-200">Subscriptions:</strong> You may cancel at any time. Refunds for the current billing period are available within 7 days of purchase if no credits have been used.</li>
              <li><strong className="text-zinc-200">Credit packs:</strong> Refundable within 14 days of purchase if no credits have been used.</li>
              <li><strong className="text-zinc-200">How to request:</strong> Email <a href="mailto:hello@genesis-studio.app" className="text-violet-400 hover:text-violet-300">hello@genesis-studio.app</a> with your account email and reason for refund.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Content Ownership</h2>
            <p>You retain full ownership of content you create using Genesis Studio. By publishing content to the Explore feed, you grant Genesis Studio a non-exclusive, worldwide, royalty-free license to display, distribute, and promote your content on the Platform. You may remove published content at any time, which revokes this license.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Acceptable Use Policy</h2>
            <p className="mb-2">You may not use Genesis Studio to create, upload, or distribute content that:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Is illegal, harmful, threatening, abusive, or harassing</li>
              <li>Contains child sexual abuse material (CSAM) or exploits minors</li>
              <li>Promotes violence, terrorism, or self-harm</li>
              <li>Infringes on intellectual property rights of others</li>
              <li>Contains non-consensual intimate imagery (deepfakes of real persons)</li>
              <li>Spreads misinformation or deceptive media presented as real</li>
              <li>Violates any applicable law or regulation</li>
            </ul>
            <p className="mt-2">We reserve the right to remove content and suspend or terminate accounts that violate these terms without notice or refund.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. DMCA and Copyright</h2>
            <p className="mb-2">We respect intellectual property rights. If you believe content on Genesis Studio infringes your copyright, submit a DMCA takedown notice to <a href="mailto:hello@genesis-studio.app" className="text-violet-400 hover:text-violet-300">hello@genesis-studio.app</a> with:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Identification of the copyrighted work</li>
              <li>URL of the infringing content on our platform</li>
              <li>Your contact information</li>
              <li>A statement of good faith belief that the use is unauthorized</li>
              <li>A statement under penalty of perjury that the information is accurate</li>
              <li>Your physical or electronic signature</li>
            </ul>
            <p className="mt-2">We will respond to valid DMCA notices within 5 business days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. AI-Generated Content Disclosure</h2>
            <p>All videos created on Genesis Studio are generated by artificial intelligence. Users are responsible for disclosing that content is AI-generated when required by applicable laws or platform policies (e.g., when posting to social media). Genesis Studio watermarks free-tier content to identify it as AI-generated.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Service Availability</h2>
            <p>We strive for high availability but do not guarantee uninterrupted or error-free service. AI model availability, generation quality, and processing times may vary. We may modify, suspend, or discontinue features with reasonable notice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Data Retention</h2>
            <p>Generated videos are retained according to your plan: Free (30 days), Creator (180 days), Pro (1 year), Studio (unlimited). We may delete expired content without notice. You are responsible for downloading content before it expires.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Limitation of Liability</h2>
            <p>Genesis Studio is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied. To the maximum extent permitted by law, Genesis Studio shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">13. Termination</h2>
            <p>We may suspend or terminate your account at any time for violation of these Terms. You may delete your account at any time through account settings. Upon termination, your right to use the Platform ceases immediately. Any unused credits are forfeited upon account deletion.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">14. Governing Law</h2>
            <p>These Terms are governed by the laws of the Republic of South Africa. Any disputes shall be resolved in the courts of South Africa, subject to the jurisdiction of the Consumer Protection Act (CPA) and Protection of Personal Information Act (POPIA) where applicable.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">15. Changes to Terms</h2>
            <p>We may update these Terms at any time. Material changes will be communicated via email or in-app notification at least 30 days before they take effect. Continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">16. Contact</h2>
            <p>For questions about these Terms, contact us at <a href="mailto:hello@genesis-studio.app" className="text-violet-400 hover:text-violet-300">hello@genesis-studio.app</a>.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
