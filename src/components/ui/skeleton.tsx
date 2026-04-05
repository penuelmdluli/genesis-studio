import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-white/[0.06]",
        "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/[0.07] before:to-transparent",
        "before:animate-[shimmer_2s_infinite]",
        className
      )}
    />
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-xl border border-white/[0.06] bg-[#111118]/80 p-5 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

export function SkeletonVideoCard({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-xl border border-white/[0.06] bg-[#111118]/80 overflow-hidden", className)}>
      <div className="relative aspect-video">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <div className="w-0 h-0 border-l-[8px] border-l-white/[0.15] border-y-[6px] border-y-transparent ml-0.5" />
          </div>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRow({ className }: SkeletonProps) {
  return (
    <div className={cn("flex items-center gap-4 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]", className)}>
      <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="w-16 h-6 rounded-md shrink-0" />
    </div>
  );
}

/* ============================================
   GENESIS LOADER — Premium orbital spinner
   ============================================ */
export function GenesisLoader({
  size = "md",
  text,
  className,
}: {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}) {
  const dims = { sm: 32, md: 48, lg: 64 };
  const d = dims[size];
  const textSize = { sm: "text-xs", md: "text-sm", lg: "text-base" };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div className="relative" style={{ width: d, height: d }}>
        {/* Outer ring */}
        <svg className="absolute inset-0 animate-spin" style={{ animationDuration: "2s" }} viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="22" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="2" />
          <circle cx="25" cy="25" r="22" fill="none" stroke="url(#grad1)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="110 30" />
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="50%" stopColor="#d946ef" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
        {/* Inner ring */}
        <svg className="absolute inset-[20%] animate-spin" style={{ animationDuration: "1.5s", animationDirection: "reverse" }} viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(217,70,239,0.15)" strokeWidth="2" />
          <circle cx="25" cy="25" r="20" fill="none" stroke="#d946ef" strokeWidth="2" strokeLinecap="round" strokeDasharray="60 70" />
        </svg>
        {/* Center pulse */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse shadow-[0_0_12px_rgba(139,92,246,0.8)]" />
        </div>
      </div>
      {text && (
        <p className={cn("text-zinc-500 font-medium", textSize[size])}>
          {text}
        </p>
      )}
    </div>
  );
}

/* ============================================
   PAGE LOADER — Beautiful full page loading
   ============================================ */
export function PageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <GenesisLoader size="lg" />
      <p className="mt-6 text-sm text-zinc-500">{text}</p>
      {/* Animated progress bar */}
      <div className="w-52 h-1 mt-4 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 animate-[progress_1.5s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}

/* ============================================
   VIDEO LOADING PLACEHOLDER
   ============================================ */
export function VideoLoadingPlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-[#0D0D14] flex items-center justify-center", className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/15 via-[#0D0D14] to-fuchsia-900/10" />
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-[shimmer_2.5s_infinite]" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-2">
        <GenesisLoader size="sm" />
        <span className="text-[10px] text-zinc-600">Loading...</span>
      </div>
    </div>
  );
}
