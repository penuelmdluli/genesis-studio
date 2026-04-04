import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "violet" | "emerald" | "amber" | "red" | "cyan" | "pink";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-white/[0.06] text-zinc-300 border-white/[0.06]",
    violet: "bg-violet-500/15 text-violet-400 border-violet-500/20",
    emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    red: "bg-red-500/15 text-red-400 border-red-500/20",
    cyan: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
    pink: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
