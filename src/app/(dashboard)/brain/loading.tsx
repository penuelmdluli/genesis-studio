import { Skeleton, SkeletonCard, GenesisLoader } from "@/components/ui/skeleton";

export default function BrainLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center py-4">
        <GenesisLoader size="sm" text="Loading Brain Studio..." />
      </div>

      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Input form skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-6 space-y-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-28 rounded-lg" />
              <Skeleton className="h-10 w-28 rounded-lg" />
              <Skeleton className="h-10 w-28 rounded-lg" />
            </div>
          </div>

          {/* Scene cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-5 space-y-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
