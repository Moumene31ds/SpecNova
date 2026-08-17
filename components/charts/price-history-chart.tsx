"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Bell, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PriceAlertModal } from "@/components/price-alert/price-alert-modal";

interface PricePointShape {
  ts: number;
  priceUsd: number;
  source: string;
}

interface PriceHistoryChartProps {
  deviceId: string;
  deviceName: string;
  variantId: string;
  points: PricePointShape[];
  current: { priceUsd: number; currency: string } | null;
}

const trendMeta = {
  falling: { icon: TrendingDown, label: "Trending down", className: "text-success" },
  rising: { icon: TrendingUp, label: "Trending up", className: "text-danger" },
  stable: { icon: Minus, label: "Stable", className: "text-warning" },
} as const;

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const DAYS_MAP = { "1M": 30, "3M": 90, "6M": 180, ALL: Infinity } as const;

export function PriceHistoryChart({
  deviceId,
  deviceName,
  variantId,
  points,
  current,
}: PriceHistoryChartProps) {
  const [range, setRange] = React.useState<"1M" | "3M" | "6M" | "ALL">("6M");
  const [modalOpen, setModalOpen] = React.useState(false);

  const data = React.useMemo(() => {
    const cutoff = Date.now() - DAYS_MAP[range] * 86_400_000;
    return points
      .filter((p) => p.ts >= cutoff)
      .map((p) => ({ ...p, time: new Date(p.ts) }));
  }, [points, range]);

  const trend = React.useMemo(() => {
    if (data.length < 2) return "stable" as const;
    const first = data[0]!.priceUsd;
    const last = data[data.length - 1]!.priceUsd;
    const delta = (last - first) / first;
    return delta < -0.02 ? "falling" : delta > 0.02 ? "rising" : "stable";
  }, [data]);

  const meta = trendMeta[trend];

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <meta.icon className={`h-4 w-4 ${meta.className}`} />
          <h3 className="text-sm font-medium">Price history · {meta.label}</h3>
          <Badge variant="neon" className="ml-1 font-mono">
            {current ? formatCurrency(current.priceUsd, current.currency) : "—"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {(Object.keys(DAYS_MAP) as Array<keyof typeof DAYS_MAP>).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                range === r
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
          <button
            onClick={() => setModalOpen(true)}
            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground shadow-[0_0_16px_hsl(var(--glow-primary)/0.3)] transition-shadow hover:shadow-[0_0_24px_hsl(var(--glow-primary)/0.5)]"
          >
            <Bell className="h-3.5 w-3.5" /> Set alert
          </button>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--neon-cyan))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--neon-cyan))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={(t: Date) => monthFormatter.format(t)}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 11 }}
              minTickGap={24}
            />
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => `$${v}`}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 11 }}
              width={46}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(value) => formatCurrency(Number(value))}
              labelFormatter={(t: Date) => fullDateFormatter.format(t)}
            />
            <ReferenceLine
              y={current?.priceUsd}
              stroke="hsl(var(--glow-primary))"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="priceUsd"
              stroke="hsl(var(--neon-cyan))"
              strokeWidth={2}
              fill="url(#priceGradient)"
              activeDot={{ r: 4, strokeWidth: 0, fill: "hsl(var(--neon-cyan))" }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <PriceAlertModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        deviceId={deviceId}
        deviceName={deviceName}
        variantId={variantId}
        currentPrice={current?.priceUsd ?? 0}
      />
    </div>
  );
}
