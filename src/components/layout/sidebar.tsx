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
        "fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 p-4 h-16 border-b border-zinc-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center font-bold text-sm text-white shrink-0">
          G
        </div>
        {sidebarOpen && (
          <span className="text-lg font-bold gradient-text truncate">
            Genesis Studio
          </span>
        )}
      </div>

      {/* Credit Balance */}
      <div className="p-3 mx-3 mt-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-violet-400 shrink-0" />
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="text-xs text-zinc-400">Credits</div>
              <div className="text-sm font-bold text-violet-300">
                {user?.creditBalance?.toLocaleString() ?? "—"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-violet-500/15 text-violet-300 border border-violet-500/20"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + Collapse */}
      <div className="border-t border-zinc-800 p-3">
        <div className="flex items-center gap-3">
          <UserButton
            appearance={{
              elements: { avatarBox: "w-8 h-8" },
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
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500"
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
