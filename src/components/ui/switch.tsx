"use client";

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  className?: string;
  size?: "sm" | "md";
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  description,
  className,
  size = "md",
}: SwitchProps) {
  const trackSize = size === "sm" ? "w-9 h-5" : "w-11 h-6";
  const thumbSize = size === "sm" ? "w-3.5 h-3.5" : "w-4.5 h-4.5";
  const thumbTranslate = size === "sm" ? "translate-x-4" : "translate-x-5";

  return (
    <label
      className={cn(
        "flex items-center gap-3 cursor-pointer select-none",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {(label || description) && (
        <div className="flex-1 min-w-0">
          {label && <span className="text-sm font-medium text-zinc-200 block">{label}</span>}
          {description && <span className="text-xs text-zinc-500 block mt-0.5">{description}</span>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex shrink-0 rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F]",
          trackSize,
          checked
            ? "bg-violet-600"
            : "bg-white/[0.1]"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out",
            thumbSize,
            "mt-[3px] ml-[3px]",
            checked ? thumbTranslate : "translate-x-0"
          )}
        />
      </button>
    </label>
  );
}
