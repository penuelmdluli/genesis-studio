import { Skeleton, SkeletonCard, SkeletonVideoCard, SkeletonRow } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Credit Usage */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-6 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-64" />
      </div>

      {/* Active Jobs */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-6 space-y-3">
        <Skeleton className="h-5 w-36" />
        {[1, 2].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>

      {/* Recent Videos */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-6 space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonVideoCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
