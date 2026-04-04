import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  color?: string;
}

export function Progress({ value, className, color = "bg-violet-500" }: ProgressProps) {
  return (
    <div className={cn("w-full h-2 bg-zinc-800 rounded-full overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500 ease-out", color)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
