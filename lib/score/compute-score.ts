/**
 * Compute device scores from specs.
 * Rule-based algorithm — no AI needed. Used when saving AI-extracted devices.
 */
import type { iToPhoneScore } from "@/lib/firebase/types";

// Accept any specs-like object (AI draft or full DeviceSpecs)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpecsInput = Record<string, any>;

export function computeScore(
  specs: SpecsInput,
  priceUsd?: number,
): Omit<iToPhoneScore, "updatedAt"> {
  const hardware = computeHardwareScore(specs);
  const display = computeDisplayScore(specs);
  const camera = computeCameraScore(specs);
  const battery = computeBatteryScore(specs);
  const value = priceUsd ? computeValueScore(hardware, display, camera, battery, priceUsd) : 70;
  const sentiment = 75; // default neutral

  const total = Math.round(
    hardware * 0.3 + display * 0.15 + camera * 0.25 + battery * 0.15 + value * 0.15
  );

  return {
    total: clamp(total),
    hardware: clamp(hardware),
    display: clamp(display),
    camera: clamp(camera),
    battery: clamp(battery),
    value: clamp(value),
    sentiment: clamp(sentiment),
  };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// ---------------------------------------------------------------------------
// Hardware Score (chipset, RAM, storage, benchmarks)
// ---------------------------------------------------------------------------

function computeHardwareScore(s: SpecsInput): number {
  let score = 50;

  // Chipset tier
  const chipset = (s.platform.chipset || "").toLowerCase();
  if (/snapdragon 8[^\d]*e?l?ite|dimensity 9[^\d]*0?0|a1[789]|tensor g[45]/i.test(chipset)) score += 20;
  else if (/snapdragon 7|dimensity 8[^\d]*0|a1[56]|exynos 2[^\d]*[4-9]/i.test(chipset)) score += 12;
  else if (/snapdragon 6|dimensity 7[^\d]*0|helio g[89]/i.test(chipset)) score += 5;
  else if (/snapdragon 4|dimensity 6|helio p|unisoc/i.test(chipset)) score -= 5;

  // RAM
  const maxRam = Math.max(0, ...s.memory.ramOptions);
  if (maxRam >= 16) score += 10;
  else if (maxRam >= 12) score += 7;
  else if (maxRam >= 8) score += 4;
  else score -= 2;

  // Storage
  const maxStorage = Math.max(0, ...s.memory.storageOptions);
  if (maxStorage >= 512) score += 5;
  else if (maxStorage >= 256) score += 3;

  // Storage type
  if (s.memory.storageType?.includes("UFS 4")) score += 5;
  else if (s.memory.storageType?.includes("UFS 3")) score += 3;

  // AnTuTu
  if (s.platform.antutuV10) {
    if (s.platform.antutuV10 > 1500000) score += 8;
    else if (s.platform.antutuV10 > 1000000) score += 5;
    else if (s.platform.antutuV10 > 600000) score += 2;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Display Score (type, size, refresh, brightness, PPI)
// ---------------------------------------------------------------------------

function computeDisplayScore(s: SpecsInput): number {
  let score = 50;

  const type = (s.display.type || "").toLowerCase();
  if (/ltpo|amoled|oled/i.test(type)) score += 12;
  else if (/amoled|oled/i.test(type)) score += 8;
  else if (/lcd|ips/i.test(type)) score += 0;

  // Refresh rate
  if (s.display.refreshRateHz >= 144) score += 8;
  else if (s.display.refreshRateHz >= 120) score += 6;
  else if (s.display.refreshRateHz >= 90) score += 3;

  // Brightness
  if (s.display.peakBrightnessNits >= 3000) score += 8;
  else if (s.display.peakBrightnessNits >= 2000) score += 6;
  else if (s.display.peakBrightnessNits >= 1000) score += 3;

  // PPI
  if (s.display.ppi >= 500) score += 5;
  else if (s.display.ppi >= 400) score += 3;

  // Size (larger isn't always better — sweet spot 6.1-6.7)
  const size = s.display.sizeIn;
  if (size >= 6.0 && size <= 6.8) score += 3;

  // HDR
  if (s.display.hdrSupport?.length) score += 3;

  return score;
}

// ---------------------------------------------------------------------------
// Camera Score (MP, aperture, OIS, video, multiple lenses)
// ---------------------------------------------------------------------------

function computeCameraScore(s: SpecsInput): number {
  let score = 45;

  const rearCameras = s.cameras.rear || [];
  const frontCameras = s.cameras.front || [];

  // Main camera megapixels
  const mainMP = Math.max(0, ...rearCameras.map((c: Record<string, unknown>) => (c.megapixels as number) || 0));
  if (mainMP >= 200) score += 12;
  else if (mainMP >= 108) score += 10;
  else if (mainMP >= 50) score += 8;
  else if (mainMP >= 32) score += 5;
  else if (mainMP >= 12) score += 2;

  // Number of rear cameras
  if (rearCameras.length >= 4) score += 6;
  else if (rearCameras.length >= 3) score += 5;
  else if (rearCameras.length >= 2) score += 3;

  // Has ultrawide
  const hasUltrawide = rearCameras.some((c: Record<string, unknown>) => c.kind === "ultrawide");
  if (hasUltrawide) score += 4;

  // Has telephoto/periscope
  const hasTelephoto = rearCameras.some(
    (c: Record<string, unknown>) => c.kind === "telephoto" || c.kind === "periscope" || c.kind === "periscope telephoto"
  );
  if (hasTelephoto) score += 6;

  // OIS
  const hasOIS = rearCameras.some((c: Record<string, unknown>) => (c.stabilization as string)?.includes("OIS"));
  if (hasOIS) score += 4;

  // Video capabilities
  const has8K = s.cameras.videoCapabilities?.some((v: string) => v.includes("8K"));
  if (has8K) score += 3;
  const has4K = s.cameras.videoCapabilities?.some((v: string) => v.includes("4K"));
  if (has4K) score += 2;

  // Front camera
  const frontMP = Math.max(0, ...frontCameras.map((c: Record<string, unknown>) => (c.megapixels as number) || 0));
  if (frontMP >= 32) score += 3;
  else if (frontMP >= 12) score += 2;

  return score;
}

// ---------------------------------------------------------------------------
// Battery Score (capacity, charging speed, wireless)
// ---------------------------------------------------------------------------

function computeBatteryScore(s: SpecsInput): number {
  let score = 50;

  // Capacity
  const mah = s.battery.capacityMah || 0;
  if (mah >= 6000) score += 15;
  else if (mah >= 5000) score += 12;
  else if (mah >= 4500) score += 8;
  else if (mah >= 4000) score += 5;
  else score -= 3;

  // Wired charging
  const watts = s.battery.chargingWatts || 0;
  if (watts >= 100) score += 8;
  else if (watts >= 65) score += 6;
  else if (watts >= 30) score += 3;

  // Wireless charging
  if (s.battery.wirelessWatts > 0) score += 5;
  // Reverse wireless
  if (s.battery.reverseWirelessWatts > 0) score += 2;

  return score;
}

// ---------------------------------------------------------------------------
// Value Score (specs per dollar)
// ---------------------------------------------------------------------------

function computeValueScore(
  hardware: number,
  display: number,
  camera: number,
  battery: number,
  priceUsd: number,
): number {
  const avgSpecs = (hardware + display + camera + battery) / 4;
  // Higher specs + lower price = better value
  // Normalize: $200 phone with avg 80 specs = 100 value
  const ratio = avgSpecs / Math.max(priceUsd, 1);
  const raw = ratio * 2000; // scaling factor
  return Math.round(Math.max(20, Math.min(100, raw)));
}
