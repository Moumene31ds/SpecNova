export default function SearchLoading() {
  return (
    <div className="container py-8 space-y-6">
      <div className="h-14 animate-pulse rounded-2xl bg-card/50" />
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-card/30" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-2xl bg-card/30" />
        ))}
      </div>
    </div>
  );
}
