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

/**
 * Admin dashboard — catalog health, the missing-device scrape queue, and a
 * live slice of the immutable audit trail.
 */
export default async function AdminDashboardPage() {
  const tokens = await getServerTokens();
  const claims = tokens?.decodedToken;
  const roles = parseRoles(claims as unknown as Record<string, unknown> | undefined);
  if (!roles.isAdmin && !roles.isEditor) redirect("/");

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

  const [countSnapshots, jobsSnapshot, auditSnapshot] = await Promise.all([
    Promise.all(statuses.map((s) => db.collection("devices").where("status", "==", s).count().get())),
    db
      .collection("scrape_jobs")
      .where("status", "in", ["queued", "running"])
      .orderBy("createdAt", "asc")
      .limit(25)
      .get(),
    db
      .collection("audit_logs")
      .orderBy("createdAt", "desc")
      .limit(12)
      .get(),
  ]);

  const counts = Object.fromEntries(statuses.map((s, i) => [s, countSnapshots[i]!.data().count]));

  const jobs = jobsSnapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      query: data.query ?? "—",
      status: data.status ?? "queued",
      attempts: data.attempts ?? 0,
      createdAt: data.createdAt?.toDate?.() ?? null,
    };
  });

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

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live Firestore catalog health, missing-device queue, and the audit trail.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statuses.map((s) => (
          <Card key={s}>
            <CardHeader className="pb-2">
              <CardDescription className="capitalize">{s}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-semibold">{counts[s]}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Missing-phone scrape queue</CardTitle>
              <Link
                href="/admin/devices/new"
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
            {jobs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Queue is empty — the pipeline is caught up.
              </p>
            ) : (
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
            )}
          </CardContent>
        </Card>

        <Card>
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
    </div>
  );
}
