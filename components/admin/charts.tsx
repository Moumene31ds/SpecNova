"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface ScoreData {
  range: string;
  count: number;
}

interface BrandData {
  name: string;
  count: number;
}

const PIE_COLORS = [
  "hsl(262, 100%, 54%)",
  "hsl(187, 100%, 34%)",
  "hsl(330, 95%, 49%)",
  "hsl(35, 95%, 40%)",
  "hsl(150, 90%, 37%)",
  "hsl(220, 60%, 50%)",
  "hsl(30, 80%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 0%, 50%)",
];

export function ScoreDistributionChart({ data }: { data: ScoreData[] }) {
  const t = useTranslations("admin");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("scoreDistribution")}</CardTitle>
        <CardDescription>{t("scoreRanges")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="range" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.75rem",
                color: "hsl(var(--foreground))",
              }}
            />
            <Bar
              dataKey="count"
              fill="hsl(var(--primary))"
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function BrandDistributionChart({ data }: { data: BrandData[] }) {
  const t = useTranslations("admin");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("brandDistribution")}</CardTitle>
        <CardDescription>{t("devicesPerBrand")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="count"
              nameKey="name"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.75rem",
                color: "hsl(var(--foreground))",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
