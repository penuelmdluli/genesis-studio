import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  color?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Progress({
  value,
  className,
  color = "bg-gradient-to-r from-violet-600 to-violet-400",
  showLabel,
  size = "sm",
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const heights = { sm: "h-1.5", md: "h-2", lg: "h-3" };

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("w-full bg-white/[0.06] rounded-full overflow-hidden", heights[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", color)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1">
          <span className="text-xs text-zinc-500">{Math.round(clamped)}%</span>
        </div>
      )}
    </div>
  );
}
