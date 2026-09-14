"use client";

// ============================================
// Guest browsing: look around first, sign up to create
// ============================================
// A visitor without an account can open the creative tools. The moment they
// try to make something, the request comes back 401 and this asks them to
// sign up (with 100 free credits) instead of failing silently. After signing
// up they return to the page they were on.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { useStore } from "@/hooks/use-store";

const PROMPT_EVENT = "ivs:guest-signup";

/** Ask a guest to create an account. Safe to call from anywhere. */
export function promptGuestSignUp() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROMPT_EVENT));
}

export function GuestGate() {
  const { isGuest, creditPurchaseOpen, setCreditPurchaseOpen } = useStore();
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("/dashboard");

  useEffect(() => {
    if (!isGuest) return;
    setPath(window.location.pathname);

    const show = () => setOpen(true);
    window.addEventListener(PROMPT_EVENT, show);

    // Any attempt to create (a non-GET request) that the server refuses for
    // want of a session opens the sign-up prompt.
    const original = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await original(input, init);
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (res.status === 401 && method !== "GET") setOpen(true);
      return res;
    };

    return () => {
      window.removeEventListener(PROMPT_EVENT, show);
      window.fetch = original;
    };
  }, [isGuest]);

  // Out-of-credit prompts make no sense for someone without an account.
  useEffect(() => {
    if (isGuest && creditPurchaseOpen) {
      setCreditPurchaseOpen(false);
      setOpen(true);
    }
  }, [isGuest, creditPurchaseOpen, setCreditPurchaseOpen]);

  if (!isGuest) return null;

  const back = encodeURIComponent(path);

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-violet-500/20 bg-gradient-to-r from-violet-950/90 via-[#12121a]/95 to-cyan-950/80 backdrop-blur px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-zinc-200">
            <Sparkles className="inline w-4 h-4 text-violet-300 mr-1.5 -mt-0.5" />
            You&apos;re looking around as a guest. Sign up free to create, with 100 credits on us.
          </p>
          <div className="flex items-center gap-2">
            <Link href={`/sign-in?redirect_url=${back}`} className="text-sm text-zinc-300 hover:text-white px-3 py-1.5">
              Sign in
            </Link>
            <Link
              href={`/sign-up?redirect_url=${back}`}
              className="text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-3.5 py-1.5"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div
            className="relative w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#111118] p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 p-1.5 text-zinc-500 hover:text-zinc-200"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15">
              <Sparkles className="w-6 h-6 text-violet-300" />
            </div>
            <h2 className="text-xl font-bold text-white">Create your free account</h2>
            <p className="mt-2 text-sm text-zinc-400">
              You&apos;re one step from making this. Sign up in under a minute and get 100 free credits to
              start creating straight away.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Link
                href={`/sign-up?redirect_url=${back}`}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-3 font-semibold text-white"
              >
                Sign up free
              </Link>
              <Link href={`/sign-in?redirect_url=${back}`} className="rounded-xl border border-white/[0.10] px-4 py-3 text-zinc-300 hover:text-white">
                I already have an account
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
