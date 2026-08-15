"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runIngestionPipeline = runIngestionPipeline;
const firestore_1 = require("firebase-admin/firestore");
const crawlee_scraper_1 = require("./scrapers/crawlee-scraper");
const normalize_1 = require("./scrapers/normalize");
const ai_1 = require("./ai");
const config_1 = require("./config");
/**
 * Full ingestion pipeline for the Zero-Missing engine:
 *
 *   scrape (Playwright) → normalize (Gemini 1.5 Pro) → embed (text-004)
 *   → write `devices/{slug}` with a native vector field.
 *
 * Re-runs upsert idempotently (same slug = same doc). Latency target
 * from queue to searchable: < 3 seconds for well-known devices.
 */
async function runIngestionPipeline(query) {
    const startedAt = Date.now();
    const raw = await new crawlee_scraper_1.SpecScraper().scrape(query);
    const spec = await (0, normalize_1.normalizeScrape)(raw);
    const content = (0, normalize_1.composeContent)(spec);
    const embedding = await (0, ai_1.embedDeviceContent)(content);
    const brand = spec.brand || inferBrand(query);
    const name = spec.name || stripBrand(query, brand);
    const slug = slugify(`${brand} ${name}`);
    const deviceRef = config_1.db.collection(config_1.COLLECTIONS.devices).doc(slug);
    await deviceRef.set({
        id: slug,
        slug,
        brand,
        name,
        modelNumbers: spec.modelNumbers,
        codename: spec.codename ?? null,
        status: spec.status ?? "available",
        announcedAt: spec.announcedAt ? firestore_1.Timestamp.fromDate(new Date(spec.announcedAt)) : null,
        releaseAt: spec.releaseAt ? firestore_1.Timestamp.fromDate(new Date(spec.releaseAt)) : null,
        brandColor: brandColor(spec.brand),
        specs: {
            body: {
                dimensions: {
                    widthMm: spec.body.widthMm,
                    heightMm: spec.body.heightMm,
                    depthMm: spec.body.depthMm,
                },
                weightG: spec.body.weightG,
                build: spec.body.build,
                materials: spec.body.materials,
                protection: spec.body.protection,
                ipRating: spec.body.ipRating,
                colors: spec.body.colors,
            },
            display: {
                type: spec.display.type,
                sizeIn: spec.display.sizeIn,
                resolution: spec.display.resolution,
                ppi: spec.display.ppi,
                refreshRateHz: spec.display.refreshRateHz,
                peakBrightnessNits: spec.display.peakBrightnessNits,
                hdrSupport: spec.display.hdrSupport,
                pwmHz: spec.display.pwmHz,
                glass: spec.display.glass,
                colorDepth: "8-bit",
            },
            platform: {
                os: spec.platform.os,
                ui: spec.platform.ui,
                chipset: spec.platform.chipset,
                cpu: spec.platform.cpu,
                gpu: spec.platform.gpu,
                antutuV10: spec.platform.antutuV10,
                geekbench6: spec.platform.geekbench6,
            },
            memory: {
                ramOptions: spec.memory.ramOptions,
                storageOptions: spec.memory.storageOptions,
                storageType: spec.memory.storageType,
                cardSlot: spec.memory.cardSlot,
            },
            cameras: {
                rear: spec.cameras.rear.map((c, i) => ({
                    id: `rear-${i}`,
                    position: "rear",
                    kind: i === 0 ? "wide" : i === 1 ? "ultrawide" : "telephoto",
                    megapixels: c.megapixels,
                    aperture: c.aperture,
                    sensorSize: null,
                    pixelSize: null,
                    fieldOfViewDeg: null,
                    opticalZoom: c.opticalZoom,
                    digitalZoom: null,
                    stabilization: c.stabilization,
                    video: c.video,
                })),
                front: spec.cameras.front.map((c, i) => ({
                    id: `front-${i}`,
                    position: "front",
                    kind: "selfie",
                    megapixels: c.megapixels,
                    aperture: c.aperture,
                    sensorSize: null,
                    pixelSize: null,
                    fieldOfViewDeg: null,
                    opticalZoom: null,
                    digitalZoom: null,
                    stabilization: "EIS",
                    video: [],
                })),
                features: spec.cameras.features,
                videoCapabilities: [],
            },
            audio: { speakers: [], headphoneJack: null, codecs: [], microphone: null },
            battery: {
                capacityMah: spec.battery.capacityMah,
                type: "Li-Ion",
                chargingWatts: spec.battery.chargingWatts,
                chargingTimeMin: spec.battery.chargingTimeMin,
                wirelessWatts: spec.battery.wirelessWatts,
                reverseWirelessWatts: spec.battery.reverseWirelessWatts,
                enduranceHours: null,
            },
            connectivity: {
                wifi: spec.connectivity.wifi,
                bluetooth: null,
                nfc: spec.connectivity.nfc,
                usb: spec.connectivity.usb,
                irBlaster: false,
                gnss: [],
                bands: spec.connectivity.bands,
            },
            sensors: [],
            extras: {
                fingerprint: spec.extras.fingerprint,
                faceUnlock: false,
                stylus: spec.extras.stylus,
                esim: spec.extras.esim,
                uwb: spec.extras.uwb,
                satelliteSos: spec.extras.satelliteSos,
            },
        },
        media: { heroImage: null, gallery: [], renderImages: [], modelUrl: null, cameraSamples: {} },
        content,
        embedding: firestore_1.FieldValue.vector(embedding),
        score: {
            total: 50,
            hardware: 50,
            display: 50,
            camera: 50,
            battery: 50,
            value: 50,
            sentiment: 50,
            updatedAt: firestore_1.Timestamp.now(),
        },
        priceSummary: {
            currency: "USD",
            latest: 0,
            msrp: 0,
            min: 0,
            max: 0,
            average: 0,
            dropPercent: 0,
            trend: "stable",
            sources: [],
            updatedAt: firestore_1.Timestamp.now(),
        },
        bandGroupIds: spec.connectivity.bands,
        sources: [],
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    const elapsed = Date.now() - startedAt;
    console.info(`[pipeline] ingested "${brand} ${name}" (${slug}) in ${elapsed}ms`);
    return { deviceId: slug, brand, name, status: spec.status ?? "available" };
}
function slugify(input) {
    return input
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
const BRAND_GLOWS = {
    samsung: "#8A2BE2",
    apple: "#A3A3A3",
    google: "#4285F4",
    xiaomi: "#FF6900",
    oppo: "#00A64E",
    oneplus: "#EB0028",
    vivo: "#415FFF",
    realme: "#FFD900",
    sony: "#003791",
    motorola: "#5C2D91",
    nothing: "#F1F1F1",
    honor: "#00C0FF",
    huawei: "#FF0000",
    asus: "#00BDFF",
};
function brandColor(brand) {
    return BRAND_GLOWS[brand.toLowerCase()] ?? "#8A2BE2";
}
function inferBrand(query) {
    const known = Object.keys(BRAND_GLOWS).sort((a, b) => b.length - a.length);
    const lower = query.toLowerCase();
    const hit = known.find((b) => lower.includes(b));
    return hit ? hit[0].toUpperCase() + hit.slice(1) : "Unknown";
}
function stripBrand(query, brand) {
    return query
        .replace(new RegExp(brand, "i"), "")
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .join(" ");
}
//# sourceMappingURL=pipeline.js.map