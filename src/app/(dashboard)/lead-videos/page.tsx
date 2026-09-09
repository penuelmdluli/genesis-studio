"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/motion";
import { useToast } from "@/components/ui/toast";
import {
  Bookmark,
  Clock,
  Download,
  ExternalLink,
  Eye,
  Link as LinkIcon,
  Loader2,
  Move,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";

interface Lead {
  id: string;
  sourceUrl: string;
  platform: string;
  title: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  durationSec: number;
  viewCount: number;
  status: "pending" | "fetching" | "ready" | "failed";
  errorMessage: string | null;
  attempts: number;
  notes: string | null;
  starred: boolean;
  timesUsed: number;
  createdAt: string;
}

/** Kling's hard cap on a reference video. Longer leads are kept but flagged. */
const MAX_MOTION_SECONDS = 30;

type Filter = "all" | "unused" | "starred" | "attention";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unused", label: "Not used yet" },
  { key: "starred", label: "Starred" },
  { key: "attention", label: "Needs attention" },
];

const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook",
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "X",
  direct: "Direct link",
  unknown: "Link",
};

export default function LeadVideosPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [input, setInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/lead-videos");
      const data = (await res.json()) as { leads?: Lead[] };
      setLeads(data.leads || []);
    } catch {
      toast("Could not load your list", "error");
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // A lead is downloaded in the background after it is added, so the card has
  // to catch up on its own. Polling stops the moment nothing is in flight —
  // this page is often left open in a tab for a whole session.
  const inFlight = leads.some((l) => l.status === "pending" || l.status === "fetching");
  useEffect(() => {
    if (!inFlight) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [inFlight, load]);

  const addLinks = useCallback(
    async (text: string) => {
      const urls = text.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean);
      if (urls.length === 0) return;

      setIsAdding(true);
      try {
        const res = await fetch("/api/lead-videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls }),
        });
        const data = (await res.json()) as {
          leads?: Lead[];
          skipped?: { url: string; reason: string }[];
          error?: string;
        };

        if (!res.ok) {
          toast(data.error || "Could not save that link", "error");
          return;
        }

        setInput("");
        await load();

        const saved = data.leads || [];
        const fresh = saved.filter((l) => l.status === "pending");
        toast(
          saved.length === 1
            ? "Saved — downloading it now"
            : `Saved ${saved.length} links — downloading them now`,
          "success"
        );

        for (const { reason } of data.skipped || []) {
          if (reason !== "Already on your list") toast(reason, "warning");
        }

        // Kick off each download and refresh as they land. These are fired in
        // parallel deliberately: a bulk paste of ten links would otherwise take
        // several minutes to finish one at a time.
        await Promise.all(
          fresh.map((lead) =>
            fetch(`/api/lead-videos/${lead.id}/fetch`, { method: "POST" }).catch(() => {})
          )
        );
        await load();
      } catch {
        toast("Could not save that link", "error");
      } finally {
        setIsAdding(false);
      }
    },
    [load, toast]
  );

  // Quick-add: /lead-videos?add=<url>. This is what a phone share shortcut or
  // a browser bookmarklet points at, so a link can go straight from the reel
  // you are watching onto the list without opening the app first.
  const quickAdded = useRef(false);
  useEffect(() => {
    if (quickAdded.current) return;
    const add = searchParams.get("add") || searchParams.get("url") || searchParams.get("text");
    if (!add) return;

    quickAdded.current = true;
    // Android's share sheet sends the title and the URL in one string, so take
    // the first thing in it that actually looks like a link.
    const url = add.split(/\s+/).find((p) => /^https?:\/\//i.test(p)) || add;
    window.history.replaceState({}, "", "/lead-videos");
    addLinks(url);
  }, [searchParams, addLinks]);

  const retry = async (lead: Lead) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status: "fetching" as const } : l))
    );
    await fetch(`/api/lead-videos/${lead.id}/fetch?retry=1`, { method: "POST" }).catch(() => {});
    await load();
  };

  const toggleStar = async (lead: Lead) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, starred: !l.starred } : l))
    );
    await fetch(`/api/lead-videos/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: !lead.starred }),
    }).catch(() => load());
  };

  const remove = async (lead: Lead) => {
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    await fetch(`/api/lead-videos/${lead.id}`, { method: "DELETE" }).catch(() => load());
  };

  const openInMotionControl = (lead: Lead) => {
    router.push(`/motion-control?lead=${lead.id}`);
  };

  const visible = leads.filter((l) => {
    if (filter === "unused") return l.timesUsed === 0 && l.status === "ready";
    if (filter === "starred") return l.starred;
    if (filter === "attention") return l.status === "failed" || l.durationSec > MAX_MOTION_SECONDS;
    return true;
  });

  const readyCount = leads.filter((l) => l.status === "ready").length;
  const unusedCount = leads.filter((l) => l.status === "ready" && l.timesUsed === 0).length;

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-violet-400" />
            Lead Videos
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Paste any trending video link the moment you see it. We download and keep it, so
            it&apos;s ready as a motion reference whenever you sit down to create.
          </p>
        </div>

        {/* Add box */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <label className="text-xs font-medium text-zinc-400">
              Paste a Facebook, TikTok, Instagram or X link — or several at once
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addLinks(input);
                }}
                rows={2}
                placeholder="https://www.facebook.com/reel/..."
                className="flex-1 px-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 resize-y"
              />
              <Button
                onClick={() => addLinks(input)}
                loading={isAdding}
                disabled={!input.trim()}
                className="sm:w-40 shrink-0"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add to list
              </Button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Downloading starts straight away and takes up to a minute per clip — you can close
              this page, it finishes on its own.
            </p>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/[0.10]">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  filter === f.key
                    ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                    : "text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {!isLoading && leads.length > 0 && (
            <p className="text-xs text-zinc-500">
              {readyCount} ready · {unusedCount} still unused
            </p>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading your list…
          </div>
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Bookmark className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">
                {leads.length === 0
                  ? "Nothing saved yet. Paste a link above and it will be waiting for you next session."
                  : "Nothing matches this filter."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onUse={() => openInMotionControl(lead)}
                onRetry={() => retry(lead)}
                onStar={() => toggleStar(lead)}
                onRemove={() => remove(lead)}
              />
            ))}
          </div>
        )}

        {/* Quick-add helper */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-zinc-300 mb-2">Add links from your phone</p>
            <p className="text-[11px] text-zinc-500 mb-2">
              Any link opened at the address below is saved instantly — save it as a share
              shortcut or a bookmark, and adding a reel takes one tap.
            </p>
            <code className="block text-[11px] text-violet-300 bg-black/40 rounded-lg px-3 py-2 break-all">
              https://ivideostudio.ai/lead-videos?add=PASTE_LINK_HERE
            </code>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}

function LeadCard({
  lead,
  onUse,
  onRetry,
  onStar,
  onRemove,
}: {
  lead: Lead;
  onUse: () => void;
  onRetry: () => void;
  onStar: () => void;
  onRemove: () => void;
}) {
  const tooLong = lead.durationSec > MAX_MOTION_SECONDS;
  const usable = lead.status === "ready" && !!lead.videoUrl && !tooLong;

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video bg-black/40">
        {lead.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lead.thumbnailUrl}
            alt={lead.title || "Lead video"}
            className="w-full h-full object-cover"
          />
        ) : lead.videoUrl ? (
          <video src={lead.videoUrl} className="w-full h-full object-cover" muted preload="metadata" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <LinkIcon className="w-8 h-8 text-zinc-700" />
          </div>
        )}

        <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/70 text-[10px] font-medium text-zinc-300">
          {PLATFORM_LABEL[lead.platform] || PLATFORM_LABEL.unknown}
        </div>

        <button
          onClick={onStar}
          className={`absolute top-2 right-2 p-1.5 rounded-md bg-black/70 transition-colors ${
            lead.starred ? "text-amber-400" : "text-zinc-400 hover:text-amber-400"
          }`}
          aria-label={lead.starred ? "Remove star" : "Star this lead"}
        >
          <Star className="w-3.5 h-3.5" fill={lead.starred ? "currentColor" : "none"} />
        </button>

        {lead.durationSec > 0 && (
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/70 text-[10px] text-zinc-300 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {Math.round(lead.durationSec)}s
          </div>
        )}

        <StatusOverlay lead={lead} />
      </div>

      <CardContent className="p-3 space-y-2.5">
        <p className="text-xs font-medium text-zinc-200 line-clamp-2 min-h-[2rem]">
          {lead.title || lead.sourceUrl.replace(/^https?:\/\/(www\.)?/, "")}
        </p>

        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          {lead.viewCount > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {formatCount(lead.viewCount)}
            </span>
          )}
          <span>{lead.timesUsed === 0 ? "Not used yet" : `Used ${lead.timesUsed}×`}</span>
        </div>

        {tooLong && lead.status === "ready" && (
          <p className="flex items-start gap-1.5 text-[10px] text-amber-300/90">
            <TriangleAlert className="w-3 h-3 shrink-0 mt-px" />
            {Math.round(lead.durationSec)}s is over the {MAX_MOTION_SECONDS}s motion limit — trim it
            before using.
          </p>
        )}

        {lead.status === "failed" && (
          <p className="flex items-start gap-1.5 text-[10px] text-red-300/90">
            <TriangleAlert className="w-3 h-3 shrink-0 mt-px" />
            <span className="line-clamp-2">{lead.errorMessage || "Download failed"}</span>
          </p>
        )}

        <div className="flex items-center gap-1.5">
          <Button
            onClick={onUse}
            disabled={!usable}
            size="sm"
            className="flex-1 text-[11px]"
            title={
              usable
                ? "Open Motion Control with this clip loaded"
                : "Available once the download finishes"
            }
          >
            <Move className="w-3.5 h-3.5 mr-1" />
            Use this
          </Button>

          {lead.status === "failed" && (
            <button
              onClick={onRetry}
              className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Try downloading again"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          <a
            href={lead.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Open the original"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {lead.videoUrl && (
            <a
              href={lead.videoUrl}
              download
              className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Download the clip"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          )}

          <button
            onClick={onRemove}
            className="p-2 rounded-lg bg-white/[0.06] hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
            title="Remove from list"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusOverlay({ lead }: { lead: Lead }) {
  if (lead.status === "ready") return null;

  const label =
    lead.status === "failed"
      ? "Download failed"
      : lead.status === "fetching"
        ? "Downloading…"
        : "Queued";

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
      <div className="flex items-center gap-2 text-xs text-zinc-300">
        {lead.status === "failed" ? (
          <TriangleAlert className="w-4 h-4 text-red-400" />
        ) : (
          <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
        )}
        {label}
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
