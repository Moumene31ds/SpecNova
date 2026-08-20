"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Mail, MonitorSmartphone, Trash2, Pause, BellOff, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PriceAlert } from "@/lib/firebase/types";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PriceAlertListProps {
  alerts: PriceAlert[];
  labels: {
    totalAlerts: string;
    activeCount: string;
    targetPrice: string;
    threshold: string;
    channels: string;
    push: string;
    email: string;
    status: string;
    active: string;
    inactive: string;
    createdAt: string;
    deactivate: string;
    delete: string;
    deleteConfirmTitle: string;
    deleteConfirmBody: string;
    emptyTitle: string;
    emptyBody: string;
    browseDevices: string;
  };
}

export function PriceAlertList({ alerts: initial, labels }: PriceAlertListProps) {
  const [alerts, setAlerts] = React.useState(initial);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<PriceAlert | null>(null);

  const activeCount = alerts.length;

  const handleDeactivate = async (alert: PriceAlert) => {
    setPendingId(alert.id);
    try {
      const { unsubscribePriceAlert } = await import("@/actions/price-alerts");
      await unsubscribePriceAlert(alert.id);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    } catch {
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setPendingId(deleteTarget.id);
    try {
      const { deletePriceAlert } = await import("@/actions/price-alerts");
      await deletePriceAlert(deleteTarget.id);
      setAlerts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    } catch {
    } finally {
      setPendingId(null);
      setDeleteTarget(null);
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/40 py-20 backdrop-blur">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-secondary/40">
          <BellOff className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="mt-5 font-display text-xl font-semibold">{labels.emptyTitle}</h3>
        <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
          {labels.emptyBody}
        </p>
        <Link
          href="/search"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[0_0_24px_hsl(var(--glow-primary)/0.35)] transition-shadow hover:shadow-[0_0_36px_hsl(var(--glow-primary)/0.55)]"
        >
          <Search className="h-4 w-4" /> {labels.browseDevices}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        {[
          { label: labels.totalAlerts, value: alerts.length },
          { label: labels.activeCount, value: activeCount },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card/40 px-5 py-4 backdrop-blur"
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{stat.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Alert cards */}
      <div className="space-y-3">
        {alerts.map((alert) => (
          <Card key={alert.id} className="relative overflow-hidden transition-colors hover:border-border/80">
            <div
              aria-hidden
              className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full opacity-15 blur-3xl bg-primary"
            />
            <CardContent className="relative z-10 p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/50">
                      <Bell className="h-4 w-4 text-neon-cyan" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/phone/${alert.deviceId}`}
                        className="truncate font-display text-base font-semibold transition-colors hover:text-primary"
                      >
                        {alert.deviceId}
                      </Link>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    <span>
                      {labels.targetPrice}:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {formatCurrency(alert.targetPriceUsd)}
                      </span>
                    </span>
                    <span>
                      {labels.threshold}:{" "}
                      <span className="font-mono font-medium text-neon-cyan">
                        {alert.thresholdPercent}%
                      </span>
                    </span>
                    <span>
                      {labels.createdAt}:{" "}
                      <span className="text-foreground">{formatDate(alert.createdAt)}</span>
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{labels.channels}:</span>
                    {alert.channels.includes("push") && (
                      <Badge variant="neon" className="gap-1">
                        <MonitorSmartphone className="h-3 w-3" /> {labels.push}
                      </Badge>
                    )}
                    {alert.channels.includes("email") && (
                      <Badge variant="neon" className="gap-1">
                        <Mail className="h-3 w-3" /> {labels.email}
                      </Badge>
                    )}
                    <Badge variant="success" className="ms-1">{labels.active}</Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingId === alert.id}
                    onClick={() => handleDeactivate(alert)}
                  >
                    <Pause className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{labels.deactivate}</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={pendingId === alert.id}
                    onClick={() => setDeleteTarget(alert)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{labels.delete}</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{labels.deleteConfirmTitle}</DialogTitle>
            <DialogDescription>{labels.deleteConfirmBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pendingId === deleteTarget?.id}
              onClick={handleDelete}
            >
              {labels.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
