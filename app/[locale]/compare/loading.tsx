export default function CompareLoading() {
  return (
    <div className="container py-8 space-y-6">
      <div className="h-12 animate-pulse rounded-2xl bg-card/50 w-64" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl bg-card/30" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-card/30" />
    </div>
  );
}
