import { Skeleton, SkeletonCard, GenesisLoader } from "@/components/ui/skeleton";

export default function PricingLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center py-4">
        <GenesisLoader size="sm" text="Loading pricing..." />
      </div>

      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-4 w-72 mx-auto" />
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-6 space-y-4">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-4 w-full" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((j) => (
                <Skeleton key={j} className="h-3 w-full" />
              ))}
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ))}
      </div>

      {/* Credit packs */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32 mx-auto" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
