"use client";

import { useState, useEffect } from "react";
import { Zap, X } from "lucide-react";

interface LoadSheddingData {
  stage: number;
  stageName: string;
  note: string;
}

export function LoadSheddingBanner() {
  const [data, setData] = useState<LoadSheddingData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only fetch if user appears to be in South Africa (check timezone)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const saTimezones = ["Africa/Johannesburg", "Africa/Harare", "Africa/Maputo"];
    if (!saTimezones.includes(tz)) return;

    // Check if already dismissed this session
    if (sessionStorage.getItem("genesis-ls-dismissed")) return;

    fetch("/api/loadshedding")
      .then((res) => res.ok ? res.json() : null)
      .then((d) => {
        if (d && d.stage > 0) setData(d);
      })
      .catch(() => {});
  }, []);

  if (!data || dismissed) return null;

  const stageColors: Record<number, string> = {
    1: "bg-yellow-500/10 border-yellow-500/20 text-yellow-300",
    2: "bg-yellow-500/10 border-yellow-500/20 text-yellow-300",
    3: "bg-orange-500/10 border-orange-500/20 text-orange-300",
    4: "bg-orange-500/10 border-orange-500/20 text-orange-300",
    5: "bg-red-500/10 border-red-500/20 text-red-300",
    6: "bg-red-500/10 border-red-500/20 text-red-300",
    7: "bg-red-600/10 border-red-600/20 text-red-200",
    8: "bg-red-700/10 border-red-700/20 text-red-100",
  };

  const colorClass = stageColors[data.stage] || stageColors[1];

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border ${colorClass}`}>
      <div className="flex items-center gap-2.5">
        <Zap className="w-4 h-4 shrink-0" />
        <div>
          <span className="text-sm font-medium">{data.stageName}</span>
          <span className="text-xs opacity-75 ml-2">
            Your generations are cloud-based and unaffected by load shedding. Keep creating!
          </span>
        </div>
      </div>
      <button
        onClick={() => {
          setDismissed(true);
          sessionStorage.setItem("genesis-ls-dismissed", "1");
        }}
        className="p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
