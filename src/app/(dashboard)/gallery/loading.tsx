import { Skeleton, SkeletonVideoCard, GenesisLoader } from "@/components/ui/skeleton";

export default function GalleryLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center py-4">
        <GenesisLoader size="sm" text="Loading gallery..." />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-16 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <SkeletonVideoCard key={i} />
        ))}
      </div>
    </div>
  );
}
