"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search,
  LayoutDashboard,
  Sparkles,
  Film,
  Key,
  CreditCard,
  Settings,
  Plus,
  ArrowRight,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  icon: typeof Search;
  action: () => void;
  group: string;
  shortcut?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commands: Command[] = [
    { id: "generate", label: "Generate New Video", icon: Sparkles, action: () => router.push("/generate"), group: "Actions", shortcut: "G" },
    { id: "dashboard", label: "Go to Dashboard", icon: LayoutDashboard, action: () => router.push("/dashboard"), group: "Navigation" },
    { id: "gallery", label: "Go to Gallery", icon: Film, action: () => router.push("/gallery"), group: "Navigation" },
    { id: "api-keys", label: "Manage API Keys", icon: Key, action: () => router.push("/api-keys"), group: "Navigation" },
    { id: "pricing", label: "View Pricing", icon: CreditCard, action: () => router.push("/pricing"), group: "Navigation" },
    { id: "settings", label: "Settings", icon: Settings, action: () => router.push("/settings"), group: "Navigation" },
  ];

  const filtered = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const executeCommand = useCallback((cmd: Command) => {
    setOpen(false);
    setQuery("");
    cmd.action();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      executeCommand(filtered[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg rounded-2xl glass-strong shadow-2xl shadow-violet-600/10 overflow-hidden animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded text-[10px] text-zinc-500 border border-white/[0.06] bg-white/[0.03] font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-zinc-500">
              No commands found
            </div>
          ) : (
            <>
              {["Actions", "Navigation"].map((group) => {
                const groupItems = filtered.filter((c) => c.group === group);
                if (groupItems.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      {group}
                    </div>
                    {groupItems.map((cmd) => {
                      const idx = filtered.indexOf(cmd);
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => executeCommand(cmd)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                            idx === selectedIndex
                              ? "bg-violet-500/15 text-violet-300"
                              : "text-zinc-300 hover:bg-white/[0.04]"
                          )}
                        >
                          <cmd.icon className="w-4 h-4 shrink-0" />
                          <span className="flex-1 text-left">{cmd.label}</span>
                          {cmd.shortcut && (
                            <kbd className="px-1.5 py-0.5 rounded text-[10px] text-zinc-500 border border-white/[0.06] bg-white/[0.03] font-mono">
                              {cmd.shortcut}
                            </kbd>
                          )}
                          <ArrowRight className="w-3 h-3 text-zinc-600" />
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-4 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-white/[0.06] bg-white/[0.03] font-mono">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-white/[0.06] bg-white/[0.03] font-mono">↵</kbd>
            Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-white/[0.06] bg-white/[0.03] font-mono">⌘K</kbd>
            Toggle
          </span>
        </div>
      </div>
    </div>
  );
}
