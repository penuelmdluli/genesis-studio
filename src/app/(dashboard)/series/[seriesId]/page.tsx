"use client";

// ============================================
// SERIES STUDIO — one series
// ============================================
// The episode list is the spine. A creator can plan a whole season here for
// almost nothing, read every script in their own language, and then make the
// episodes one at a time as budget allows. Nothing is spent until they press
// the button that says what it costs.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/motion";
import { useApiError } from "@/hooks/use-api-error";
import {
  ArrowLeft,
  Clapperboard,
  Film,
  Loader2,
  PenLine,
  Play,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { localeOrDefault } from "@/lib/series/locales";

interface Series {
  id: string;
  title: string;
  language: string;
  genre: string | null;
  logline: string | null;
  character_name: string | null;
  character_description: string | null;
  story_so_far: string | null;
  episode_count: number;
}

interface EpisodeRow {
  id: string;
  episode_number: number;
  title: string;
  synopsis: string;
  status: string;
}

interface Shot {
  kind: "dialogue" | "action";
  speaker: string;
  dialogue: string;
  subtitle: string;
  action: string;
  emotion: string;
}

interface RenderedShot {
  shot_index: number;
  status: string;
  clip_url: string | null;
  image_url: string | null;
  error: string | null;
}

interface EpisodeDetail {
  episode: {
    id: string;
    episodeNumber: number;
    title: string;
    synopsis: string;
    status: string;
    cliffhanger: string;
    videoId: string | null;
    videoUrl: string | null;
  };
  shots: Shot[];
  cost: number;
  progress: { total: number; done: number; failed: number } | null;
  rendered: RenderedShot[];
}

export default function SeriesPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const handleApiError = useApiError();
  const [seriesId, setSeriesId] = useState("");
  const [series, setSeries] = useState<Series | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [rendering, setRendering] = useState("");
  const [openEpisode, setOpenEpisode] = useState("");
  const [detail, setDetail] = useState<EpisodeDetail | null>(null);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    params.then((p) => setSeriesId(p.seriesId));
  }, [params]);

  const load = useCallback(async () => {
    if (!seriesId) return;
    const res = await fetch(`/api/series/${seriesId}`);
    if (!res.ok) return;
    const data = await res.json();
    setSeries(data.series);
    setEpisodes(data.episodes || []);
    setLoading(false);
  }, [seriesId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadDetail = useCallback(
    async (episodeId: string) => {
      const res = await fetch(`/api/series/${seriesId}/episodes/${episodeId}`);
      if (!res.ok) return;
      setDetail(await res.json());
    },
    [seriesId]
  );

  // While an episode is being made, keep asking. The read endpoint is what
  // advances the shots, so stopping the poll stops the progress.
  useEffect(() => {
    if (!openEpisode || !detail?.progress) return;
    const { total, done, failed } = detail.progress;
    if (done + failed >= total) return;
    const timer = setTimeout(() => loadDetail(openEpisode), 6000);
    return () => clearTimeout(timer);
  }, [openEpisode, detail, loadDetail]);

  async function writeEpisodes(count: number) {
    setWriting(true);
    setNote("");
    try {
      const res = await fetch(`/api/series/${seriesId}/episodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNote(handleApiError(res, data));
        return;
      }
      if (data.message) setNote(data.message);
      await load();
    } catch {
      setNote("Could not reach the writer. Check your connection and try again.");
    } finally {
      setWriting(false);
    }
  }

  async function renderEpisode(episodeId: string) {
    setRendering(episodeId);
    setNote("");
    try {
      const res = await fetch(`/api/series/${seriesId}/episodes/${episodeId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aspectRatio: "9:16" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNote(handleApiError(res, data));
        return;
      }
      setOpenEpisode(episodeId);
      await loadDetail(episodeId);
      await load();
    } catch {
      setNote("Could not start this episode. Nothing was charged.");
    } finally {
      setRendering("");
    }
  }

  function toggleEpisode(id: string) {
    if (openEpisode === id) {
      setOpenEpisode("");
      setDetail(null);
      return;
    }
    setOpenEpisode(id);
    setDetail(null);
    loadDetail(id);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh] text-zinc-400">Loading your series…</div>;
  }
  if (!series) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-zinc-400">That series is not in your studio.</p>
        <Link href="/series" className="text-violet-400 text-sm mt-2 inline-block">
          Back to Series Studio
        </Link>
      </div>
    );
  }

  const nextNumber = (series.episode_count || 0) + 1;

  return (
    <PageTransition className="max-w-4xl mx-auto space-y-6">
      <Link href="/series" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
        <ArrowLeft className="w-4 h-4" />
        Series Studio
      </Link>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
          <Clapperboard className="w-6 h-6 text-violet-400 shrink-0" />
          {series.title}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {localeOrDefault(series.language).label}
          {series.genre ? ` · ${series.genre}` : ""}
          {series.character_name ? ` · ${series.character_name}` : ""}
        </p>
        {series.logline && <p className="text-sm text-zinc-500 mt-2 max-w-2xl leading-relaxed">{series.logline}</p>}
      </div>

      {series.story_so_far && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-violet-300">Story so far</h2>
            <p className="text-sm text-zinc-300 mt-2 leading-relaxed">{series.story_so_far}</p>
            <p className="text-[11px] text-zinc-600 mt-2">
              Every new episode reads this first, so the story keeps going instead of starting over.
            </p>
          </CardContent>
        </Card>
      )}

      {note && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-200">
          {note}
        </div>
      )}

      {/* Writing is cheap, so it is offered freely and priced honestly. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => writeEpisodes(1)}
          disabled={writing}
          className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/60 to-[#12121a] p-4 text-left disabled:opacity-60 transition-all hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-2">
            {writing ? <Loader2 className="w-4 h-4 animate-spin text-violet-300" /> : <PenLine className="w-4 h-4 text-violet-300" />}
            <span className="font-semibold text-white">Write episode {nextNumber}</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">Continues from where the story left off. 10 credits.</p>
        </button>

        <button
          onClick={() => writeEpisodes(5)}
          disabled={writing}
          className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 to-[#12121a] p-4 text-left disabled:opacity-60 transition-all hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-300" />
            <span className="font-semibold text-white">Plan 5 episodes</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            The whole arc written now. Make them one at a time, whenever you want. 50 credits.
          </p>
        </button>
      </div>

      {episodes.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">
          No episodes yet. Write the first one — it costs almost nothing and you can read it before deciding to make it.
        </p>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300">Episodes</h2>
          {episodes.map((ep) => {
            const isOpen = openEpisode === ep.id;
            return (
              <Card key={ep.id}>
                <CardContent className="p-0">
                  <button onClick={() => toggleEpisode(ep.id)} className="w-full text-left p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400">
                            Ep {ep.episode_number}
                          </span>
                          {ep.status === "completed" && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
                              Made
                            </span>
                          )}
                          {ep.status === "rendering" && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300">
                              Making…
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-zinc-100 mt-1.5">{ep.title}</h3>
                        <p className="text-xs text-zinc-500 mt-1 leading-snug">{ep.synopsis}</p>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/[0.07] p-4 space-y-4">
                      {!detail ? (
                        <p className="text-sm text-zinc-500">Opening the script…</p>
                      ) : (
                        <>
                          {/* The episode itself, first — the reason they
                              came. The script below is for reading and for
                              seeing which scene is which. */}
                          {detail.episode.videoUrl && (
                            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-2.5">
                                Your episode
                              </h4>
                              <video
                                src={detail.episode.videoUrl}
                                controls
                                playsInline
                                className="w-full max-w-[300px] rounded-xl border border-white/[0.10] bg-black"
                              />
                              <div className="flex flex-wrap gap-2 mt-3">
                                <a
                                  href={detail.episode.videoUrl}
                                  download
                                  className="px-3.5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-zinc-100 text-sm font-medium"
                                >
                                  Download
                                </a>
                                <a
                                  href="/gallery"
                                  className="px-3.5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-zinc-100 text-sm font-medium"
                                >
                                  Open in Gallery
                                </a>
                              </div>
                              <p className="text-[11px] text-zinc-500 mt-2">
                                All scenes joined, with English subtitles burned in. Also saved to your gallery.
                              </p>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">The script</h4>
                            <button
                              onClick={() => setShowSubtitles((v) => !v)}
                              className="text-[11px] text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
                            >
                              {showSubtitles ? "Hide English" : "Show English"}
                            </button>
                          </div>

                          <div className="space-y-2.5">
                            {detail.shots.map((shot, i) => {
                              const made = detail.rendered.find((r) => r.shot_index === i);
                              return (
                                <div
                                  key={i}
                                  className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
                                      {shot.kind === "dialogue" ? shot.speaker : "Action"}
                                    </span>
                                    <span className="text-[10px] text-zinc-600">{shot.emotion}</span>
                                    {made?.status === "completed" && (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    )}
                                    {made?.status === "processing" && (
                                      <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                                    )}
                                    {made?.status === "failed" && (
                                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                                    )}
                                  </div>

                                  {shot.kind === "dialogue" ? (
                                    <>
                                      <p className="text-sm text-zinc-100 mt-1.5 leading-relaxed">
                                        “{shot.dialogue}”
                                      </p>
                                      {showSubtitles && shot.subtitle && shot.subtitle !== shot.dialogue && (
                                        <p className="text-xs text-zinc-500 mt-1 italic leading-relaxed">
                                          {shot.subtitle}
                                        </p>
                                      )}
                                    </>
                                  ) : (
                                    <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">{shot.action}</p>
                                  )}

                                  {made?.clip_url && (
                                    <video
                                      src={made.clip_url}
                                      controls
                                      playsInline
                                      className="mt-2.5 w-full max-w-[220px] rounded-lg border border-white/[0.08]"
                                    />
                                  )}
                                  {made?.error && (
                                    <p className="text-[11px] text-red-400 mt-1.5">{made.error}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {detail.episode.cliffhanger && (
                            <p className="text-xs text-amber-300/80 italic">
                              Ends on: {detail.episode.cliffhanger}
                            </p>
                          )}

                          {detail.progress && detail.progress.done + detail.progress.failed < detail.progress.total ? (
                            <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.07] px-4 py-3">
                              <p className="text-sm text-violet-200 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Making scene {detail.progress.done + detail.progress.failed + 1} of{" "}
                                {detail.progress.total}
                              </p>
                              <p className="text-[11px] text-zinc-400 mt-1">
                                You can leave this page. It keeps going without you.
                              </p>
                            </div>
                          ) : detail.progress ? (
                            <div className="space-y-3">
                              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3">
                                <p className="text-sm text-emerald-200 flex items-center gap-2">
                                  <Film className="w-4 h-4" />
                                  {detail.progress.done} of {detail.progress.total} scenes made
                                  {detail.progress.failed > 0 ? ` · ${detail.progress.failed} refunded` : ""}
                                </p>
                              </div>
                              {/* A half-made episode is worse than none, so the
                                  scenes that failed can be tried again on their
                                  own. The ones that worked are never redone and
                                  never charged for twice. */}
                              {detail.progress.failed > 0 && (
                                <button
                                  onClick={() => renderEpisode(ep.id)}
                                  disabled={rendering === ep.id}
                                  className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 font-semibold text-amber-200 disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                  {rendering === ep.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                  {rendering === ep.id
                                    ? "Starting…"
                                    : `Try the ${detail.progress.failed} missing scene${
                                        detail.progress.failed > 1 ? "s" : ""
                                      } again`}
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => renderEpisode(ep.id)}
                              disabled={rendering === ep.id}
                              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-3 font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                              {rendering === ep.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                              {rendering === ep.id ? "Starting…" : `Make this episode · ${detail.cost} credits`}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageTransition>
  );
}
