"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "./auth-provider";

export function UserButton() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={ref}>
      {/* A bare avatar gave no hint that it opened anything, which is why
          people could not find Sign out. The ring and caret say "menu". */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-medium text-white transition hover:bg-violet-500 ring-1 ring-white/20 hover:ring-white/40"
        title={`${user.name} — account menu`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-zinc-800 ring-1 ring-white/20">
          <svg viewBox="0 0 8 8" className="h-2 w-2 text-zinc-300" aria-hidden="true">
            <path d="M1 2.5L4 5.5L7 2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
          <div className="border-b border-zinc-700 px-4 py-3">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-zinc-400">{user.email}</p>
          </div>
          <div className="py-1">
            <button
              onClick={() => {
                setOpen(false);
                window.location.href = "/settings";
              }}
              className="flex w-full px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Settings
            </button>
            <button
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="flex w-full px-4 py-2 text-sm text-red-400 hover:bg-zinc-800 hover:text-red-300"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
