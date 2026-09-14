"use client";

// ============================================
// SERIES STUDIO — the shelf
// ============================================
// A creator's series live here. Starting one is free and takes four fields,
// because the moment somebody has to think about credits they stop thinking
// about the story.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/motion";
import { Clapperboard, Plus, ArrowRight, Loader2, Play, Volume2, VolumeX } from "lucide-react";

import { SERIES_LOCALES, localeOrDefault } from "@/lib/series/locales";

// The three anyone here is most likely to want, one tap away. The other 137
// are behind a search box, because a wall of 140 buttons is not a choice.
// English first, and the default. It is what most creators here actually
// pick, and it is the language the writing and the voices come out cleanest
// in — a home-language drama is a deliberate choice, not the fallback.
const QUICK_LANGUAGES = ["en-ZA", "zu-ZA", "af-ZA"];

const GENRES = ["Action movie", "3D cartoon", "Drama", "Family", "Township comedy", "Crime", "Romance", "Thriller"];

/** Genres that film at blockbuster level — see src/lib/series/style.ts. */
const BLOCKBUSTER_GENRES = ["Action movie", "3D cartoon"];

// Films iVideo Studio made to market itself. Each one fills the form with a
// series built the same way, so a creator who likes what they see can make
// their own version in one tap.
const SHOWCASE = [
  {
    key: "action",
    label: "AI Action Movie",
    video: "https://cdn.ivideostudio.ai/marketing/ads/ai-action-movie-9x16.mp4?v=2",
    poster: "https://cdn.ivideostudio.ai/marketing/ads/poster-ai-action-movie.jpg",
    preset: {
      title: "Last Run",
      genre: "Action movie",
      characterName: "Zara",
      characterDescription: "30, athletic woman, short braids, black leather jacket, thin scar above her left eyebrow",
      logline: "A getaway rider in Johannesburg is framed for a heist and has one night to outrun the crew hunting her and clear her name.",
    },
  },
  {
    key: "cartoon",
    label: "AI Cartoon Movie",
    video: "https://cdn.ivideostudio.ai/marketing/ads/ai-cartoon-9x16.mp4?v=2",
    poster: "https://cdn.ivideostudio.ai/marketing/ads/poster-ai-cartoon.jpg",
    preset: {
      title: "Sky Scout Sipho",
      genre: "3D cartoon",
      characterName: "Sipho",
      characterDescription: "a brave little meerkat with aviator goggles, a red scarf and a big grin",
      logline: "A small meerkat who dreams of flying builds a wooden plane and must save his savanna village from a grumpy giant eagle.",
    },
  },
  {
    key: "beasts",
    label: "AI Beast Wars",
    video: "https://cdn.ivideostudio.ai/marketing/ads/ai-beast-wars-9x16.mp4?v=2",
    poster: "https://cdn.ivideostudio.ai/marketing/ads/poster-ai-beast-wars.jpg",
    preset: {
      title: "Beast Wars",
      genre: "Action movie",
      characterName: "Captain Lindiwe",
      characterDescription: "35, commander in a battle-worn armoured exosuit with glowing blue lines, short natural hair",
      logline: "Giant machine beasts rise across Africa, and Captain Lindiwe must pilot the last chrome war-rhino against a molten iron lion before it reaches Johannesburg.",
    },
  },
];

/**
 * A showcase film that plays itself: on hover with a mouse, and when scrolled
 * into view on a phone (touch screens have no hover). Muted so the browser
 * allows autoplay; one tap brings the sound in.
 */
function ShowcaseVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const play = () => {
    const v = ref.current;
    if (!v) return;
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };
  const pause = () => {
    const v = ref.current;
    if (!v) return;
    v.pause();
    setPlaying(false);
  };

  useEffect(() => {
    const v = ref.current;
    if (!v || typeof window === "undefined") return;
    const canHover = window.matchMedia("(hover: hover)").matches;
    if (canHover) return; // desktop: hover drives playback
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting && entry.intersectionRatio > 0.6 ? play() : pause()),
      { threshold: [0, 0.6, 1] }
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <div
      className="relative group cursor-pointer"
      onMouseEnter={play}
      onMouseLeave={pause}
      onClick={() => (playing ? pause() : play())}
    >
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        aria-label={label}
        className="w-full aspect-[9/16] object-cover bg-black"
      />
      {!playing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-black/55 p-4 backdrop-blur-sm transition-transform group-hover:scale-110">
            <Play className="w-7 h-7 text-white fill-white" />
          </div>
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMuted((m) => !m);
          if (!playing) play();
        }}
        className="absolute right-2 bottom-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
        aria-label={muted ? "Turn sound on" : "Turn sound off"}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
    </div>
  );
}

interface SeriesRow {
  id: string;
  title: string;
  language: string;
  genre: string | null;
  character_name: string | null;
  episode_count: number;
}

export default function SeriesShelfPage() {
  const router = useRouter();
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("en-ZA");
  const [moreLanguages, setMoreLanguages] = useState(false);
  const [languageQuery, setLanguageQuery] = useState("");
  const [genre, setGenre] = useState("Drama");
  const [logline, setLogline] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [characterDescription, setCharacterDescription] = useState("");

  function createSimilar(preset: (typeof SHOWCASE)[number]["preset"]) {
    setTitle(preset.title);
    setGenre(preset.genre);
    setCharacterName(preset.characterName);
    setCharacterDescription(preset.characterDescription);
    setLogline(preset.logline);
    setLanguage("en-ZA");
    setError("");
    setOpen(true);
    setTimeout(() => document.getElementById("series-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  useEffect(() => {
    fetch("/api/series")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.series && setSeries(d.series))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function create() {
    if (!title.trim()) {
      setError("Give your series a name");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, language, genre, logline, characterName, characterDescription }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not start your series");
        return;
      }
      router.push(`/series/${data.id}`);
    } catch {
      setError("Could not start your series. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageTransition className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
          <Clapperboard className="w-6 h-6 text-violet-400" />
          Series Studio
        </h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-2xl leading-relaxed">
          Make action movies, 3D cartoons and dramas, episode after episode. Same characters, a
          story that carries on, voices with real lip sync, sound effects and music, and English
          subtitles so everyone can follow it. English, isiZulu, Afrikaans and 137 more.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">Made with iVideo Studio: make one like it</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SHOWCASE.map((item) => (
            <div key={item.key} className="rounded-2xl border border-white/[0.10] bg-white/[0.03] overflow-hidden">
              <ShowcaseVideo src={item.video} poster={item.poster} label={item.label} />
              <div className="p-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-100">{item.label}</span>
                <button
                  onClick={() => createSimilar(item.preset)}
                  className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Create similar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/60 via-[#12121a] to-cyan-950/30 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/10"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-violet-300" />
            <span className="text-lg font-bold text-white">Start a series</span>
          </div>
          <p className="text-sm text-zinc-300 mt-1">
            Four questions, then we write your first episode. Free until you make the video.
          </p>
        </button>
      )}

      {open && (
        <Card id="series-form">
          <CardContent className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-400">What is it called?</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Umuzi Wethu"
                className="mt-1 w-full rounded-xl bg-white/[0.04] border border-white/[0.10] px-3 py-2.5 text-white placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-400">Which language do they speak?</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {QUICK_LANGUAGES.map((id) => (
                  <button
                    key={id}
                    onClick={() => setLanguage(id)}
                    className={`rounded-full px-3.5 py-1.5 text-sm border transition-colors ${
                      language === id
                        ? "border-violet-500/60 bg-violet-500/20 text-violet-200"
                        : "border-white/[0.10] bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {localeOrDefault(id).label}
                  </button>
                ))}
                <button
                  onClick={() => setMoreLanguages((v) => !v)}
                  className={`rounded-full px-3.5 py-1.5 text-sm border transition-colors ${
                    !QUICK_LANGUAGES.includes(language)
                      ? "border-violet-500/60 bg-violet-500/20 text-violet-200"
                      : "border-white/[0.10] bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {QUICK_LANGUAGES.includes(language)
                    ? `${SERIES_LOCALES.length - QUICK_LANGUAGES.length} more…`
                    : localeOrDefault(language).label}
                </button>
              </div>

              {moreLanguages && (
                <div className="mt-2 rounded-xl border border-white/[0.10] bg-white/[0.02] p-2">
                  <input
                    value={languageQuery}
                    onChange={(e) => setLanguageQuery(e.target.value)}
                    placeholder="Search 140 languages…"
                    className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
                  />
                  <div className="mt-2 max-h-56 overflow-y-auto">
                    {SERIES_LOCALES.filter((l) =>
                      l.label.toLowerCase().includes(languageQuery.trim().toLowerCase())
                    )
                      .slice(0, 60)
                      .map((l) => (
                        <button
                          key={l.id}
                          onClick={() => {
                            setLanguage(l.id);
                            setMoreLanguages(false);
                            setLanguageQuery("");
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            language === l.id
                              ? "bg-violet-500/20 text-violet-200"
                              : "text-zinc-300 hover:bg-white/[0.05]"
                          }`}
                        >
                          {l.label}
                          <span className="text-[10px] text-zinc-600 ml-2">{l.group}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-zinc-500 mt-1.5">
                Your characters speak this, with their mouths matched to it. English subtitles are
                written either way.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-400">What kind of story?</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenre(g)}
                    className={`rounded-full px-3.5 py-1.5 text-sm border transition-colors ${
                      genre === g
                        ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-200"
                        : "border-white/[0.10] bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {BLOCKBUSTER_GENRES.includes(genre) && (
                <p className="text-[11px] text-cyan-300/80 mt-1.5">
                  Blockbuster quality: big set pieces, characters that talk and shout with lip sync,
                  full sound effects and a movie score. 240 to 280 credits a scene.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-400">Who is it about?</label>
                <input
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Nomsa"
                  className="mt-1 w-full rounded-xl bg-white/[0.04] border border-white/[0.10] px-3 py-2.5 text-white placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400">What do they look like?</label>
                <input
                  value={characterDescription}
                  onChange={(e) => setCharacterDescription(e.target.value)}
                  placeholder="28, short natural hair, red jacket"
                  className="mt-1 w-full rounded-xl bg-white/[0.04] border border-white/[0.10] px-3 py-2.5 text-white placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 -mt-1">
              Describe them once. We reuse these exact words in every episode so their face stays the same.
            </p>

            <div>
              <label className="text-xs font-medium text-zinc-400">
                What is going on? <span className="text-zinc-600">(optional)</span>
              </label>
              <textarea
                value={logline}
                onChange={(e) => setLogline(e.target.value)}
                rows={2}
                placeholder="A nurse in Soweto discovers her brother has been lying about where the money comes from."
                className="mt-1 w-full rounded-xl bg-white/[0.04] border border-white/[0.10] px-3 py-2.5 text-white placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none resize-none"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={create}
                disabled={creating}
                className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-3 font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {creating ? "Starting…" : "Start the series"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/[0.10] px-4 py-3 text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading your series…</p>
      ) : series.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Your series</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {series.map((s) => (
              <a
                key={s.id}
                href={`/series/${s.id}`}
                className="group rounded-2xl border border-white/[0.10] bg-white/[0.03] p-4 transition-all hover:-translate-y-0.5 hover:border-violet-500/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-zinc-100">{s.title}</h3>
                  <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-violet-300 shrink-0 mt-0.5" />
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  {localeOrDefault(s.language).label}
                  {s.genre ? ` · ${s.genre}` : ""}
                  {s.character_name ? ` · ${s.character_name}` : ""}
                </p>
                <p className="text-xs text-violet-300 mt-2">
                  {s.episode_count === 0
                    ? "No episodes yet"
                    : `${s.episode_count} episode${s.episode_count > 1 ? "s" : ""}`}
                </p>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </PageTransition>
  );
}
