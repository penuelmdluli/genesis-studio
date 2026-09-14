"use client";

// ============================================
// Invite friends: every 5 who join = 50 credits
// ============================================

import { useEffect, useState } from "react";
import { PageTransition } from "@/components/ui/motion";
import { useToast } from "@/components/ui/toast";
import { Gift, Copy, Users, Share2, Loader2 } from "lucide-react";

interface InviteData {
  shareUrl: string;
  shareMessage: string;
  whatsappUrl: string;
  referralCount: number;
  creditsEarned: number;
  friendsPerReward: number;
  rewardCredits: number;
  refereeBonus: number;
  friendsToNextReward: number;
  referrals: Array<{ id: string; who: string; joined: string }>;
}

export default function InvitePage() {
  const { toast } = useToast();
  const [data, setData] = useState<InviteData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/referral")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setError("Could not load your invite link. Refresh to try again."));
  }, []);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`, "success");
    } catch {
      toast("Copy failed. Press and hold to copy instead.", "error");
    }
  };

  const shareNative = async () => {
    if (!data) return;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: "iVideo Studio", text: data.shareMessage });
        return;
      } catch {
        /* cancelled */
      }
    }
    copy(data.shareMessage, "Message");
  };

  const step = data?.friendsPerReward || 5;
  const inCycle = data ? data.referralCount % step : 0;
  const progress = data ? (inCycle / step) * 100 : 0;

  return (
    <PageTransition className="max-w-2xl mx-auto space-y-5">
      <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/50 via-[#12121a] to-violet-950/40 p-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15">
          <Gift className="h-7 w-7 text-emerald-300" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Invite 5 friends, get 50 credits</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Every 5 friends who join with your link earns you 50 free credits, again and again. The
          more friends, the more credits. Each friend also gets {data?.refereeBonus ?? 50} bonus credits.
        </p>
      </div>

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      {!data && !error && (
        <p className="text-sm text-zinc-500 text-center flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your link…
        </p>
      )}

      {data && (
        <>
          <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5 space-y-4">
            <a
              href={data.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 text-base font-bold text-white hover:brightness-110"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
                <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.3 0 1.4 1 2.7 1.1 2.9.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" />
              </svg>
              Share on WhatsApp
            </a>
            <p className="text-center text-xs text-zinc-400">
              Send it to friends, family and your WhatsApp groups, or post it on your status.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => copy(data.shareUrl, "Link")}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/[0.05]"
              >
                <Copy className="h-4 w-4" /> Copy link
              </button>
              <button
                onClick={shareNative}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/[0.05]"
              >
                <Share2 className="h-4 w-4" /> More ways to share
              </button>
            </div>

            <div className="rounded-xl bg-black/30 px-3 py-2.5 text-xs text-zinc-400 break-all select-all">{data.shareUrl}</div>
          </div>

          <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-300" /> Your friends
              </h2>
              <span className="text-xs text-emerald-300">{data.creditsEarned} credits earned</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-white">
              {data.referralCount}
              <span className="text-base font-normal text-zinc-500"> joined</span>
            </p>
            <div className="mt-3 h-2.5 rounded-full bg-white/[0.08] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              {data.friendsToNextReward} more friend{data.friendsToNextReward === 1 ? "" : "s"} to your next{" "}
              {data.rewardCredits} credits.
            </p>
            {data.referrals.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {data.referrals.map((r) => (
                  <li key={r.id} className="flex justify-between text-xs text-zinc-400">
                    <span>{r.who}</span>
                    <span>{new Date(r.joined.replace(" ", "T") + (r.joined.endsWith("Z") ? "" : "Z")).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </PageTransition>
  );
}
