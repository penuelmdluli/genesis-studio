import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("skeleton", className)} />;
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-xl border border-white/[0.06] bg-surface-1 p-5 space-y-4", className)}>
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
    <div className={cn("rounded-xl border border-white/[0.06] bg-surface-1 overflow-hidden", className)}>
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function SkeletonRow({ className }: SkeletonProps) {
  return (
    <div className={cn("flex items-center gap-4 p-3 rounded-xl border border-white/[0.06]", className)}>
      <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="w-16 h-6 rounded-md shrink-0" />
    </div>
  );
}
