import { Skeleton, GenesisLoader } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-center py-4">
        <GenesisLoader size="sm" text="Loading settings..." />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Profile section */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-6 space-y-4">
        <Skeleton className="h-5 w-20" />
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      </div>

      {/* Plan section */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-6 space-y-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Credit history */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111118]/80 p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between py-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
