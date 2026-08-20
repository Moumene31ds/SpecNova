export default function FinderLoading() {
  return (
    <div className="container py-8 space-y-6">
      <div className="h-12 animate-pulse rounded-2xl bg-card/50 w-64" />
      <div className="h-14 animate-pulse rounded-2xl bg-card/50" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-card/30" />
        ))}
      </div>
    </div>
  );
}
