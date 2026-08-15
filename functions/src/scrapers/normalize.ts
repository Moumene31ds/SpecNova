import { z } from "genkit";
import { ai } from "../ai";

/**
 * Zod schema for the normalized device spec sheet produced by Gemini.
 * Mirrors `lib/firebase/types.ts` on the Next.js side (server keeps
 * raw specs; the web layer re-shapes into the full `Device`).
 */
export const NormalizedSpecSchema = z.object({
  brand: z.string(),
  name: z.string(),
  modelNumbers: z.array(z.string()).default([]),
  codename: z.string().nullish(),
  status: z.enum(["rumored", "announced", "upcoming", "available", "discontinued"]),
  announcedAt: z.string().nullish(),
  releaseAt: z.string().nullish(),
  body: z.object({
    widthMm: z.number().nullish(),
    heightMm: z.number().nullish(),
    depthMm: z.number().nullish(),
    weightG: z.number().nullish(),
    build: z.string().nullish(),
    materials: z.array(z.string()).default([]),
    protection: z.string().nullish(),
    ipRating: z.string().nullish(),
    colors: z.array(z.string()).default([]),
  }),
  display: z.object({
    type: z.string().nullish(),
    sizeIn: z.number().nullish(),
    resolution: z.string().nullish(),
    ppi: z.number().nullish(),
    refreshRateHz: z.number().nullish(),
    peakBrightnessNits: z.number().nullish(),
    hdrSupport: z.array(z.string()).default([]),
    pwmHz: z.number().nullish(),
    glass: z.string().nullish(),
  }),
  platform: z.object({
    os: z.string().nullish(),
    ui: z.string().nullish(),
    chipset: z.string().nullish(),
    cpu: z.string().nullish(),
    gpu: z.string().nullish(),
    antutuV10: z.number().nullish(),
    geekbench6: z
      .object({ single: z.number().nullish(), multi: z.number().nullish() })
      .nullish(),
  }),
  memory: z.object({
    ramOptions: z.array(z.number()).default([]),
    storageOptions: z.array(z.number()).default([]),
    storageType: z.string().nullish(),
    cardSlot: z.boolean().nullish(),
  }),
  cameras: z.object({
    rear: z.array(
      z.object({
        megapixels: z.number().nullish(),
        aperture: z.string().nullish(),
        opticalZoom: z.number().nullish(),
        stabilization: z.string().nullish(),
        video: z.array(z.string()).default([]),
      }),
    ).default([]),
    front: z.array(
      z.object({ megapixels: z.number().nullish(), aperture: z.string().nullish() }),
    ).default([]),
    features: z.array(z.string()).default([]),
  }),
  battery: z.object({
    capacityMah: z.number().nullish(),
    chargingWatts: z.number().nullish(),
    chargingTimeMin: z.number().nullish(),
    wirelessWatts: z.number().nullish(),
    reverseWirelessWatts: z.number().nullish(),
  }),
  connectivity: z.object({
    wifi: z.string().nullish(),
    bluetooth: z.string().nullish(),
    nfc: z.boolean().nullish(),
    usb: z.string().nullish(),
    bands: z.array(z.string()).default([]),
  }),
  extras: z.object({
    fingerprint: z.string().nullish(),
    esim: z.boolean().nullish(),
    stylus: z.boolean().nullish(),
    uwb: z.boolean().nullish(),
    satelliteSos: z.boolean().nullish(),
  }),
});

export type NormalizedSpec = z.infer<typeof NormalizedSpecSchema>;

/**
 * Normalize messy, multi-source scraped text into a typed spec sheet with
 * Gemini 1.5 Pro. `input` is a concatenation of crawled source fragments
 * plus the original query so the model can disambiguate regional variants.
 */
export async function normalizeScrape(input: string): Promise<NormalizedSpec> {
  const prompt = `
You are SpecNova's spec normalizer. Convert the following raw device
information into a single, precise JSON spec sheet. Keep numbers as
numbers (strip units), use ISO dates (YYYY-MM-DD), and mark unknown
values as null. Never invent specs that are not present; prefer null.

RAW DATA:
"""${input.slice(0, 12_000)}"""
`;

  const response = await ai.generate({
    prompt,
    output: { schema: NormalizedSpecSchema },
  });

  const output = response.output;
  if (!output) {
    throw new Error("Gemini normalization returned no structured output.");
  }
  return output;
}

/** Build the canonical searchable text used for embeddings. */
export function composeContent(spec: NormalizedSpec): string {
  return [
    `${spec.brand} ${spec.name}`,
    ...spec.modelNumbers.map((m) => `model number ${m}`),
    `status ${spec.status}`,
    spec.display.type ? `${spec.display.type} display` : "",
    spec.display.sizeIn ? `${spec.display.sizeIn} inch display` : "",
    spec.display.refreshRateHz ? `${spec.display.refreshRateHz} hertz` : "",
    spec.platform.chipset ?? "",
    spec.platform.os ? `running ${spec.platform.os}` : "",
    spec.memory.ramOptions.length
      ? `ram options ${spec.memory.ramOptions.join(" or ")} gigabytes`
      : "",
    spec.memory.storageOptions.length
      ? `storage options ${spec.memory.storageOptions.join(" or ")} gigabytes`
      : "",
    spec.cameras.rear.length
      ? `${spec.cameras.rear.length} rear cameras`
      : "",
    spec.cameras.rear[0]?.megapixels
      ? `${spec.cameras.rear[0].megapixels} megapixel main camera`
      : "",
    spec.battery.capacityMah
      ? `${spec.battery.capacityMah} milliamp hour battery`
      : "",
    spec.battery.chargingWatts
      ? `${spec.battery.chargingWatts} watt charging`
      : "",
    spec.connectivity.bands.length
      ? `supports bands ${spec.connectivity.bands.join(", ")}`
      : "",
    spec.extras.esim ? "esim support" : "",
    spec.extras.satelliteSos ? "satellite sos" : "",
  ]
    .filter(Boolean)
    .join(". ")
    .toLowerCase();
}
