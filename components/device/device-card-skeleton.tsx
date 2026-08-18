"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function DeviceCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="mt-2 h-5 w-32 rounded" />
          <Skeleton className="mt-2 h-4 w-14 rounded-full" />
        </div>
        <Skeleton className="h-14 w-14 rounded-full" />
      </div>
      <Skeleton className="mt-4 aspect-[4/3] w-full rounded-xl" />
      <div className="mt-3 flex items-center gap-3">
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-12 rounded" />
        <Skeleton className="h-3 w-12 rounded" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
    </div>
  );
}

export function DeviceGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <DeviceCardSkeleton key={i} />
      ))}
    </div>
  );
}
