"use client";

import { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";
import {
  getDataSaverConfig,
  setDataSaverConfig,
  DATA_SAVER_ON,
  DATA_SAVER_DEFAULTS,
  detectExpensiveConnection,
} from "@/lib/data-saver";

export function DataSaverToggle() {
  const [enabled, setEnabled] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const config = getDataSaverConfig();
    setEnabled(config.enabled);

    // Auto-suggest data saver on expensive connections
    if (!config.enabled && detectExpensiveConnection()) {
      const hintDismissed = localStorage.getItem("genesis-datasaver-hint-dismissed");
      if (!hintDismissed) {
        setShowHint(true);
      }
    }
  }, []);

  const toggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    setDataSaverConfig(newEnabled ? DATA_SAVER_ON : DATA_SAVER_DEFAULTS);
    setShowHint(false);
  };

  const dismissHint = () => {
    setShowHint(false);
    localStorage.setItem("genesis-datasaver-hint-dismissed", "1");
  };

  return (
    <>
      <button
        onClick={toggle}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
          enabled
            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
            : "bg-white/[0.03] text-zinc-500 border border-white/[0.06] hover:text-zinc-300"
        }`}
        title={enabled ? "Data Saver: ON — lower quality previews, no autoplay" : "Data Saver: OFF"}
        aria-label={enabled ? "Data Saver is on, click to turn off" : "Data Saver is off, click to turn on"}
        aria-pressed={enabled}
      >
        {enabled ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
        Data Saver {enabled ? "ON" : "OFF"}
      </button>

      {showHint && (
        <div className="fixed bottom-4 right-4 max-w-sm p-4 rounded-2xl border border-emerald-500/20 bg-[#12121A] shadow-2xl shadow-black/40 z-50">
          <div className="flex items-start gap-3">
            <WifiOff className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-zinc-100">Save Mobile Data?</h4>
              <p className="text-xs text-zinc-400 mt-1">
                We detected you might be on mobile data. Enable Data Saver to reduce video previews and save data.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={toggle}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition-colors"
                >
                  Enable Data Saver
                </button>
                <button
                  onClick={dismissHint}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-zinc-400 text-xs hover:text-zinc-300 transition-colors"
                >
                  No thanks
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
