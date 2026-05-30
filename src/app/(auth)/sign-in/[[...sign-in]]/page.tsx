import { SignInForm } from "@/components/auth/sign-in-form";
import Link from "next/link";
import { AuthBackgroundVideo } from "@/components/auth-background-video";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex relative overflow-hidden">
      {/* Live background — looping AI generations from explore picks */}
      <AuthBackgroundVideo />
      {/* Subtle layered glow — sits over the video to keep brand color */}
      <div className="absolute inset-0 bg-grid opacity-[0.07] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-violet-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Left panel - premium branding */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative">
        <div className="max-w-md relative z-10">
          <Link href="/" className="flex items-center gap-2.5 mb-12">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-violet-600/30">
              G
            </div>
            <span className="text-2xl font-bold gradient-text">Genesis Studio</span>
          </Link>

          <h1 className="text-4xl font-bold text-zinc-100 mb-4 leading-[1.15]">
            Welcome back,
            <br />
            <span className="gradient-text">creator.</span>
          </h1>
          <p className="text-zinc-400 leading-relaxed mb-10 text-[15px]">
            Your projects are waiting. Sign in to generate AI videos, manage your library, and keep creating.
          </p>

          {/* Social proof */}
          <div className="rounded-xl border border-white/[0.10] bg-white/[0.04] p-5 mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex -space-x-2">
                {["violet", "cyan", "fuchsia", "emerald"].map((color) => (
                  <div key={color} className={`w-7 h-7 rounded-full bg-${color}-500/30 border-2 border-[#0A0A0F] flex items-center justify-center`}>
                    <span className="text-[9px] font-bold text-white/60">
                      {color[0].toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
              <span className="text-xs text-zinc-400">2,000+ creators active this week</span>
            </div>
            <p className="text-xs text-zinc-400 italic leading-relaxed">
              &ldquo;I made a full product video in 3 minutes. This tool is insane.&rdquo;
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              "10+ AI video models in one place",
              "Brain Studio: script to full film",
              "Mimic Studio: any character, any dance",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 text-sm text-zinc-400">
                <div className="w-5 h-5 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-violet-400" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - auth */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center font-bold text-sm text-white">
                G
              </div>
              <span className="text-xl font-bold gradient-text">Genesis Studio</span>
            </Link>
            <p className="text-sm text-zinc-400">Sign in to continue creating</p>
          </div>

          <SignInForm />

          <p className="text-center text-xs text-zinc-400 mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="text-violet-400 hover:text-violet-300 font-medium">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
