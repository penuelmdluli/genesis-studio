"use client";

import { useState, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

const positions = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={cn(
            "absolute z-50 px-2.5 py-1.5 text-xs text-zinc-200 bg-zinc-900 border border-white/[0.08] rounded-lg shadow-xl whitespace-nowrap animate-fade-in-scale",
            positions[side],
            className
          )}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
}

/**
 * HelpTip — small info icon with hover tooltip.
 * Use on complex features to explain what they do.
 */
export function HelpTip({
  text,
  side = "top",
  className,
}: {
  text: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  return (
    <Tooltip content={text} side={side} className={cn("max-w-[200px] whitespace-normal", className)}>
      <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-help shrink-0" />
    </Tooltip>
  );
}
