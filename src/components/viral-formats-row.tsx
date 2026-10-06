"use client";

// "Trending formats": one tap fills in the whole video, the person only adds
// their photo. See lib/viral-formats.ts for why these six.

import { VIRAL_FORMATS, type ViralFormat } from "@/lib/viral-formats";
import { Flame } from "lucide-react";

interface ViralFormatsRowProps {
  activeId?: string | null;
  onSelect: (format: ViralFormat) => void;
}

export function ViralFormatsRow({ activeId, onSelect }: ViralFormatsRowProps) {
  return (
    <section aria-labelledby="viral-formats-heading">
      <div className="flex items-center gap-2 mb-2">
        <Flame className="w-4 h-4 text-orange-400" />
        <h2 id="viral-formats-heading" className="text-sm font-semibold text-zinc-200">
          Trending formats
        </h2>
        <span className="text-xs text-zinc-400">Tap one, add your photo, done</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {VIRAL_FORMATS.map((f) => {
          const active = f.id === activeId;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelect(f)}
              aria-pressed={active}
              className={`snap-start shrink-0 w-40 sm:w-44 text-left rounded-xl border p-3 bg-gradient-to-br ${f.gradient} transition-all press-effect ${
                active
                  ? "border-violet-400/70 ring-2 ring-violet-500/40"
                  : "border-white/[0.10] hover:border-white/[0.25]"
              }`}
            >
              <div className="text-2xl mb-2" aria-hidden="true">{f.emoji}</div>
              <div className="text-sm font-semibold text-white leading-tight">{f.title}</div>
              <div className="text-[11px] text-zinc-300 mt-1 leading-snug">{f.tagline}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
