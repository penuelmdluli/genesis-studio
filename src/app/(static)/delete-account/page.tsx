import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";

export const metadata = {
  title: "Delete your account — iVideo Studio",
  description: "How to delete your iVideo Studio account and the data linked to it.",
};

// Public on purpose: Google Play requires a page where anyone can learn how to
// delete their account without installing the app.
export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-24">
        <h1 className="text-4xl font-bold mb-2">Delete your iVideo Studio account</h1>
        <p className="text-sm text-zinc-400 mb-8">For the iVideo Studio website and Android app.</p>
        <div className="space-y-6 text-zinc-300 leading-relaxed text-sm">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Delete it yourself (instant)</h2>
            <ol className="list-decimal list-inside space-y-1 text-zinc-400">
              <li>
                <Link href="/sign-in?redirect_url=%2Fsettings" className="text-violet-300 underline">Sign in</Link> on the website or in the app.
              </li>
              <li>Open <strong className="text-zinc-200">Settings</strong>.</li>
              <li>Tap <strong className="text-zinc-200">Delete Account</strong> and confirm.</li>
            </ol>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Or ask us</h2>
            <p>
              Email <a href="mailto:hello@ivideostudio.ai?subject=Delete%20my%20account" className="text-violet-300 underline">hello@ivideostudio.ai</a> from
              the address on your account with the subject &quot;Delete my account&quot;. We delete it within 7 days and reply to confirm.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">What gets deleted</h2>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Your profile, sign-in details and sessions</li>
              <li>Your videos, images, series, uploads and collections</li>
              <li>Your remaining credits and referral link (credits cannot be refunded once the account is deleted)</li>
            </ul>
            <p className="mt-2">
              Records our payment providers must keep for tax and fraud law stay with them.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
