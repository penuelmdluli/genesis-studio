import { Suspense } from "react";
import { SaveReferral } from "@/components/auth/save-referral";
import { SignUpForm } from "@/components/auth/sign-up-form";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AuthBackgroundVideo } from "@/components/auth-background-video";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex relative overflow-hidden">
      {/* Live background — looping AI generations from explore picks */}
      <AuthBackgroundVideo />
      {/* Brand glow on top of video */}
      <div className="absolute inset-0 bg-grid opacity-[0.07] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-fuchsia-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-600/12 rounded-full blur-[100px] pointer-events-none" />

      {/* Left panel - premium branding */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative">
        <div className="max-w-md relative z-10">
          <div className="mb-12">
            <Logo size="lg" />
            <Suspense><SaveReferral /></Suspense>
          </div>

          <h1 className="text-4xl font-bold text-zinc-100 mb-4 leading-[1.15]">
            Create AI videos
            <br />
            <span className="gradient-text">that stop the scroll.</span>
          </h1>
          <p className="text-zinc-400 leading-relaxed mb-10 text-[15px]">
            100 free credits. No credit card. Your first video renders in under 60 seconds.
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-10">
            {[
              { value: "50", label: "Free credits", sub: "to start" },
              { value: "10+", label: "AI models", sub: "included" },
              { value: "60s", label: "First video", sub: "that fast" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/[0.10] bg-white/[0.04] p-4 text-center">
                <div className="text-2xl font-bold gradient-text mb-0.5">{stat.value}    <Suspense><SaveReferral /></Suspense>
    </div>
                <div className="text-[11px] text-zinc-400 font-medium">{stat.label}    <Suspense><SaveReferral /></Suspense>
    </div>
                <div className="text-[10px] text-zinc-400">{stat.sub}    <Suspense><SaveReferral /></Suspense>
    </div>
                  <Suspense><SaveReferral /></Suspense>
    </div>
            ))}
              <Suspense><SaveReferral /></Suspense>
    </div>

          {/* What you get */}
          <div className="space-y-3">
            {[
              { text: "Text to video, image to video, motion transfer", highlight: false },
              { text: "Brain Studio: one prompt, full short film with audio", highlight: true },
              { text: "Mimic Studio: make any character dance to any video", highlight: true },
              { text: "Download, share to TikTok, Instagram, WhatsApp", highlight: false },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2.5 text-sm">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  item.highlight ? "bg-violet-500/20" : "bg-white/[0.06]"
                }`}>
                  <svg className={`w-3 h-3 ${item.highlight ? "text-violet-400" : "text-zinc-400"}`} viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                    <Suspense><SaveReferral /></Suspense>
    </div>
                <span className={item.highlight ? "text-zinc-300" : "text-zinc-400"}>{item.text}</span>
                  <Suspense><SaveReferral /></Suspense>
    </div>
            ))}
              <Suspense><SaveReferral /></Suspense>
    </div>

          {/* Trust badges */}
          <div className="flex items-center gap-4 mt-10 pt-8 border-t border-white/[0.10]">
            <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">Trusted by creators in</span>
            <div className="flex gap-3">
              {["SA", "NG", "KE", "US", "UK"].map((country) => (
                <span key={country} className="text-xs font-medium text-zinc-400 bg-white/[0.04] px-2 py-1 rounded-md">
                  {country}
                </span>
              ))}
                <Suspense><SaveReferral /></Suspense>
    </div>
              <Suspense><SaveReferral /></Suspense>
    </div>
            <Suspense><SaveReferral /></Suspense>
    </div>
          <Suspense><SaveReferral /></Suspense>
    </div>

      {/* Right panel - auth */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex mb-3">
              <Logo size="md" />
              <Suspense><SaveReferral /></Suspense>
            </div>
            <p className="text-sm text-zinc-400 font-medium">100 free credits. No card needed.</p>
              <Suspense><SaveReferral /></Suspense>
    </div>

          <SignUpForm />

          <p className="text-center text-xs text-zinc-400 mt-6">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-violet-400 hover:text-violet-300 font-medium">
              Sign in
            </Link>
          </p>
            <Suspense><SaveReferral /></Suspense>
    </div>
          <Suspense><SaveReferral /></Suspense>
    </div>
        <Suspense><SaveReferral /></Suspense>
    </div>
  );
}
