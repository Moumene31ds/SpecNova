export default function RankingsLoading() {
  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 animate-pulse rounded-xl bg-card/30" />
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-card/30" />
          <div className="h-4 w-32 animate-pulse rounded-lg bg-card/20" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-20 animate-pulse rounded-lg bg-card/30" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-card/30" />
        ))}
      </div>
    </div>
  );
}
