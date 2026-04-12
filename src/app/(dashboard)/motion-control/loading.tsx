import { Skeleton, GenesisLoader } from "@/components/ui/skeleton";

export default function MotionControlLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center py-4">
        <GenesisLoader size="sm" text="Loading Motion Control..." />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          </div>
          {/* Effects grid */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-6 space-y-4">
            <Skeleton className="h-5 w-24" />
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          </div>
        </div>

        {/* Settings sidebar */}
        <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-5 space-y-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
