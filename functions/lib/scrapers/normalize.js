"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NormalizedSpecSchema = void 0;
exports.normalizeScrape = normalizeScrape;
exports.composeContent = composeContent;
const genkit_1 = require("genkit");
const ai_1 = require("../ai");
/**
 * Zod schema for the normalized device spec sheet produced by Gemini.
 * Mirrors `lib/firebase/types.ts` on the Next.js side (server keeps
 * raw specs; the web layer re-shapes into the full `Device`).
 */
exports.NormalizedSpecSchema = genkit_1.z.object({
    brand: genkit_1.z.string(),
    name: genkit_1.z.string(),
    modelNumbers: genkit_1.z.array(genkit_1.z.string()).default([]),
    codename: genkit_1.z.string().nullish(),
    status: genkit_1.z.enum(["rumored", "announced", "upcoming", "available", "discontinued"]),
    announcedAt: genkit_1.z.string().nullish(),
    releaseAt: genkit_1.z.string().nullish(),
    body: genkit_1.z.object({
        widthMm: genkit_1.z.number().nullish(),
        heightMm: genkit_1.z.number().nullish(),
        depthMm: genkit_1.z.number().nullish(),
        weightG: genkit_1.z.number().nullish(),
        build: genkit_1.z.string().nullish(),
        materials: genkit_1.z.array(genkit_1.z.string()).default([]),
        protection: genkit_1.z.string().nullish(),
        ipRating: genkit_1.z.string().nullish(),
        colors: genkit_1.z.array(genkit_1.z.string()).default([]),
    }),
    display: genkit_1.z.object({
        type: genkit_1.z.string().nullish(),
        sizeIn: genkit_1.z.number().nullish(),
        resolution: genkit_1.z.string().nullish(),
        ppi: genkit_1.z.number().nullish(),
        refreshRateHz: genkit_1.z.number().nullish(),
        peakBrightnessNits: genkit_1.z.number().nullish(),
        hdrSupport: genkit_1.z.array(genkit_1.z.string()).default([]),
        pwmHz: genkit_1.z.number().nullish(),
        glass: genkit_1.z.string().nullish(),
    }),
    platform: genkit_1.z.object({
        os: genkit_1.z.string().nullish(),
        ui: genkit_1.z.string().nullish(),
        chipset: genkit_1.z.string().nullish(),
        cpu: genkit_1.z.string().nullish(),
        gpu: genkit_1.z.string().nullish(),
        antutuV10: genkit_1.z.number().nullish(),
        geekbench6: genkit_1.z
            .object({ single: genkit_1.z.number().nullish(), multi: genkit_1.z.number().nullish() })
            .nullish(),
    }),
    memory: genkit_1.z.object({
        ramOptions: genkit_1.z.array(genkit_1.z.number()).default([]),
        storageOptions: genkit_1.z.array(genkit_1.z.number()).default([]),
        storageType: genkit_1.z.string().nullish(),
        cardSlot: genkit_1.z.boolean().nullish(),
    }),
    cameras: genkit_1.z.object({
        rear: genkit_1.z.array(genkit_1.z.object({
            megapixels: genkit_1.z.number().nullish(),
            aperture: genkit_1.z.string().nullish(),
            opticalZoom: genkit_1.z.number().nullish(),
            stabilization: genkit_1.z.string().nullish(),
            video: genkit_1.z.array(genkit_1.z.string()).default([]),
        })).default([]),
        front: genkit_1.z.array(genkit_1.z.object({ megapixels: genkit_1.z.number().nullish(), aperture: genkit_1.z.string().nullish() })).default([]),
        features: genkit_1.z.array(genkit_1.z.string()).default([]),
    }),
    battery: genkit_1.z.object({
        capacityMah: genkit_1.z.number().nullish(),
        chargingWatts: genkit_1.z.number().nullish(),
        chargingTimeMin: genkit_1.z.number().nullish(),
        wirelessWatts: genkit_1.z.number().nullish(),
        reverseWirelessWatts: genkit_1.z.number().nullish(),
    }),
    connectivity: genkit_1.z.object({
        wifi: genkit_1.z.string().nullish(),
        bluetooth: genkit_1.z.string().nullish(),
        nfc: genkit_1.z.boolean().nullish(),
        usb: genkit_1.z.string().nullish(),
        bands: genkit_1.z.array(genkit_1.z.string()).default([]),
    }),
    extras: genkit_1.z.object({
        fingerprint: genkit_1.z.string().nullish(),
        esim: genkit_1.z.boolean().nullish(),
        stylus: genkit_1.z.boolean().nullish(),
        uwb: genkit_1.z.boolean().nullish(),
        satelliteSos: genkit_1.z.boolean().nullish(),
    }),
});
/**
 * Normalize messy, multi-source scraped text into a typed spec sheet with
 * Gemini 1.5 Pro. `input` is a concatenation of crawled source fragments
 * plus the original query so the model can disambiguate regional variants.
 */
async function normalizeScrape(input) {
    const prompt = `
You are iToPhone's spec normalizer. Convert the following raw device
information into a single, precise JSON spec sheet. Keep numbers as
numbers (strip units), use ISO dates (YYYY-MM-DD), and mark unknown
values as null. Never invent specs that are not present; prefer null.

RAW DATA:
"""${input.slice(0, 12_000)}"""
`;
    const response = await ai_1.ai.generate({
        prompt,
        output: { schema: exports.NormalizedSpecSchema },
    });
    const output = response.output;
    if (!output) {
        throw new Error("Gemini normalization returned no structured output.");
    }
    return output;
}
/** Build the canonical searchable text used for embeddings. */
function composeContent(spec) {
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
//# sourceMappingURL=normalize.js.map