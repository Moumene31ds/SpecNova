"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { deleteDevice } from "@/actions/admin/updateDevice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DeviceRow {
  id: string;
  slug: string;
  brand: string;
  name: string;
  status: string;
  score: number;
  updatedAt: string | null;
}

const STATUS_PIPELINE = ["rumored", "announced", "upcoming", "available", "discontinued"] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "outline"> = {
  rumored: "secondary",
  announced: "warning",
  upcoming: "outline",
  available: "success",
  discontinued: "default",
};

const PAGE_SIZE = 25;

export function DeviceListClient({
  devices,
  locale,
}: {
  devices: DeviceRow[];
  locale: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);

  const brands = useMemo(() => {
    const set = new Set(devices.map((d) => d.brand).filter(Boolean));
    return Array.from(set).sort();
  }, [devices]);

  const filtered = useMemo(() => {
    let result = devices;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.brand.toLowerCase().includes(q) ||
          d.slug.toLowerCase().includes(q),
      );
    }
    if (brandFilter !== "all") {
      result = result.filter((d) => d.brand === brandFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((d) => d.status === statusFilter);
    }
    return result;
  }, [devices, search, brandFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function onDelete(slug: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(slug);
    const res = await deleteDevice({ slug });
    setDeleting(null);
    if (res.ok) {
      router.refresh();
    } else {
      alert(res.error.message);
    }
  }

  const selectClass =
    "h-9 rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Devices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} device{filtered.length !== 1 ? "s" : ""}
            {(search || brandFilter !== "all" || statusFilter !== "all") ? " (filtered)" : ""}
          </p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/admin/devices/new`}>
            <Plus className="size-4" />
            New Device
          </Link>
        </Button>
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name, brand, or slug…"
            className="h-9 pl-9"
          />
        </div>
        <select
          value={brandFilter}
          onChange={(e) => { setBrandFilter(e.target.value); setPage(0); }}
          className={selectClass}
        >
          <option value="all">All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className={selectClass}
        >
          <option value="all">All statuses</option>
          {STATUS_PIPELINE.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(search || brandFilter !== "all" || statusFilter !== "all") ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(""); setBrandFilter("all"); setStatusFilter("all"); setPage(0); }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {/* Table */}
      {paged.length === 0 ? (
        <div className="rounded-xl border border-border p-12 text-center text-sm text-muted-foreground">
          No devices match your filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Brand</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Score</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/admin/devices/${d.slug}`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {d.name}
                    </Link>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">{d.slug}</div>
                  </td>
                  <td className="px-4 py-3">{d.brand}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[d.status] ?? "secondary"}>
                      {d.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{d.score || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/${locale}/admin/devices/${d.slug}`}>
                          <Pencil className="size-4" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <a href={`/phone/${d.slug}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" />
                          <span className="sr-only">View</span>
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={deleting === d.slug}
                        onClick={() => onDelete(d.slug, d.name)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages} ({filtered.length} total)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
