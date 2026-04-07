"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import {
  LayoutDashboard,
  Sparkles,
  Film,
  Key,
  CreditCard,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
  Move,
  Menu,
  X,
  Shield,
  Brain,
  MessageCircle,
  Mic,
  Subtitles,
  ArrowUpCircle,
  ImageIcon,
  Lock,
  Plus,
  ArrowUpRight,
  Scissors,
  FolderOpen,
  Image,
  Users,
  Radio,
} from "lucide-react";
import { useEffect, useMemo } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  section?: string;
  comingSoon?: boolean;
}

const baseNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  // --- CREATE ---
  { href: "/generate", label: "Generate", icon: Sparkles, section: "Create", badge: "NEW" },
  { href: "/brain", label: "Brain Studio", icon: Brain, section: "Create", badge: "HOT" },
  { href: "/motion-control", label: "Motion Control", icon: Move, section: "Create", badge: "HOT" },
  { href: "/talking-avatar", label: "Talking Avatar", icon: MessageCircle, section: "Create", badge: "HOT" },
  // --- ENHANCE ---
  { href: "/upscale", label: "Upscaler", icon: ArrowUpCircle, section: "Enhance", badge: "NEW" },
  // --- AUDIO ---
  { href: "/voiceover", label: "AI Voiceover", icon: Mic, section: "Audio", badge: "NEW" },
  { href: "/captions", label: "Auto Captions", icon: Subtitles, section: "Audio", badge: "NEW" },
  // --- IMAGE ---
  { href: "/thumbnails", label: "AI Thumbnails", icon: ImageIcon, section: "Image", badge: "NEW" },
  { href: "/images", label: "Image Gen", icon: Image, section: "Image", badge: "HOT" },
  // --- EDIT ---
  { href: "/edit", label: "Video Editor", icon: Scissors, section: "Edit", badge: "NEW" },
  // --- MANAGE ---
  { href: "/gallery", label: "Gallery", icon: Film, section: "Manage" },
  { href: "/collections", label: "Collections", icon: FolderOpen, section: "Manage" },
  { href: "/api-keys", label: "API Keys", icon: Key, section: "Manage" },
  { href: "/pricing", label: "Pricing", icon: CreditCard, section: "Manage" },
  { href: "/settings", label: "Settings", icon: Settings, section: "Manage" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, sidebarOpen, toggleSidebar, mobileMenuOpen, setMobileMenuOpen, isInitialized } = useStore();

  // Add admin nav item for owners
  const navItems = useMemo(() => {
    const items = [...baseNavItems];
    if (user?.isOwner) {
      items.push({ href: "/studio", label: "Content Engine", icon: Radio, section: "Automate", badge: "NEW" });
      items.push({ href: "/admin", label: "Admin", icon: Shield });
    }
    return items;
  }, [user?.isOwner]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname, setMobileMenuOpen]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [setMobileMenuOpen]);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#0A0A0F]/90 border border-white/[0.06] backdrop-blur-xl text-zinc-400 hover:text-white transition-colors md:hidden"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          // Base: hidden on mobile, visible on md+
          "fixed left-0 top-0 bottom-0 z-50 flex flex-col border-r border-white/[0.06] bg-[#0A0A0F]/95 backdrop-blur-xl transition-all duration-300",
          // Desktop: show based on sidebarOpen state
          "hidden md:flex",
          sidebarOpen ? "md:w-64" : "md:w-16",
          // Mobile: show as overlay when mobileMenuOpen
          mobileMenuOpen && "!flex w-72"
        )}
      >
        {/* Logo + Mobile close */}
        <div className="flex items-center gap-2.5 p-4 h-16 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-lg shadow-violet-600/20">
            G
          </div>
          {(sidebarOpen || mobileMenuOpen) && (
            <span className="text-lg font-bold gradient-text truncate flex-1">
              Genesis Studio
            </span>
          )}
          {/* Mobile close button */}
          {mobileMenuOpen && (
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-colors md:hidden"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Credit Balance Widget */}
        {(() => {
          const expanded = sidebarOpen || mobileMenuOpen;

          // Show loading skeleton while data is fetching
          if (!isInitialized) {
            return (
              <div className={cn(
                "mx-3 mt-3 rounded-xl border bg-white/[0.03] border-white/[0.06] animate-pulse",
                expanded ? "p-3" : "p-2"
              )}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/[0.06] shrink-0" />
                  {expanded && (
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-12 bg-white/[0.06] rounded" />
                      <div className="h-4 w-16 bg-white/[0.06] rounded" />
                    </div>
                  )}
                </div>
                {expanded && (
                  <>
                    <div className="h-1 rounded-full bg-white/[0.06] mt-2 mb-2.5" />
                    <div className="flex gap-1.5">
                      <div className="flex-1 h-7 bg-white/[0.06] rounded-lg" />
                      <div className="w-20 h-7 bg-white/[0.06] rounded-lg" />
                    </div>
                  </>
                )}
              </div>
            );
          }

          const credits = user?.creditBalance ?? 0;
          const limit = user?.monthlyCreditsLimit ?? 50;
          const isLow = credits < 100 && credits > 0;
          const isEmpty = credits <= 0;

          return (
            <div className={cn(
              "mx-3 mt-3 rounded-xl border transition-all",
              isEmpty
                ? "bg-red-500/8 border-red-500/25"
                : isLow
                  ? "bg-amber-500/8 border-amber-500/20"
                  : "bg-gradient-to-r from-violet-500/10 to-cyan-500/5 border-violet-500/20",
              expanded ? "p-3" : "p-2"
            )}>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                  isEmpty ? "bg-red-500/20" : isLow ? "bg-amber-500/20" : "bg-violet-500/20"
                )}>
                  <Zap className={cn(
                    "w-3.5 h-3.5",
                    isEmpty ? "text-red-400" : isLow ? "text-amber-400" : "text-violet-400"
                  )} />
                </div>
                {expanded && (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Credits</span>
                    </div>
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      isEmpty ? "text-red-400" : isLow ? "text-amber-400" : "text-violet-300"
                    )}>
                      {credits.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {expanded && (
                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden mt-2 mb-2.5">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isEmpty ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-violet-500"
                    )}
                    style={{ width: `${Math.min((credits / limit) * 100, 100)}%` }}
                  />
                </div>
              )}

              {/* Buy / Upgrade buttons */}
              {expanded && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => useStore.getState().setCreditPurchaseOpen(true)}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1",
                      isEmpty
                        ? "bg-red-500 hover:bg-red-400 text-white"
                        : "bg-violet-600 hover:bg-violet-500 text-white"
                    )}
                  >
                    <Plus className="w-3 h-3" /> Buy
                  </button>
                  {user?.plan !== "studio" && (
                    <Link
                      href="/pricing"
                      className="px-2 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-[11px] font-medium text-zinc-300 transition-all flex items-center gap-1"
                    >
                      Upgrade <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              )}

              {/* Collapsed: just show buy icon */}
              {!expanded && (
                <button
                  onClick={() => useStore.getState().setCreditPurchaseOpen(true)}
                  className="w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 flex items-center justify-center mt-2 mx-auto transition-colors"
                  aria-label="Buy credits"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                </button>
              )}

              {/* Warning text */}
              {expanded && isLow && !isEmpty && (
                <p className="text-[10px] text-amber-400/60 mt-1.5 text-center">Running low — top up to keep creating</p>
              )}
              {expanded && isEmpty && (
                <p className="text-[10px] text-red-400/60 mt-1.5 text-center">No credits left — buy more to continue</p>
              )}
            </div>
          );
        })()}

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto" aria-label="Main navigation">
          {navItems.map((item, idx) => {
            const isActive = pathname === item.href;
            const prevItem = navItems[idx - 1];
            const showSection = (sidebarOpen || mobileMenuOpen) && item.section && item.section !== prevItem?.section;

            return (
              <div key={item.href}>
                {showSection && (
                  <div className="px-3 pt-4 pb-1.5 text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">
                    {item.section}
                  </div>
                )}
                {item.comingSoon ? (
                  <div
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 cursor-default group relative"
                    title={`${item.label} — Coming Soon`}
                  >
                    <item.icon className="w-[18px] h-[18px] shrink-0 text-zinc-700" />
                    {(sidebarOpen || mobileMenuOpen) && (
                      <span className="truncate flex-1">{item.label}</span>
                    )}
                    {(sidebarOpen || mobileMenuOpen) && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full leading-none bg-zinc-800 text-zinc-500">
                        <Lock className="w-2.5 h-2.5" /> Soon
                      </span>
                    )}
                  </div>
                ) : (
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group relative focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none",
                    isActive
                      ? "bg-violet-500/15 text-violet-300"
                      : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-violet-500" />
                  )}
                  <item.icon className={cn("w-[18px] h-[18px] shrink-0 transition-colors", isActive ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-300")} />
                  {(sidebarOpen || mobileMenuOpen) && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {(sidebarOpen || mobileMenuOpen) && item.badge && (
                    item.badge === "HOT" ? (
                      <span className="relative flex items-center">
                        <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
                        <span className="relative px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full leading-none bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/30 animate-pulse">
                          🔥 HOT
                        </span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full leading-none bg-gradient-to-r from-violet-500 to-cyan-500 text-white">
                        {item.badge}
                      </span>
                    )
                  )}
                </Link>
                )}
              </div>
            );
          })}
        </nav>

        {/* User + Collapse */}
        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3">
            <UserButton
              appearance={{
                elements: { avatarBox: "w-8 h-8 rounded-lg" },
              }}
            />
            {(sidebarOpen || mobileMenuOpen) && (
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-200 truncate">
                  {user?.name || "User"}
                </div>
                <div className="text-xs text-zinc-500 truncate capitalize">
                  {user?.plan || "free"} plan
                </div>
              </div>
            )}
            {/* Desktop-only collapse toggle */}
            <button
              onClick={toggleSidebar}
              className="hidden md:block p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
