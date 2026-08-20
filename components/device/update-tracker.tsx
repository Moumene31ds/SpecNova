"use client";

import { motion } from "framer-motion";
import { Shield, Clock, Calendar, CheckCircle, Info } from "lucide-react";

interface UpdateTrackerProps {
  device: {
    brand: string;
    name: string;
    specs: {
      platform: {
        os: string;
        ui: string;
      };
      software?: {
        osUpdateYears: number | null;
        securityUpdateYears: number | null;
      };
      extras?: {
        updatePolicy: string | null;
      };
    };
    releaseAt: { seconds: number } | null;
    status: string;
  };
}

const YEARS_TO_SHOW = 7;

function getCurrentYearsSinceRelease(releaseAt: { seconds: number } | null): number {
  if (!releaseAt) return 0;
  const now = Date.now();
  const releaseMs = releaseAt.seconds * 1000;
  const diffMs = now - releaseMs;
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 365));
}

function getBrandTypicalPolicy(brand: string): string {
  const brandLower = brand.toLowerCase();
  if (brandLower === "apple") return "Apple typically provides 5-6 years of iOS updates";
  if (brandLower === "samsung" || brandLower === "google") return "Samsung/Google typically offer 7 years of OS & security updates";
  if (brandLower === "oneplus" || brandLower === "oppo" || brandLower === "realme") return "Oppo group typically provides 3-4 years of OS updates";
  if (brandLower === "xiaomi" || brandLower === "redmi" || brandLower === "poco") return "Xiaomi typically offers 3 years of OS and 4 years of security updates";
  if (brandLower === "sony") return "Sony typically provides 2 years of OS and 3 years of security updates";
  if (brandLower === "motorola") return "Motorola typically offers 1-2 years of OS updates";
  return "Update policies vary by manufacturer";
}

export default function UpdateTracker({ device }: UpdateTrackerProps) {
  const { specs, releaseAt, brand } = device;
  const osYears: number | null = specs.software?.osUpdateYears ?? null;
  const secYears: number | null = specs.software?.securityUpdateYears ?? null;
  const updatePolicy = specs.extras?.updatePolicy;
  const currentOs = specs.platform.os;

  const yearsSinceRelease = getCurrentYearsSinceRelease(releaseAt);
  const hasData = osYears !== null && osYears !== undefined;

  const displaySecYears = secYears ?? 0;
  const maxYears = Math.max(displaySecYears, YEARS_TO_SHOW);
  const currentPos = Math.min(yearsSinceRelease / maxYears, 1);

  const supportStatus = (() => {
    if (!releaseAt) return { label: "Unknown", color: "#6b7280" };
    if (secYears != null && yearsSinceRelease > secYears) return { label: "End of Support", color: "#ef4444" };
    if (osYears != null && secYears != null && yearsSinceRelease > osYears) return { label: "Security Only", color: "#f59e0b" };
    if (osYears != null && yearsSinceRelease < osYears) return { label: "Fully Supported", color: "#22c55e" };
    return { label: "Active", color: "#06b6d4" };
  })();

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-muted/50">
            <Shield className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Update Policy
            </h3>
            <p className="text-xs text-muted-foreground/70">{currentOs}</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
          <Info className="h-8 w-8 mb-2" />
          <p className="text-sm">Update data not available</p>
          <p className="text-xs mt-1">{getBrandTypicalPolicy(brand)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-muted/50">
            <Shield className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Update Policy
            </h3>
            <p className="text-xs text-muted-foreground/70">{currentOs}</p>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: `${supportStatus.color}20`, color: supportStatus.color }}
        >
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: supportStatus.color }} />
          {supportStatus.label}
        </div>
      </div>

      <div className="space-y-4">
        <TimelineRow
          icon={CheckCircle}
          label="OS Updates"
          years={osYears}
          maxYears={maxYears}
          currentPos={currentPos}
          color="#22c55e"
          secondaryColor="#22c55e40"
        />
        <TimelineRow
          icon={Shield}
          label="Security Patches"
          years={secYears}
          maxYears={maxYears}
          currentPos={currentPos}
          color="#3b82f6"
          secondaryColor="#3b82f640"
        />

        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>Released {releaseAt ? new Date(releaseAt.seconds * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "N/A"}</span>
          <span className="text-muted-foreground/50">·</span>
          <Clock className="h-3.5 w-3.5" />
          <span>{yearsSinceRelease.toFixed(1)} years ago</span>
        </div>
      </div>

      {updatePolicy && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="mt-5 p-3 rounded-xl bg-primary/10 border border-primary/20"
        >
          <p className="text-sm text-primary/90">{updatePolicy}</p>
        </motion.div>
      )}

      <div className="mt-4 pt-4 border-t border-border/40">
        <p className="text-xs text-muted-foreground/60">{getBrandTypicalPolicy(brand)}</p>
      </div>
    </div>
  );
}

function TimelineRow({
  icon: Icon,
  label,
  years,
  maxYears,
  currentPos,
  color,
  secondaryColor,
}: {
  icon: typeof Shield;
  label: string;
  years: number | null;
  maxYears: number;
  currentPos: number;
  color: string;
  secondaryColor: string;
}) {
  const fillPercent = years !== null ? Math.min((years / maxYears) * 100, 100) : 0;
  const markerPercent = Math.min(currentPos * 100, 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5" style={{ color }} />
          {label}
        </div>
        <span className="text-xs font-semibold tabular-nums" style={{ color }}>
          {years !== null ? `${years} years` : "—"}
        </span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: secondaryColor }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fillPercent}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        {currentPos > 0 && currentPos <= 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.3, type: "spring" }}
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-background"
            style={{
              left: `${markerPercent}%`,
              backgroundColor: color,
              boxShadow: `0 0 8px ${color}80`,
            }}
          />
        )}
      </div>
    </div>
  );
}
