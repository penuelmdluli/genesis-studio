"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { CHANGELOG, type ChangelogEntry } from "@/lib/changelog";

export function WhatsNewBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lastSeen = localStorage.getItem("genesis-changelog-seen");
    if (!lastSeen) {
      setUnreadCount(CHANGELOG.length);
    } else {
      const count = CHANGELOG.filter((e) => e.date > lastSeen).length;
      setUnreadCount(count);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = () => {
    setOpen(!open);
    if (!open) {
      localStorage.setItem("genesis-changelog-seen", new Date().toISOString().split("T")[0]);
      setUnreadCount(0);
    }
  };

  const typeColors: Record<ChangelogEntry["type"], string> = {
    feature: "bg-violet-500/15 text-violet-300",
    improvement: "bg-emerald-500/15 text-emerald-300",
    fix: "bg-amber-500/15 text-amber-300",
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
        aria-label="What's New"
      >
        <Bell className="w-5 h-5 text-zinc-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-violet-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#12121A] shadow-2xl shadow-black/40 z-50">
          <div className="p-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-zinc-100">What&apos;s New</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Latest updates and features</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {CHANGELOG.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${typeColors[entry.type]}`}>
                    {entry.type}
                  </span>
                  {entry.badge && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500 text-white">
                      {entry.badge}
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-600 ml-auto">{entry.date}</span>
                </div>
                <h4 className="text-sm font-medium text-zinc-200">{entry.title}</h4>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{entry.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
