export default function BandsLoading() {
  return (
    <div className="container py-8 space-y-6">
      <div className="h-12 animate-pulse rounded-2xl bg-card/50 w-64" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-card/30" />
        ))}
      </div>
    </div>
  );
}
