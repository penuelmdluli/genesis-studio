"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MobileActionBarProps {
  children: ReactNode;
  className?: string;
  show?: boolean;
}

/**
 * Fixed bottom action bar for mobile devices.
 * Hidden on md+ screens where actions are inline.
 * Respects safe-area-inset-bottom for notched devices.
 */
export function MobileActionBar({ children, className, show = true }: MobileActionBarProps) {
  if (!show) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 md:hidden",
        "bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-white/[0.06]",
        "px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]",
        className
      )}
    >
      {children}
    </div>
  );
}
