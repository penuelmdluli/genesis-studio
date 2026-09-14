"use client";

// ============================================
// Celebrations: stars, flowers and credits on screen
// ============================================
// When a friend joins with someone's invite link (or a set of 5 earns them
// credits), the server queues a celebration. The next time they are on the
// site, on a phone or a computer, it plays full screen: falling stars and
// flowers, the credits counting up, and a nudge to keep sharing. It also goes
// into the notification bell and refreshes the credit balance.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/hooks/use-store";

interface Celebration {
  id: string;
  kind: "friend_joined" | "reward" | "welcome_bonus";
  title: string;
  message: string;
  credits: number;
  friends: number;
}

const PETALS = ["⭐", "🌸", "✨", "🌼", "🌺", "🎉", "💫", "🌷"];

function Rain({ count = 42 }: { count?: number }) {
  // Positions fixed per mount so the rain does not re-shuffle on re-render.
  const drops = useRef(
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 2.2,
      duration: 2.8 + Math.random() * 2.6,
      size: 18 + Math.random() * 22,
      glyph: PETALS[i % PETALS.length],
      drift: (Math.random() - 0.5) * 120,
    }))
  ).current;
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-[130]" aria-hidden>
      <style>{`
        @keyframes ivs-fall {
          0% { transform: translate3d(0,-10vh,0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translate3d(var(--drift),110vh,0) rotate(540deg); opacity: .9; }
        }
      `}</style>
      {drops.map((d, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: `${d.left}%`,
            fontSize: d.size,
            animation: `ivs-fall ${d.duration}s ${d.delay}s ease-in infinite`,
            ["--drift" as string]: `${d.drift}px`,
          }}
        >
          {d.glyph}
        </span>
      ))}
    </div>
  );
}

function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!to) return;
    let frame = 0;
    const steps = 40;
    const t = setInterval(() => {
      frame++;
      setN(Math.round((to * frame) / steps));
      if (frame >= steps) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [to]);
  return <>{n}</>;
}

export function Celebrations() {
  const { isGuest, user, addNotification, updateCreditBalance } = useStore();
  const [queue, setQueue] = useState<Celebration[]>([]);
  const [shareUrl, setShareUrl] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/celebrations");
      if (!res.ok) return;
      const d = (await res.json()) as { celebrations: Celebration[]; creditBalance: number | null };
      if (d.celebrations?.length) {
        setQueue((q) => [...q, ...d.celebrations.filter((c) => !q.some((x) => x.id === c.id))]);
        if (typeof d.creditBalance === "number") updateCreditBalance(d.creditBalance);
        for (const c of d.celebrations) {
          addNotification({
            type: c.credits > 0 ? "success" : "promo",
            title: c.title,
            message: c.message,
            link: c.kind === "welcome_bonus" ? "/generate" : "/invite",
          });
        }
      }
    } catch {
      /* try again on the next check */
    }
  }, [addNotification, updateCreditBalance]);

  useEffect(() => {
    if (isGuest || !user) return;
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => clearInterval(t);
  }, [isGuest, user, load]);

  const current = queue[0];

  useEffect(() => {
    if (!current || current.kind === "welcome_bonus" || shareUrl) return;
    fetch("/api/referral")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.whatsappUrl && setShareUrl(d.whatsappUrl))
      .catch(() => {});
  }, [current, shareUrl]);

  const close = async () => {
    if (!current) return;
    setQueue((q) => q.slice(1));
    fetch("/api/celebrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [current.id] }),
    }).catch(() => {});
  };

  if (!current) return null;
  const big = current.kind === "reward";

  return (
    <>
      <Rain count={big ? 56 : 34} />
      <div data-celebration-open className="fixed inset-0 z-[125] flex items-center justify-center bg-black/70 p-4" onClick={close}>
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-br from-[#1b1330] via-[#121220] to-[#0f2a24] p-6 sm:p-8 text-center shadow-2xl animate-in zoom-in-95 duration-300"
        >
          <div className="text-5xl sm:text-6xl mb-2">{big ? "⭐🏆⭐" : current.kind === "welcome_bonus" ? "🎁" : "🌸"}</div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">{current.title}</h2>
          {current.credits > 0 && (
            <p className="mt-3 text-5xl font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-emerald-300 bg-clip-text text-transparent">
              +<CountUp to={current.credits} /> credits
            </p>
          )}
          <p className="mt-3 text-sm sm:text-base text-zinc-300">{current.message}</p>
          {big && <p className="mt-2 text-sm font-semibold text-amber-200">You did a great job. Thank you for sharing! 🌟</p>}

          <div className="mt-6 flex flex-col gap-2">
            {current.kind !== "welcome_bonus" ? (
              <a
                href={shareUrl || "/invite"}
                target={shareUrl ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={close}
                className="rounded-xl bg-[#25D366] px-4 py-3 font-bold text-white hover:brightness-110"
              >
                Keep sharing on WhatsApp
              </a>
            ) : (
              <Link href="/generate" onClick={close} className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-3 font-bold text-white">
                Start creating
              </Link>
            )}
            <Link href="/invite" onClick={close} className="rounded-xl border border-white/[0.12] px-4 py-3 text-sm text-zinc-200 hover:bg-white/[0.05]">
              {current.kind === "welcome_bonus" ? "Invite friends, earn 50 credits" : "See my friends"}
            </Link>
          </div>
          {queue.length > 1 && <p className="mt-3 text-xs text-zinc-500">{queue.length - 1} more to celebrate</p>}
        </div>
      </div>
    </>
  );
}
