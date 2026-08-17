import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-muted", className)}
      {...props}
    />
  );
}

export function DeviceCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card/50 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-5 w-32" />
          <Skeleton className="mt-2 h-4 w-16" />
        </div>
        <Skeleton className="h-14 w-14 rounded-full" />
      </div>
      <Skeleton className="mt-5 aspect-[4/3] rounded-xl" />
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function DeviceGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <DeviceCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SpecGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card/40 p-5">
          <Skeleton className="h-4 w-24 mb-4" />
          {Array.from({ length: 5 }).map((_, j) => (
            <div key={j} className="flex items-center justify-between py-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="container pb-20 pt-24 md:pt-32">
      <div className="flex flex-col items-center text-center">
        <Skeleton className="h-6 w-48 rounded-full" />
        <Skeleton className="mt-6 h-12 w-96 max-w-full" />
        <Skeleton className="mt-2 h-12 w-80 max-w-full" />
        <Skeleton className="mt-6 h-5 w-[600px] max-w-full" />
        <Skeleton className="mt-10 h-14 w-[500px] max-w-full rounded-2xl" />
      </div>
    </div>
  );
}

export { Skeleton };
