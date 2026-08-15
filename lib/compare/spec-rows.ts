import type { Device } from "@/lib/firebase/types";

export interface SpecRow {
  key: string;
  group: string;
  label: string;
  kind: "string" | "number" | "boolean";
  /** One formatted value per device (same index order as input). */
  values: string[];
  /** Device indices that are strictly "better" on this row. */
  better: number[];
}

type Comparator = (device: Device) => number | null;
type Formatter = (device: Device) => string;

interface RowDefinition {
  key: string;
  group: string;
  label: string;
  compare: Comparator;
  format: Formatter;
  higherIsBetter?: boolean;
}

function buildRow(
  devices: Device[],
  def: RowDefinition,
): SpecRow {
  const better: number[] = [];
  if (def.higherIsBetter !== undefined) {
    const vals = devices.map(def.compare);
    const max = Math.max(...vals.filter((v): v is number => v !== null));
    devices.forEach((_, i) => {
      if (vals[i] !== null && vals[i] === max && vals.filter((v) => v === max).length === 1) {
        better.push(i);
      }
    });
  }
  return {
    key: def.key,
    group: def.group,
    label: def.label,
    kind: def.higherIsBetter !== undefined ? "number" : "string",
    values: devices.map((d) => def.format(d)),
    better,
  };
}

export function buildSpecRows(devices: Device[]): SpecRow[] {
  if (devices.length === 0) return [];

  const rows: RowDefinition[] = [
    // ----- Display -----
    { key: "display.size", group: "Display", label: "Size", higherIsBetter: true, compare: (d) => d.specs.display.sizeIn, format: (d) => `${d.specs.display.sizeIn}"` },
    { key: "display.type", group: "Display", label: "Panel", compare: () => 0, format: (d) => d.specs.display.type },
    { key: "display.resolution", group: "Display", label: "Resolution", higherIsBetter: true, compare: (d) => pxCount(d.specs.display.resolution), format: (d) => d.specs.display.resolution },
    { key: "display.ppi", group: "Display", label: "PPI", higherIsBetter: true, compare: (d) => d.specs.display.ppi, format: (d) => String(d.specs.display.ppi) },
    { key: "display.refresh", group: "Display", label: "Refresh rate", higherIsBetter: true, compare: (d) => d.specs.display.refreshRateHz, format: (d) => `${d.specs.display.refreshRateHz}Hz` },
    { key: "display.brightness", group: "Display", label: "Peak brightness", higherIsBetter: true, compare: (d) => d.specs.display.peakBrightnessNits, format: (d) => `${d.specs.display.peakBrightnessNits} nits` },
    { key: "display.pwm", group: "Display", label: "PWM (eye comfort)", compare: () => 0, format: (d) => (d.specs.display.pwmHz ? `${d.specs.display.pwmHz} Hz` : "DC dimming") },

    // ----- Platform -----
    { key: "platform.chipset", group: "Performance", label: "Chipset", compare: () => 0, format: (d) => d.specs.platform.chipset },
    { key: "platform.os", group: "Performance", label: "OS", compare: () => 0, format: (d) => d.specs.platform.os },
    { key: "platform.antutu", group: "Performance", label: "AnTuTu v10", higherIsBetter: true, compare: (d) => d.specs.platform.antutuV10, format: (d) => d.specs.platform.antutuV10 ? d.specs.platform.antutuV10.toLocaleString() : "—" },
    { key: "platform.geekbench", group: "Performance", label: "Geekbench 6 (S/M)", higherIsBetter: true, compare: (d) => d.specs.platform.geekbench6?.single ?? null, format: (d) => d.specs.platform.geekbench6 ? `${d.specs.platform.geekbench6.single}/${d.specs.platform.geekbench6.multi}` : "—" },
    { key: "memory.ram", group: "Performance", label: "RAM (max)", higherIsBetter: true, compare: (d) => Math.max(...d.specs.memory.ramOptions), format: (d) => `${Math.max(...d.specs.memory.ramOptions)} GB` },
    { key: "memory.storage", group: "Performance", label: "Storage (max)", higherIsBetter: true, compare: (d) => Math.max(...d.specs.memory.storageOptions), format: (d) => `${Math.max(...d.specs.memory.storageOptions)} GB` },
    { key: "memory.card", group: "Performance", label: "Expandable", compare: (d) => (d.specs.memory.cardSlot ? 1 : 0), format: (d) => (d.specs.memory.cardSlot ? "microSD" : "No") },

    // ----- Camera -----
    { key: "camera.main", group: "Camera", label: "Main sensor", higherIsBetter: true, compare: (d) => d.specs.cameras.rear[0]?.megapixels ?? 0, format: (d) => `${d.specs.cameras.rear[0]?.megapixels ?? "—"} MP` },
    { key: "camera.mainAperture", group: "Camera", label: "Main aperture", compare: () => 0, format: (d) => d.specs.cameras.rear[0]?.aperture ?? "—" },
    { key: "camera.zoom", group: "Camera", label: "Optical zoom", higherIsBetter: true, compare: (d) => Math.max(...d.specs.cameras.rear.map((c) => c.opticalZoom ?? 0)), format: (d) => `${Math.max(...d.specs.cameras.rear.map((c) => c.opticalZoom ?? 0))}x` },
    { key: "camera.count", group: "Camera", label: "Rear cameras", higherIsBetter: true, compare: (d) => d.specs.cameras.rear.length, format: (d) => String(d.specs.cameras.rear.length) },
    { key: "camera.video", group: "Camera", label: "Best video", compare: () => 0, format: (d) => d.specs.cameras.videoCapabilities[0] ?? "—" },

    // ----- Battery -----
    { key: "battery.capacity", group: "Battery", label: "Capacity", higherIsBetter: true, compare: (d) => d.specs.battery.capacityMah, format: (d) => `${d.specs.battery.capacityMah} mAh` },
    { key: "battery.charge", group: "Battery", label: "Wired charging", higherIsBetter: true, compare: (d) => d.specs.battery.chargingWatts, format: (d) => `${d.specs.battery.chargingWatts}W` },
    { key: "battery.wireless", group: "Battery", label: "Wireless", higherIsBetter: true, compare: (d) => d.specs.battery.wirelessWatts, format: (d) => `${d.specs.battery.wirelessWatts}W` },
    { key: "battery.endurance", group: "Battery", label: "Endurance", higherIsBetter: true, compare: (d) => d.specs.battery.enduranceHours, format: (d) => d.specs.battery.enduranceHours ? `${d.specs.battery.enduranceHours}h` : "—" },

    // ----- Build -----
    { key: "body.weight", group: "Build", label: "Weight", higherIsBetter: false, compare: (d) => d.specs.body.weightG, format: (d) => `${d.specs.body.weightG}g` },
    { key: "body.ip", group: "Build", label: "Water resistance", compare: () => 0, format: (d) => d.specs.body.ipRating ?? "None" },
    { key: "body.protection", group: "Build", label: "Glass", compare: () => 0, format: (d) => d.specs.body.protection ?? "—" },

    // ----- Connectivity -----
    { key: "conn.wifi", group: "Connectivity", label: "Wi-Fi", compare: () => 0, format: (d) => d.specs.connectivity.wifi },
    { key: "conn.nfc", group: "Connectivity", label: "NFC", compare: (d) => (d.specs.connectivity.nfc ? 1 : 0), format: (d) => (d.specs.connectivity.nfc ? "Yes" : "No") },
    { key: "conn.uwb", group: "Connectivity", label: "UWB", compare: (d) => (d.specs.extras.uwb ? 1 : 0), format: (d) => (d.specs.extras.uwb ? "Yes" : "No") },
    { key: "conn.esim", group: "Connectivity", label: "eSIM", compare: (d) => (d.specs.extras.esim ? 1 : 0), format: (d) => (d.specs.extras.esim ? "Yes" : "No") },
    { key: "conn.satellite", group: "Connectivity", label: "Satellite SOS", compare: (d) => (d.specs.extras.satelliteSos ? 1 : 0), format: (d) => (d.specs.extras.satelliteSos ? "Yes" : "No") },
  ];

  return rows.map((def) => buildRow(devices, def));
}

function pxCount(resolution: string): number {
  const match = resolution.match(/(\d+)\s*[x×]\s*(\d+)/);
  return match ? Number(match[1]) * Number(match[2]) : 0;
}

export const SPEC_GROUPS = ["Display", "Performance", "Camera", "Battery", "Build", "Connectivity"];

/** FPS simulation input for the gaming visualizer. */
export function gamingProfile(device: Device) {
  const antutu = device.specs.platform.antutuV10 ?? 1_500_000;
  const thermal = 0.75 + (device.specs.body.weightG > 210 ? 0.12 : 0.05); // heavier = worse heat management
  const fpsPeak = Math.round(60 + ((antutu - 1_500_000) / 1_500_000) * 55);
  return { fpsPeak, thermal, chipset: device.specs.platform.chipset };
}
