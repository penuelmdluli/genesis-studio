import { Navbar } from "@/components/layout/navbar";

export const metadata = {
  title: "Privacy Policy — Genesis Studio",
  description: "Genesis Studio privacy policy — how we collect, use, and protect your data.",
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
            <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
            <p className="mb-2"><strong className="text-zinc-200">Account information:</strong> Name, email address, and profile image when you register via Clerk authentication.</p>
            <p className="mb-2"><strong className="text-zinc-200">Payment information:</strong> Billing details processed securely by our payment providers (PayStack, Stripe). We do not store credit card numbers.</p>
            <p className="mb-2"><strong className="text-zinc-200">Usage data:</strong> Videos generated, features used, generation parameters, credit transactions, and platform interactions.</p>
            <p><strong className="text-zinc-200">Technical data:</strong> IP address, browser type, device information, and cookies for session management and analytics.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Provide, maintain, and improve our services</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send transactional emails (welcome, video ready, low credits)</li>
              <li>Enforce our Terms of Service and Acceptable Use Policy</li>
              <li>Analyze usage patterns to improve the platform</li>
              <li>Respond to support requests and inquiries</li>
            </ul>
            <p className="mt-2">We do not sell, rent, or trade your personal information to third parties for marketing purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Data Storage and Security</h2>
            <p className="mb-2"><strong className="text-zinc-200">Account data:</strong> Stored securely in PostgreSQL via Supabase with row-level security and encrypted connections.</p>
            <p className="mb-2"><strong className="text-zinc-200">Media files:</strong> Videos and images are stored on Cloudflare R2 with encryption at rest.</p>
            <p className="mb-2"><strong className="text-zinc-200">Authentication:</strong> Managed by Clerk with industry-standard security, including bcrypt password hashing and OAuth 2.0.</p>
            <p><strong className="text-zinc-200">API keys and secrets:</strong> Stored as encrypted environment variables, never exposed to the client.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Retention</h2>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li><strong className="text-zinc-200">Free plan:</strong> Videos retained for 30 days, max 10 videos</li>
              <li><strong className="text-zinc-200">Creator plan:</strong> Videos retained for 180 days, max 100 videos</li>
              <li><strong className="text-zinc-200">Pro plan:</strong> Videos retained for 1 year, max 500 videos</li>
              <li><strong className="text-zinc-200">Studio plan:</strong> Unlimited retention and storage</li>
            </ul>
            <p className="mt-2">Expired videos are automatically deleted via daily cleanup processes. Account data is retained for 90 days after account deletion to allow recovery, then permanently deleted.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Cookies</h2>
            <p className="mb-2">We use the following types of cookies:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li><strong className="text-zinc-200">Essential cookies:</strong> Required for authentication and session management (cannot be disabled)</li>
              <li><strong className="text-zinc-200">Analytics cookies:</strong> Help us understand how the platform is used (can be disabled)</li>
            </ul>
            <p className="mt-2">We do not use advertising or tracking cookies. You can manage cookie preferences in your browser settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Third-Party Services</h2>
            <p className="mb-2">We share data with the following third-party processors:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li><strong className="text-zinc-200">Clerk:</strong> Authentication and user management</li>
              <li><strong className="text-zinc-200">Supabase:</strong> Database hosting (AWS eu-west-1)</li>
              <li><strong className="text-zinc-200">Cloudflare R2:</strong> Media file storage</li>
              <li><strong className="text-zinc-200">RunPod / FAL.AI:</strong> AI video generation processing</li>
              <li><strong className="text-zinc-200">PayStack / Stripe:</strong> Payment processing</li>
              <li><strong className="text-zinc-200">Resend:</strong> Transactional email delivery</li>
              <li><strong className="text-zinc-200">Vercel:</strong> Application hosting</li>
            </ul>
            <p className="mt-2">Each service has its own privacy policy. We only share the minimum data required for each service to function.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Your Rights (POPIA &amp; GDPR)</h2>
            <p className="mb-2">Under the Protection of Personal Information Act (POPIA) of South Africa and the General Data Protection Regulation (GDPR), you have the right to:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li><strong className="text-zinc-200">Access:</strong> Request a copy of your personal data</li>
              <li><strong className="text-zinc-200">Rectification:</strong> Correct inaccurate or incomplete data</li>
              <li><strong className="text-zinc-200">Erasure:</strong> Request deletion of your personal data</li>
              <li><strong className="text-zinc-200">Portability:</strong> Receive your data in a machine-readable format</li>
              <li><strong className="text-zinc-200">Objection:</strong> Object to processing of your data</li>
              <li><strong className="text-zinc-200">Restriction:</strong> Request restriction of data processing</li>
              <li><strong className="text-zinc-200">Withdrawal:</strong> Withdraw consent at any time</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, email us at <a href="mailto:hello@genesis-studio.app" className="text-violet-400 hover:text-violet-300">hello@genesis-studio.app</a>. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. International Data Transfers</h2>
            <p>Your data may be processed in countries outside South Africa, including the United States and European Union, where our service providers operate. We ensure adequate safeguards are in place through contractual arrangements with our processors.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Children&apos;s Privacy</h2>
            <p>Genesis Studio is not intended for children under 13. We do not knowingly collect personal information from children under 13. If we discover such data has been collected, we will delete it promptly.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy periodically. Material changes will be communicated via email or in-app notification. Continued use after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Information Officer</h2>
            <p>In accordance with POPIA, our Information Officer can be contacted at <a href="mailto:hello@genesis-studio.app" className="text-violet-400 hover:text-violet-300">hello@genesis-studio.app</a>. Complaints may also be lodged with the Information Regulator of South Africa.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Contact</h2>
            <p>For privacy concerns or data requests, contact us at <a href="mailto:hello@genesis-studio.app" className="text-violet-400 hover:text-violet-300">hello@genesis-studio.app</a>.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
