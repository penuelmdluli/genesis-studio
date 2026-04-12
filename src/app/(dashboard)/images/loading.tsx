import { Skeleton, GenesisLoader } from "@/components/ui/skeleton";

export default function ImagesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center py-4">
        <GenesisLoader size="sm" text="Loading Image Generator..." />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-6 space-y-4">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-5 space-y-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
