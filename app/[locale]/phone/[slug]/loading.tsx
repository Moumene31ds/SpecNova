import { Skeleton } from "@/components/ui/skeleton";

export default function PhoneLoading() {
  return (
    <div className="container py-8">
      <Skeleton className="mb-6 h-6 w-32" />
      <div className="rounded-3xl border border-border p-5 sm:p-8 md:p-12">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-5 w-48" />
            <div className="flex gap-4 pt-4">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>
          <Skeleton className="aspect-square w-full rounded-2xl" />
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="mt-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
