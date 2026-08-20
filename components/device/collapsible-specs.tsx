"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Cpu, Battery, Camera, Disc, Gauge, Smartphone, Zap } from "lucide-react";
import type { Device } from "@/lib/firebase/types";

type Specs = Device["specs"];

interface SpecGroup {
  label: string;
  icon: typeof Cpu;
  rows: [string, string][];
  alwaysOpen?: boolean;
}

export function CollapsibleSpecGrid({ specs, accent }: { specs: Specs; accent: string }) {
  const s = specs;
  const groups: SpecGroup[] = [
    { label: "Body", icon: Smartphone, rows: [
      ["Dimensions", `${s.body.dimensions.heightMm} × ${s.body.dimensions.widthMm} × ${s.body.dimensions.depthMm} mm`],
      ["Weight", `${s.body.weightG} g`],
      ["Build", s.body.build],
      ["Protection", s.body.protection ?? "—"],
      ["Water resistance", s.body.ipRating ?? "None"],
      ["Colors", s.body.colors.join(", ")],
    ]},
    { label: "Display", icon: Zap, rows: [
      ["Type", `${s.display.type}, ${s.display.colorDepth}`],
      ["Size", `${s.display.sizeIn}" (${s.display.resolution})`],
      ["Refresh", `${s.display.refreshRateHz}Hz`],
      ["Peak brightness", `${s.display.peakBrightnessNits} nits`],
      ["PPI", String(s.display.ppi)],
      ["Glass", s.display.glass ?? "—"],
    ]},
    { label: "Performance", icon: Gauge, rows: [
      ["Chipset", s.platform.chipset],
      ["CPU", s.platform.cpu],
      ["GPU", s.platform.gpu],
      ["RAM", s.memory.ramOptions.join(" / ") + " GB"],
      ["Storage", s.memory.storageOptions.join(" / ") + " GB " + s.memory.storageType],
      ["AnTuTu v10", s.platform.antutuV10 ? s.platform.antutuV10.toLocaleString() : "—"],
    ]},
    { label: "Camera", icon: Camera, rows: [
      ["Main", `${s.cameras.rear[0]?.megapixels} MP ${s.cameras.rear[0]?.aperture}`],
      ["Ultrawide", `${s.cameras.rear[1]?.megapixels ?? "—"} MP`],
      ["Telephoto", `${s.cameras.rear[2]?.megapixels ?? "—"} MP ${s.cameras.rear[2]?.opticalZoom ? `(${s.cameras.rear[2].opticalZoom}x)` : ""}`],
      ["Front", `${s.cameras.front[0]?.megapixels} MP`],
      ["Features", s.cameras.features.slice(0, 4).join(" · ")],
    ]},
    { label: "Battery", icon: Battery, rows: [
      ["Capacity", `${s.battery.capacityMah} mAh`],
      ["Wired", `${s.battery.chargingWatts}W`],
      ["Wireless", `${s.battery.wirelessWatts}W`],
      ["Endurance", s.battery.enduranceHours ? `${s.battery.enduranceHours} h` : "—"],
      ["Charging", s.battery.chargingTimeMin ? `${s.battery.chargingTimeMin} min (0-100%)` : "—"],
    ]},
    { label: "Connectivity", icon: Disc, rows: [
      ["Wi-Fi", s.connectivity.wifi],
      ["Bluetooth", s.connectivity.bluetooth],
      ["NFC", s.connectivity.nfc ? "Yes" : "No"],
      ["eSIM", s.extras.esim ? "Yes" : "No"],
      ["Satellite SOS", s.extras.satelliteSos ? "Yes" : "No"],
      ["5G bands", s.connectivity.bands.filter((b) => b.startsWith("n")).join(" ")],
    ]},
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {groups.map(({ label, icon: Icon, rows }, idx) => (
        <CollapsibleSpecGroup
          key={label}
          label={label}
          Icon={Icon}
          rows={rows}
          accent={accent}
          defaultOpen={idx < 2}
        />
      ))}
    </div>
  );
}

function CollapsibleSpecGroup({
  label,
  Icon,
  rows,
  accent,
  defaultOpen = false,
}: {
  label: string;
  Icon: typeof Cpu;
  rows: [string, string][];
  accent: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-border bg-card/40 backdrop-blur overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-start hover:bg-white/5 transition-colors"
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          <Icon className="h-4 w-4" style={{ color: accent }} /> {label}
        </h3>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <dl className="px-4 pb-4 space-y-2">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-2 text-sm last:border-0 last:pb-0">
                  <dt className="shrink-0 text-muted-foreground">{k}</dt>
                  <dd className="text-end font-medium tabular-nums min-w-0 truncate">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function QuickSpecsBar({ specs, brand, name, accent }: {
  specs: Specs;
  brand: string;
  name: string;
  accent: string;
}) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }}
      className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 sm:gap-4 rounded-2xl border border-border bg-background/90 backdrop-blur-xl px-4 py-2.5 shadow-2xl max-w-[calc(100vw-2rem)] overflow-x-auto scrollbar-hide"
    >
      <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap hidden sm:inline">{brand} {name}</span>
      <div className="h-4 w-px bg-border hidden sm:block" />
      <QuickSpec icon={Cpu} label="Chip" value={specs.platform.chipset.replace(/Snapdragon |Dimensity |Exynos /, "").split(" ")[0]} accent={accent} />
      <QuickSpec icon={Camera} label="Camera" value={`${specs.cameras.rear[0]?.megapixels ?? "—"}MP`} accent={accent} />
      <QuickSpec icon={Battery} label="Battery" value={`${specs.battery.capacityMah}`} accent={accent} />
      <QuickSpec icon={Zap} label="Display" value={`${specs.display.sizeIn}"`} accent={accent} />
      <QuickSpec icon={Gauge} label="RAM" value={`${specs.memory.ramOptions[0] ?? "—"}GB`} accent={accent} />
    </motion.div>
  );
}

function QuickSpec({ icon: Icon, label, value, accent }: {
  icon: typeof Cpu;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );
}
