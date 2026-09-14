"use client";

// ============================================
// Feature of the Week popup
// ============================================
// The first time a signed-in user opens the studio each week, one feature
// gets the spotlight (picked per user by /api/spotlight). Once a week per
// browser, never over the onboarding tour or a celebration, never on the
// feature's own page. Kept light for phones: no backdrop blur, video only
// plays when the card is open.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { trackEvent } from "@/lib/analytics-events";

interface Spot {
  id: string;
  emoji: string;
  title: string;
  hook: string;
  benefits: string[];
  idea: string;
  cta: string;
  cost: string;
  poster: string;
  video?: string;
  href: string;
}

const SEEN_KEY = "ivs-spotlight-seen";
const DELAY_MS = 3500;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function FeatureSpotlight() {
  const { user, isGuest } = useStore();
  const pathname = usePathname();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [week, setWeek] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || isGuest) return;
    if (pathname.startsWith("/onboarding")) return;
    // Let first-time users finish the tour before anything else asks for attention.
    if (!read("genesis-onboarding-complete")) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/spotlight");
        if (!res.ok) return;
        const data = (await res.json()) as { week: string; spotlight: Spot };
        if (cancelled || read(SEEN_KEY) === data.week) return;
        if (pathname.startsWith(data.spotlight.href.split("?")[0])) return;
        if (document.querySelector("[data-celebration-open]")) return;
        setWeek(data.week);
        setSpot(data.spotlight);
        setOpen(true);
        trackEvent("spotlight_shown", { feature: data.spotlight.id, week: data.week });
      } catch {
        /* never let marketing break the studio */
      }
    }, DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Once per page load is enough; route changes don't re-trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isGuest]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close("escape");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close(how: string) {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, week);
    } catch {}
    if (spot) trackEvent("spotlight_dismissed", { feature: spot.id, how });
  }

  if (!open || !spot) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 sm:p-4"
      onClick={() => close("backdrop")}
      role="dialog"
      aria-modal="true"
      aria-label={`Feature of the week: ${spot.title}`}
    >
      <div
        className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-white/[0.12] bg-[#111118] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => close("x")}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-zinc-200 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative bg-black">
          {spot.video ? (
            <video
              src={spot.video}
              poster={spot.poster}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="mx-auto block max-h-[42vh] w-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={spot.poster} alt="" className="block max-h-[42vh] w-full object-cover" />
          )}
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            <Sparkles className="h-3 w-3" /> Feature of the week
          </span>
        </div>

        <div className="p-5 sm:p-6">
          <h2 className="text-xl font-bold text-white">
            {spot.emoji} {spot.title}
          </h2>
          <p className="mt-1.5 text-sm text-zinc-300">{spot.hook}</p>

          <ul className="mt-4 space-y-1.5">
            {spot.benefits.map((b) => (
              <li key={b} className="flex gap-2 text-sm text-zinc-300">
                <span className="text-emerald-400">✓</span>
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-xl bg-violet-500/10 border border-violet-500/20 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-300">💡 Try this idea</p>
            <p className="mt-1 text-sm text-zinc-200">{spot.idea}</p>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Link
              href={spot.href}
              onClick={() => {
                trackEvent("spotlight_click", { feature: spot.id, week });
                close("cta");
              }}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-3 text-center font-semibold text-white"
            >
              {spot.cta}
            </Link>
            <button onClick={() => close("later")} className="rounded-xl px-4 py-2.5 text-sm text-zinc-400 hover:text-white">
              Maybe later
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-zinc-500">{spot.cost}</p>
        </div>
      </div>
    </div>
  );
}
