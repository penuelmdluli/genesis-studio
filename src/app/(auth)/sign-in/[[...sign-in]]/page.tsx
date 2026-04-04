import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex relative overflow-hidden">
      {/* Atmospheric background */}
      <div className="absolute inset-0 bg-glow-center opacity-30" />
      <div className="absolute inset-0 bg-grid opacity-20" />

      {/* Left panel - branding */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative">
        <div className="max-w-md relative z-10">
          <Link href="/" className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-violet-600/30">
              G
            </div>
            <span className="text-2xl font-bold gradient-text">Genesis Studio</span>
          </Link>

          <h1 className="text-3xl font-bold text-zinc-100 mb-4 leading-tight">
            Welcome back to the future of video creation
          </h1>
          <p className="text-zinc-400 leading-relaxed mb-8">
            Sign in to access your projects, generate new AI videos, and manage your account.
          </p>

          <div className="space-y-3">
            {[
              "6 open-source AI models",
              "Credits that never expire",
              "API access on every plan",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-zinc-400">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - auth */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center font-bold text-sm text-white">
                G
              </div>
              <span className="text-lg font-bold gradient-text">Genesis Studio</span>
            </Link>
          </div>

          <SignIn
            appearance={{
              elements: {
                rootBox: "mx-auto w-full",
                card: "bg-[#111118] border border-white/[0.06] shadow-2xl shadow-violet-600/5 rounded-2xl",
                headerTitle: "text-white",
                headerSubtitle: "text-zinc-400",
                socialButtonsBlockButton:
                  "bg-white/[0.04] border-white/[0.08] text-white hover:bg-white/[0.08] transition-colors rounded-xl",
                formFieldInput:
                  "bg-white/[0.03] border-white/[0.08] text-white rounded-lg focus:ring-2 focus:ring-violet-500/40",
                formButtonPrimary:
                  "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 shadow-lg shadow-violet-600/20 rounded-lg",
                footerActionLink: "text-violet-400 hover:text-violet-300",
                formFieldLabel: "text-zinc-400",
                dividerLine: "bg-white/[0.06]",
                dividerText: "text-zinc-500",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
