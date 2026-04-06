"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check, CheckCheck, Trash2, Sparkles, AlertCircle, Info, Gift, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore, AppNotification } from "@/hooks/use-store";
import Link from "next/link";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const iconMap = {
  success: Sparkles,
  error: AlertCircle,
  info: Info,
  promo: Gift,
};

const colorMap = {
  success: "text-emerald-400 bg-emerald-500/15",
  error: "text-red-400 bg-red-500/15",
  info: "text-blue-400 bg-blue-500/15",
  promo: "text-amber-400 bg-amber-500/15",
};

function NotificationItem({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
}) {
  const Icon = iconMap[notification.type];
  const color = colorMap[notification.type];

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-3 rounded-lg transition-colors cursor-pointer",
        notification.read
          ? "opacity-60 hover:bg-white/[0.03]"
          : "bg-white/[0.04] hover:bg-white/[0.06]"
      )}
      onClick={() => onRead(notification.id)}
    >
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm font-medium truncate", notification.read ? "text-zinc-400" : "text-white")}>
            {notification.title}
          </p>
          {!notification.read && (
            <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{notification.message}</p>
        <p className="text-[10px] text-zinc-600 mt-1">{timeAgo(notification.createdAt)}</p>
      </div>
    </div>
  );

  if (notification.link) {
    return (
      <Link href={notification.link} onClick={() => onRead(notification.id)}>
        {content}
      </Link>
    );
  }

  return content;
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, markNotificationRead, markAllNotificationsRead, clearNotifications } = useStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          isOpen
            ? "bg-white/[0.08] text-white"
            : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white px-1 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={cn(
          "absolute right-0 top-full mt-2 z-50",
          "w-[340px] sm:w-[380px] max-h-[480px]",
          "rounded-xl border border-white/[0.08] bg-[#0f0f17] shadow-2xl shadow-black/40",
          "flex flex-col overflow-hidden animate-fade-in-scale"
        )}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3 shrink-0">
            <p className="text-sm font-semibold text-white flex-1">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="text-[11px] text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearNotifications}
                className="text-zinc-600 hover:text-zinc-400 transition-colors p-1"
                title="Clear all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No notifications yet</p>
                <p className="text-xs text-zinc-600 mt-1">
                  We&apos;ll notify you when your creations are ready
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={markNotificationRead}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
