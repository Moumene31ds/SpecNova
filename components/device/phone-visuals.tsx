"use client";

import { motion } from "framer-motion";

export function BatteryVisual({ mah }: {
  mah: number;
}) {
  const maxMah = 7000;
  const fillPercent = Math.min((mah / maxMah) * 100, 100);

  const getColor = () => {
    if (mah >= 6000) return { fill: "#22c55e", bg: "#22c55e20", label: "Massive" };
    if (mah >= 5000) return { fill: "#06b6d4", bg: "#06b6d420", label: "Large" };
    if (mah >= 4000) return { fill: "#eab308", bg: "#eab30820", label: "Standard" };
    return { fill: "#f97316", bg: "#f9731620", label: "Compact" };
  };

  const color = getColor();

  return (
    <div className="flex items-center gap-3">
      {/* Battery icon */}
      <div className="relative w-12 h-6 rounded-md border-2 border-current overflow-hidden" style={{ color: color.fill }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fillPercent}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{ backgroundColor: color.fill }}
        />
        {/* Battery tip */}
        <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-1 h-3 rounded-r-sm bg-current" />
      </div>
      <div>
        <span className="text-xs font-semibold">{mah.toLocaleString()} mAh</span>
        <span className="ml-1.5 text-[10px] text-muted-foreground">{color.label}</span>
      </div>
    </div>
  );
}

export function CameraVisual({ cameras }: {
  cameras: { megapixels: number; kind: string; aperture?: string | null }[];
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {cameras.map((cam, i) => {
        const size = cam.megapixels >= 200 ? "xl" : cam.megapixels >= 100 ? "lg" : cam.megapixels >= 50 ? "md" : "sm";
        const sizeClass = {
          xl: "h-8 w-8 text-xs",
          lg: "h-7 w-7 text-[10px]",
          md: "h-6 w-6 text-[9px]",
          sm: "h-5 w-5 text-[8px]",
        }[size];

        return (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 * i, type: "spring", stiffness: 300 }}
            className={`relative flex items-center justify-center rounded-full border border-border bg-card/80 ${sizeClass}`}
            title={`${cam.megapixels}MP ${cam.kind} ${cam.aperture ?? ""}`}
          >
            <span className="font-mono font-bold">{cam.megapixels}</span>
            <span className="absolute -bottom-3 text-[10px] text-muted-foreground whitespace-nowrap">
              {cam.kind === "wide" ? "Main" : cam.kind === "ultrawide" ? "Ultra" : cam.kind === "telephoto" || cam.kind === "periscope" ? "Tele" : cam.kind === "selfie" ? "Front" : cam.kind}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

export function ChipsetBadge({ chipset }: { chipset: string }) {
  const isSnapdragon = chipset.toLowerCase().includes("snapdragon");
  const isExynos = chipset.toLowerCase().includes("exynos");
  const isDimensity = chipset.toLowerCase().includes("dimensity");
  const isApple = chipset.toLowerCase().includes("a1") || chipset.toLowerCase().includes("m");

  const color = isSnapdragon ? "#dc2626" : isExynos ? "#2563eb" : isDimensity ? "#f59e0b" : isApple ? "#a3a3a3" : "#6b7280";

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${color}15`, color }}
    >
      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {chipset}
    </div>
  );
}
