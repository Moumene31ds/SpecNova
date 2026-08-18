import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerTokens } from "@/lib/firebase/auth";
import { parseRoles } from "@/lib/firebase/roles";
import { getAdminFirestore, isFirebaseConfigured } from "@/lib/firebase/admin";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Smartphone, FileCheck, BarChart3, Building2 } from "lucide-react";
import { ScoreDistributionChart, BrandDistributionChart } from "@/components/admin/charts";

export default async function AdminDashboardPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  const tokens = await getServerTokens();
  const claims = tokens?.decodedToken;
  const roles = parseRoles(claims as unknown as Record<string, unknown> | undefined);
  if (!roles.isAdmin && !roles.isEditor) redirect(`/${locale}`);

  if (!isFirebaseConfigured()) {
    return (
      <div className="rounded-xl border border-border p-8 text-sm text-muted-foreground">
        Firestore isn&apos;t configured (FIREBASE_SERVICE_ACCOUNT_JSON is missing), so the
        dashboard can&apos;t query live data. The editor still works — auto-fill is Gemini-only.
      </div>
    );
  }

  const db = getAdminFirestore();

  const statuses = ["available", "upcoming", "announced", "rumored", "discontinued"] as const;

  const [countSnapshots, devicesSnapshot, auditSnapshot] = await Promise.all([
    Promise.all(statuses.map((s) => db.collection("devices").where("status", "==", s).count().get())),
    db.collection("devices").orderBy("updatedAt", "desc").limit(100).get(),
    db
      .collection("audit_logs")
      .orderBy("createdAt", "desc")
      .limit(12)
      .get(),
  ]);

  const counts = Object.fromEntries(statuses.map((s, i) => [s, countSnapshots[i]!.data().count]));
  const totalDevices = Object.values(counts).reduce((a, b) => a + b, 0) as number;

  const allDevices = devicesSnapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name ?? d.id,
      brand: data.brand ?? "—",
      status: data.status ?? "—",
      score: typeof data.score === "number" ? data.score : null,
      updatedAt: data.updatedAt?.toDate?.() ?? null,
    };
  });

  const publishedCount = allDevices.filter((d) => d.status === "available").length;
  const draftCount = totalDevices - publishedCount;

  const scoredDevices = allDevices.filter((d) => d.score !== null);
  const avgScore =
    scoredDevices.length > 0
      ? Math.round(scoredDevices.reduce((a, d) => a + (d.score as number), 0) / scoredDevices.length)
      : 0;

  const brandMap = new Map<string, number>();
  for (const d of allDevices) {
    brandMap.set(d.brand, (brandMap.get(d.brand) ?? 0) + 1);
  }
  const totalBrands = brandMap.size;

  const scoreRanges = ["0–20", "20–40", "40–60", "60–80", "80–100"];
  const scoreDistribution = scoreRanges.map((range) => {
    const [lo, hi] = range.split("–").map(Number);
    const count = scoredDevices.filter((d) => {
      const s = d.score as number;
      return s >= lo && s < hi;
    }).length;
    return { range, count };
  });
  scoreDistribution[4].count += scoredDevices.filter((d) => (d.score as number) === 100).length;

  const sortedBrands = [...brandMap.entries()].sort((a, b) => b[1] - a[1]);
  const topBrands = sortedBrands.slice(0, 8);
  const othersCount = sortedBrands.slice(8).reduce((a, b) => a + b[1], 0);
  const brandPieData = topBrands.map(([name, count]) => ({ name, count }));
  if (othersCount > 0) brandPieData.push({ name: "Others", count: othersCount });

  const recentDevices = allDevices.slice(0, 5);

  const audit = auditSnapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      action: data.action ?? "—",
      resourceType: data.resourceType ?? "—",
      resourceId: data.resourceId ?? null,
      actorEmail: data.actorEmail ?? data.actorUid ?? "system",
      severity: data.severity ?? "info",
      note: data.note ?? null,
      ip: data.ip ?? "—",
      createdAt: data.createdAt?.toDate?.() ?? null,
    };
  });

  const fmt = (d: Date | null) =>
    d
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(d)
      : "—";

  const timeAgo = (d: Date | null) => {
    if (!d) return "—";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const statCards = [
    { label: "Total Devices", value: totalDevices, icon: Smartphone },
    { label: "Published / Draft", value: `${publishedCount} / ${draftCount}`, icon: FileCheck },
    { label: "Avg Score", value: avgScore, icon: BarChart3 },
    { label: "Total Brands", value: totalBrands, icon: Building2 },
  ];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live Firestore catalog health, analytics, and the audit trail.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-4 sm:p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-2xl font-semibold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ScoreDistributionChart data={scoreDistribution} />
        <BrandDistributionChart data={brandPieData} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <Link
                href={`/${locale}/admin/devices`}
                className="text-sm font-medium text-primary hover:underline"
              >
                View all →
              </Link>
            </div>
            <CardDescription>Last 5 devices updated</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {recentDevices.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.brand} · {timeAgo(d.updatedAt)}
                    </div>
                  </div>
                  <Badge
                    variant={
                      d.status === "available"
                        ? "success"
                        : d.status === "discontinued"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {d.status}
                  </Badge>
                </li>
              ))}
              {recentDevices.length === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  No devices yet.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent audit trail</CardTitle>
            <CardDescription>
              Immutable writes from the Admin SDK — appended, never edited.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {audit.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  No admin activity yet.
                </li>
              ) : (
                audit.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {a.action}
                        {a.resourceId ? ` · ${a.resourceId}` : ""}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-sm">{a.note ?? "—"}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-muted-foreground">{fmt(a.createdAt)}</div>
                      <div className="mt-1">
                        <Badge
                          variant={
                            a.severity === "critical"
                              ? "destructive"
                              : a.severity === "warning"
                                ? "warning"
                                : "secondary"
                          }
                        >
                          {a.severity}
                        </Badge>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Missing-phone scrape queue</CardTitle>
              <Link
                href={`/${locale}/admin/devices/new`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Auto-fill a device →
              </Link>
            </div>
            <CardDescription>
              Devices users searched for that have no catalog entry yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrapeQueue db={db} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Status Breakdown</CardTitle>
            </div>
            <CardDescription>Devices by catalog status</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {statuses.map((s) => {
                const pct = totalDevices > 0 ? Math.round((counts[s] / totalDevices) * 100) : 0;
                return (
                  <li key={s}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize text-muted-foreground">{s}</span>
                      <span className="font-medium">{counts[s]}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

async function ScrapeQueue({ db }: { db: ReturnType<typeof getAdminFirestore> }) {
  const fmt = (d: Date | null) =>
    d
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(d)
      : "—";

  const jobsSnapshot = await db
    .collection("scrape_jobs")
    .orderBy("createdAt", "asc")
    .limit(100)
    .get();

  const jobs = jobsSnapshot.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        query: data.query ?? "—",
        status: data.status ?? "queued",
        attempts: data.attempts ?? 0,
        createdAt: data.createdAt?.toDate?.() ?? null,
      };
    })
    .filter((j) => j.status === "queued" || j.status === "running")
    .slice(0, 25);

  if (jobs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Queue is empty — the pipeline is caught up.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {jobs.map((job) => (
        <li key={job.id} className="flex items-center justify-between gap-4 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{job.query}</div>
            <div className="text-xs text-muted-foreground">
              {fmt(job.createdAt)} · attempt {job.attempts}
            </div>
          </div>
          <Badge variant={job.status === "running" ? "warning" : "secondary"}>
            {job.status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
