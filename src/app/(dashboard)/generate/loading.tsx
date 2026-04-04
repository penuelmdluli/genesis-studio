import { Skeleton } from "@/components/ui/skeleton";

export default function GenerateLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Type selector */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-4">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>

          {/* Format */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-4">
            <Skeleton className="h-4 w-16 mb-2" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          </div>

          {/* Prompt */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-4 space-y-3">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-24 rounded-lg" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-28 rounded-md" />
            </div>
          </div>

          {/* Models */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        </div>

        {/* Summary sidebar */}
        <div>
          <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-6 space-y-4">
            <Skeleton className="h-5 w-36" />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
