"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics-events";

interface Status {
  testers: number;
  needed: number;
  open: boolean;
  optInUrl: string | null;
  whatsappUrl: string;
  bonusCredits: number;
  signedIn: boolean;
  email: string | null;
  name: string | null;
  joined: boolean;
}

export function AndroidBetaForm() {
  const [status, setStatus] = useState<Status | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ bonus: number; already: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/android-beta")
      .then((r) => r.json())
      .then((s: Status) => {
        if (cancelled) return;
        setStatus(s);
        if (s.email) setEmail(s.email);
        if (s.name) setName(s.name);
        if (s.joined) setDone({ bonus: 0, already: true });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const source = new URLSearchParams(window.location.search).get("utm_source") || "direct";
    const res = await fetch("/api/android-beta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, source }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; bonus?: number; already?: boolean; testers?: number };
    setBusy(false);
    if (!res.ok) return setError(data.error || "Something went wrong. Please try again.");
    trackEvent("android_beta_joined", { source, already: !!data.already });
    setDone({ bonus: data.bonus || 0, already: !!data.already });
    setStatus((s) => (s ? { ...s, testers: data.testers ?? s.testers } : s));
  }

  const testers = status?.testers ?? 0;
  const needed = status?.needed ?? 12;
  const pct = Math.min(100, Math.round((testers / needed) * 100));

  return (
    <div className="rounded-3xl border border-white/10 bg-[#111118] p-6 shadow-2xl sm:p-8">
      <div className="mb-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-white">
            {testers} {testers === 1 ? "tester" : "testers"} joined
          </span>
          <span className="text-zinc-400">{testers >= needed ? "Goal reached, keep them coming!" : `Goal: ${needed}`}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {done ? (
        <div className="text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="mt-3 text-2xl font-bold">{done.already ? "You're on the tester list" : "You're in! Thank you"}</h2>
          {done.bonus > 0 && <p className="mt-2 font-semibold text-emerald-300">+{done.bonus} credits added to your account</p>}
          {status?.open && status.optInUrl ? (
            <>
              <p className="mt-3 text-sm text-zinc-300">The test is open. Tap below with the same Google account, then install from Google Play.</p>
              <a href={status.optInUrl} className="mt-4 block rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black">
                Join the test on Google Play
              </a>
            </>
          ) : (
            <p className="mt-3 text-sm text-zinc-300">We'll email your install link as soon as Google approves the test. Usually within a few days.</p>
          )}
          <p className="mt-6 text-sm text-zinc-400">Know someone with an Android phone? We need a few more testers.</p>
          <a
            href={status?.whatsappUrl}
            onClick={() => trackEvent("android_beta_share", { channel: "whatsapp" })}
            className="mt-3 block rounded-xl bg-[#25D366] px-4 py-3 font-semibold text-[#062e16]"
          >
            Share on WhatsApp
          </a>
        </div>
      ) : (
        <form onSubmit={join} className="space-y-4">
          <h2 className="text-xl font-bold">Join the Android beta</h2>
          <label className="block text-sm text-zinc-300">
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              placeholder="Thandi"
            />
          </label>
          <label className="block text-sm text-zinc-300">
            Email you use on Google Play
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              placeholder="you@gmail.com"
            />
            <span className="mt-1 block text-xs text-zinc-500">Open the Play Store, tap your profile picture: it's the email shown there.</span>
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-3 font-semibold text-white disabled:opacity-60">
            {busy ? "Joining…" : "Join the beta"}
          </button>
          {status && (
            <p className="text-center text-xs text-zinc-400">
              {status.signedIn ? (
                <>🎁 You get {status.bonusCredits} free credits for joining.</>
              ) : (
                <>
                  🎁 <Link href="/sign-in?redirect_url=%2Fandroid-beta" className="text-violet-300 underline">Sign in</Link> first to get {status.bonusCredits} free credits for joining.
                </>
              )}
            </p>
          )}
          <p className="text-center text-xs text-zinc-500">Android phones only. We only use your email for the test.</p>
        </form>
      )}
    </div>
  );
}
