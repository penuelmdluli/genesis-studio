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
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/gallery", label: "Gallery", icon: Film },
  { href: "/api-keys", label: "API Keys", icon: Key },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, sidebarOpen, toggleSidebar } = useStore();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r border-white/[0.06] bg-[#0A0A0F]/95 backdrop-blur-xl transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 p-4 h-16 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-lg shadow-violet-600/20">
          G
        </div>
        {sidebarOpen && (
          <span className="text-lg font-bold gradient-text truncate">
            Genesis Studio
          </span>
        )}
      </div>

      {/* Credit Balance */}
      <div className={cn(
        "mx-3 mt-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-cyan-500/5 border border-violet-500/20 transition-all",
        sidebarOpen ? "p-3" : "p-2"
      )}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-violet-400" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Credits</div>
              <div className="text-sm font-bold text-violet-300">
                {user?.creditBalance?.toLocaleString() ?? "—"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                isActive
                  ? "bg-violet-500/15 text-violet-300"
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-violet-500" />
              )}
              <item.icon className={cn("w-[18px] h-[18px] shrink-0 transition-colors", isActive ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-300")} />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </Link>
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
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-zinc-200 truncate">
                {user?.name || "User"}
              </div>
              <div className="text-xs text-zinc-500 truncate capitalize">
                {user?.plan || "free"} plan
              </div>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-colors"
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
  );
}
