import type { Device } from "@/lib/firebase/types";

/**
 * Dev / fallback catalog — lets the full UI render without a Firestore
 * connection. In production the app layer swaps this for the live index
 * behind `lib/search/vector-search.ts`.
 */

const ts = (seconds: number) => ({ seconds } as unknown as Device["createdAt"]);

function makeDevice(partial: Partial<Device> & Pick<Device, "id" | "slug" | "brand" | "name">): Device {
  const now = ts(Math.floor(Date.now() / 1000));
  return {
    id: partial.id,
    slug: partial.slug,
    brand: partial.brand,
    name: partial.name,
    brandColor: partial.brandColor ?? "#8A2BE2",
    modelNumbers: partial.modelNumbers ?? [],
    codename: partial.codename ?? null,
    status: partial.status ?? "available",
    announcedAt: partial.announcedAt ?? null,
    releaseAt: partial.releaseAt ?? null,
    specs: partial.specs ?? baseSpecs(),
    media: partial.media ?? { heroImage: null, gallery: [], renderImages: [], modelUrl: null, cameraSamples: {} },
    content: partial.content ?? "",
    embedding: [],
    score: partial.score ?? {
      total: 88, hardware: 88, display: 90, camera: 88, battery: 84, value: 86, sentiment: 82, updatedAt: now,
    },
    priceSummary: partial.priceSummary ?? {
      currency: "USD", latest: 1199, msrp: 1299, min: 1099, max: 1399, average: 1215, dropPercent: 8, trend: "falling", sources: ["Amazon US"], updatedAt: now,
    },
    bandGroupIds: partial.bandGroupIds ?? ["n78", "n77", "n41", "n5", "n28", "B3", "B7", "B12", "B13", "B20", "B28", "B66"],
    sources: partial.sources ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

function baseSpecs(): Device["specs"] {
  return {
    body: {
      dimensions: { widthMm: 76, heightMm: 161, depthMm: 8.6 },
      weightG: 220,
      build: "Titanium frame, glass back",
      materials: ["Titanium", "Gorilla Glass Victus 2"],
      protection: "Corning Gorilla Glass Victus 2",
      ipRating: "IP68",
      colors: ["Titanium Black", "Titanium Gray", "Titanium Blue"],
    },
    display: {
      type: "LTPO AMOLED",
      sizeIn: 6.8,
      resolution: "3120×1440",
      ppi: 510,
      refreshRateHz: 120,
      peakBrightnessNits: 3000,
      hdrSupport: ["HDR10+", "HDR Vivid"],
      pwmHz: 240,
      glass: "Gorilla Glass Victus 2",
      colorDepth: "10-bit",
    },
    platform: {
      os: "Android 16",
      ui: "One UI 8",
      chipset: "Snapdragon 8 Elite",
      cpu: "Octa-core 4.47 GHz",
      gpu: "Adreno 830",
      antutuV10: 2950000,
      geekbench6: { single: 3400, multi: 10800 },
    },
    memory: {
      ramOptions: [12, 16],
      storageOptions: [256, 512, 1024],
      storageType: "UFS 4.0",
      cardSlot: false,
    },
    cameras: {
      rear: [
        { id: "main", position: "rear", kind: "wide", megapixels: 200, aperture: "f/1.7", sensorSize: "1/1.3\"", pixelSize: "0.8µm", fieldOfViewDeg: 85, opticalZoom: 1, digitalZoom: 100, stabilization: "OIS", video: ["8K@30", "4K@120"] },
        { id: "ultra", position: "rear", kind: "ultrawide", megapixels: 50, aperture: "f/2.2", sensorSize: "1/2.6\"", pixelSize: "0.7µm", fieldOfViewDeg: 120, opticalZoom: null, digitalZoom: 1, stabilization: "EIS", video: ["4K@60"] },
        { id: "tele", position: "rear", kind: "periscope", megapixels: 50, aperture: "f/3.4", sensorSize: "1/2.52\"", pixelSize: "0.7µm", fieldOfViewDeg: 22, opticalZoom: 5, digitalZoom: 100, stabilization: "OIS", video: ["8K@30"] },
        { id: "macro", position: "rear", kind: "macro", megapixels: 50, aperture: "f/2.4", sensorSize: null, pixelSize: null, fieldOfViewDeg: 40, opticalZoom: null, digitalZoom: 1, stabilization: "EIS", video: ["4K@30"] },
      ],
      front: [
        { id: "selfie", position: "front", kind: "selfie", megapixels: 12, aperture: "f/2.2", sensorSize: null, pixelSize: "1.12µm", fieldOfViewDeg: 80, opticalZoom: null, digitalZoom: 1, stabilization: "EIS", video: ["4K@60"] },
      ],
      features: ["10x optical", "200MP AI remosaic", "Expert RAW", "Pro mode"],
      videoCapabilities: ["8K@30fps", "4K@120fps", "HDR10+ video", "Log capture"],
    },
    audio: {
      speakers: ["Dual stereo speakers"],
      headphoneJack: false,
      codecs: ["LDAC", "aptX Adaptive", "AAC"],
      microphone: "Triple-mic, noise suppression",
    },
    battery: {
      capacityMah: 5000,
      type: "Li-Ion",
      chargingWatts: 45,
      chargingTimeMin: 68,
      wirelessWatts: 15,
      reverseWirelessWatts: 4.5,
      enduranceHours: 118,
    },
    connectivity: {
      wifi: "Wi-Fi 7",
      bluetooth: "Bluetooth 6.0",
      nfc: true,
      usb: "USB-C 3.2",
      irBlaster: false,
      gnss: ["GPS", "GLONASS", "Galileo", "BeiDou", "QZSS"],
      bands: ["n1", "n3", "n5", "n7", "n8", "n28", "n41", "n66", "n77", "n78", "B1", "B3", "B5", "B7", "B8", "B12", "B13", "B20", "B28", "B66"],
    },
    sensors: ["Fingerprint (under display, ultrasonic)", "Accelerometer", "Gyro", "Proximity", "Compass", "Barometer"],
    extras: { fingerprint: "under-display", faceUnlock: true, stylus: true, esim: true, uwb: true, satelliteSos: false },
  };
}

export const DEV_CATALOG: Device[] = [
  makeDevice({
    id: "samsung-galaxy-s25-ultra",
    slug: "samsung-galaxy-s25-ultra",
    brand: "Samsung",
    name: "Galaxy S25 Ultra",
    modelNumbers: ["SM-S938U1", "SM-S938B"],
    codename: "eureka",
    brandColor: "#8A2BE2",
    status: "available",
    announcedAt: ts(1738368000),
    releaseAt: ts(1738368000 + 86400 * 14),
    priceSummary: {
      currency: "USD", latest: 1199, msrp: 1299, min: 1099, max: 1399, average: 1215, dropPercent: 8, trend: "falling", sources: ["Amazon US", "Best Buy"], updatedAt: ts(Math.floor(Date.now() / 1000)),
    },
    score: { total: 96, hardware: 97, display: 96, camera: 95, battery: 92, value: 88, sentiment: 94, updatedAt: ts(Math.floor(Date.now() / 1000)) },
  }),
  makeDevice({
    id: "apple-iphone-17-pro",
    slug: "apple-iphone-17-pro",
    brand: "Apple",
    name: "iPhone 17 Pro",
    modelNumbers: ["A3201", "A3202"],
    codename: "Diablo",
    brandColor: "#A3A3A3",
    status: "available",
    announcedAt: ts(1736553600),
    releaseAt: ts(1736553600 + 86400 * 6),
    priceSummary: {
      currency: "USD", latest: 1099, msrp: 1099, min: 1049, max: 1159, average: 1108, dropPercent: 5, trend: "stable", sources: ["Apple Store", "Amazon US"], updatedAt: ts(Math.floor(Date.now() / 1000)),
    },
    specs: {
      ...baseSpecs(),
      display: { ...baseSpecs().display, sizeIn: 6.5, resolution: "2996×1276", ppi: 502, refreshRateHz: 120, peakBrightnessNits: 3000, type: "LTPO AMOLED", pwmHz: 240, glass: "Ceramic Shield 2" },
      platform: { os: "iOS 26", ui: "iOS 26", chipset: "A19 Pro", cpu: "Hexa-core 4.2 GHz", gpu: "Apple GPU 6-core", antutuV10: 3050000, geekbench6: { single: 3980, multi: 11300 } },
      cameras: {
        ...baseSpecs().cameras,
        rear: [
          { id: "main", position: "rear", kind: "wide", megapixels: 48, aperture: "f/1.5", sensorSize: "1/1.3\"", pixelSize: "1.22µm", fieldOfViewDeg: 85, opticalZoom: 1, digitalZoom: 30, stabilization: "OIS+EIS", video: ["4K@120"] },
          { id: "ultra", position: "rear", kind: "ultrawide", megapixels: 48, aperture: "f/2.2", sensorSize: "1/2.55\"", pixelSize: "0.7µm", fieldOfViewDeg: 120, opticalZoom: null, digitalZoom: 1, stabilization: "EIS", video: ["4K@60"] },
          { id: "tele", position: "rear", kind: "telephoto", megapixels: 12, aperture: "f/2.4", sensorSize: "1/3.5\"", pixelSize: "1.12µm", fieldOfViewDeg: 32, opticalZoom: 5, digitalZoom: 50, stabilization: "OIS+EIS", video: ["4K@120"] },
        ],
        features: ["48MP ProRAW", "Apple ProRes 4K", "Spatial video"],
        videoCapabilities: ["4K@120fps", "ProRes", "Spatial audio"],
      },
      battery: { ...baseSpecs().battery, capacityMah: 4670, chargingWatts: 40, wirelessWatts: 20, reverseWirelessWatts: 0, enduranceHours: 112 },
      extras: { fingerprint: "none", faceUnlock: true, stylus: false, esim: true, uwb: true, satelliteSos: true },
    },
    score: { total: 97, hardware: 96, display: 97, camera: 97, battery: 90, value: 86, sentiment: 96, updatedAt: ts(Math.floor(Date.now() / 1000)) },
  }),
  makeDevice({
    id: "google-pixel-10-pro",
    slug: "google-pixel-10-pro",
    brand: "Google",
    name: "Pixel 10 Pro",
    modelNumbers: ["GA05523-US"],
    codename: "Roadrunner",
    brandColor: "#4285F4",
    status: "available",
    announcedAt: ts(1751155200),
    releaseAt: ts(1751155200 + 86400 * 14),
    priceSummary: {
      currency: "USD", latest: 999, msrp: 999, min: 949, max: 1049, average: 985, dropPercent: 3, trend: "stable", sources: ["Google Store"], updatedAt: ts(Math.floor(Date.now() / 1000)),
    },
    specs: {
      ...baseSpecs(),
      platform: { os: "Android 16", ui: "Pixel UI", chipset: "Tensor G5", cpu: "Octa-core", gpu: "Mali-G715", antutuV10: 1980000, geekbench6: { single: 2890, multi: 9200 } },
      cameras: {
        ...baseSpecs().cameras,
        rear: [
          { id: "main", position: "rear", kind: "wide", megapixels: 50, aperture: "f/1.6", sensorSize: "1/1.31\"", pixelSize: "1.2µm", fieldOfViewDeg: 82, opticalZoom: 1, digitalZoom: 30, stabilization: "OIS+EIS", video: ["4K@60"] },
          { id: "ultra", position: "rear", kind: "ultrawide", megapixels: 50, aperture: "f/1.9", sensorSize: "1/2.4\"", pixelSize: "0.7µm", fieldOfViewDeg: 122, opticalZoom: null, digitalZoom: 1, stabilization: "EIS", video: ["4K@60"] },
          { id: "tele", position: "rear", kind: "periscope", megapixels: 50, aperture: "f/2.7", sensorSize: "1/2.5\"", pixelSize: "0.7µm", fieldOfViewDeg: 22, opticalZoom: 5, digitalZoom: 30, stabilization: "OIS+EIS", video: ["4K@60"] },
        ],
        features: ["Best Take", "Night Sight", "Magic Editor", "Zoom Enhance"],
        videoCapabilities: ["8K@30fps", "4K@60fps", "Night Sight video"],
      },
      battery: { ...baseSpecs().battery, capacityMah: 5150, chargingWatts: 37, wirelessWatts: 23, reverseWirelessWatts: 12, enduranceHours: 116 },
      extras: { ...baseSpecs().extras, stylus: false, satelliteSos: true },
    },
    score: { total: 93, hardware: 90, display: 94, camera: 96, battery: 91, value: 90, sentiment: 93, updatedAt: ts(Math.floor(Date.now() / 1000)) },
  }),
  makeDevice({
    id: "oneplus-13",
    slug: "oneplus-13",
    brand: "OnePlus",
    name: "13",
    modelNumbers: ["CPH2653"],
    codename: "Oscar",
    brandColor: "#EB0028",
    status: "available",
    priceSummary: {
      currency: "USD", latest: 799, msrp: 899, min: 749, max: 929, average: 820, dropPercent: 11, trend: "falling", sources: ["OnePlus Store"], updatedAt: ts(Math.floor(Date.now() / 1000)),
    },
    specs: {
      ...baseSpecs(),
      display: { ...baseSpecs().display, sizeIn: 6.82, resolution: "3168×1440", ppi: 510, peakBrightnessNits: 4500 },
      platform: { ...baseSpecs().platform, chipset: "Snapdragon 8 Elite", os: "Android 16", ui: "OxygenOS 16" },
      cameras: {
        ...baseSpecs().cameras,
        rear: [
          { id: "main", position: "rear", kind: "wide", megapixels: 50, aperture: "f/1.6", sensorSize: "1/1.43\"", pixelSize: "1.12µm", fieldOfViewDeg: 85, opticalZoom: 1, digitalZoom: 20, stabilization: "OIS+EIS", video: ["8K@30"] },
          { id: "ultra", position: "rear", kind: "ultrawide", megapixels: 50, aperture: "f/2.2", sensorSize: "1/2.51\"", pixelSize: "0.7µm", fieldOfViewDeg: 120, opticalZoom: null, digitalZoom: 1, stabilization: "EIS", video: ["4K@60"] },
          { id: "tele", position: "rear", kind: "periscope", megapixels: 50, aperture: "f/2.6", sensorSize: "1/1.95\"", pixelSize: "0.8µm", fieldOfViewDeg: 25, opticalZoom: 3, digitalZoom: 120, stabilization: "OIS", video: ["4K@60"] },
        ],
        features: ["Hasselblad tuning", "3x optical", "Master mode"],
        videoCapabilities: ["8K@30fps", "4K@120fps", "Dolby Vision"],
      },
      battery: { ...baseSpecs().battery, capacityMah: 6000, chargingWatts: 80, wirelessWatts: 50, reverseWirelessWatts: 10, enduranceHours: 130 },
    },
    score: { total: 94, hardware: 95, display: 94, camera: 92, battery: 96, value: 93, sentiment: 91, updatedAt: ts(Math.floor(Date.now() / 1000)) },
  }),
  makeDevice({
    id: "apple-iphone-17",
    slug: "apple-iphone-17",
    brand: "Apple",
    name: "iPhone 17",
    modelNumbers: ["A3198"],
    codename: "Draco",
    brandColor: "#5AC8FA",
    status: "available",
    announcedAt: ts(1736553600),
    releaseAt: ts(1736553600 + 86400 * 6),
    priceSummary: {
      currency: "USD", latest: 799, msrp: 799, min: 769, max: 849, average: 803, dropPercent: 2, trend: "stable", sources: ["Apple Store", "Amazon US"], updatedAt: ts(Math.floor(Date.now() / 1000)),
    },
    specs: {
      ...baseSpecs(),
      display: { ...baseSpecs().display, sizeIn: 6.3, resolution: "2622×1206", ppi: 460, peakBrightnessNits: 2500, type: "LTPO AMOLED", glass: "Ceramic Shield 2" },
      platform: { os: "iOS 26", ui: "iOS 26", chipset: "A19", cpu: "Hexa-core", gpu: "Apple GPU 5-core", antutuV10: 2600000, geekbench6: { single: 3480, multi: 9850 } },
      cameras: {
        ...baseSpecs().cameras,
        rear: [
          { id: "main", position: "rear", kind: "wide", megapixels: 48, aperture: "f/1.6", sensorSize: "1/1.3\"", pixelSize: "1.22µm", fieldOfViewDeg: 85, opticalZoom: 1, digitalZoom: 10, stabilization: "OIS", video: ["4K@60"] },
          { id: "ultra", position: "rear", kind: "ultrawide", megapixels: 48, aperture: "f/2.4", sensorSize: "1/2.55\"", pixelSize: "0.7µm", fieldOfViewDeg: 120, opticalZoom: null, digitalZoom: 1, stabilization: "EIS", video: ["4K@60"] },
        ],
        features: ["48MP Fusion", "Photonic Engine", "Smart HDR 6"],
        videoCapabilities: ["4K@60fps", "HDR video", "Cinematic mode"],
      },
      battery: { ...baseSpecs().battery, capacityMah: 4150, chargingWatts: 30, wirelessWatts: 15, reverseWirelessWatts: 0, enduranceHours: 104 },
      extras: { fingerprint: "none", faceUnlock: true, stylus: false, esim: true, uwb: false, satelliteSos: true },
    },
    score: { total: 91, hardware: 91, display: 92, camera: 90, battery: 87, value: 89, sentiment: 92, updatedAt: ts(Math.floor(Date.now() / 1000)) },
  }),
  makeDevice({
    id: "xiaomi-16-pro",
    slug: "xiaomi-16-pro",
    brand: "Xiaomi",
    name: "16 Pro",
    modelNumbers: ["25020PNR7C"],
    codename: "Zagreb",
    brandColor: "#FF6900",
    status: "available",
    announcedAt: ts(1754064000),
    releaseAt: ts(1754064000 + 86400 * 21),
    priceSummary: {
      currency: "USD", latest: 949, msrp: 999, min: 899, max: 1049, average: 958, dropPercent: 5, trend: "falling", sources: ["Xiaomi Store", "Amazon EU"], updatedAt: ts(Math.floor(Date.now() / 1000)),
    },
    specs: {
      ...baseSpecs(),
      display: { ...baseSpecs().display, sizeIn: 6.73, resolution: "3200×1440", ppi: 522, peakBrightnessNits: 4200, glass: "Gorilla Glass Victus 3" },
      platform: { ...baseSpecs().platform, chipset: "Snapdragon 8 Elite", ui: "HyperOS 3", antutuV10: 3100000, geekbench6: { single: 3520, multi: 11200 } },
      cameras: {
        ...baseSpecs().cameras,
        rear: [
          { id: "main", position: "rear", kind: "wide", megapixels: 200, aperture: "f/1.6", sensorSize: "1/1.28\"", pixelSize: "1.0µm", fieldOfViewDeg: 85, opticalZoom: 1, digitalZoom: 100, stabilization: "OIS", video: ["8K@30"] },
          { id: "ultra", position: "rear", kind: "ultrawide", megapixels: 50, aperture: "f/2.2", sensorSize: "1/2.51\"", pixelSize: "0.7µm", fieldOfViewDeg: 120, opticalZoom: null, digitalZoom: 1, stabilization: "EIS", video: ["4K@60"] },
          { id: "tele", position: "rear", kind: "telephoto", megapixels: 50, aperture: "f/2.5", sensorSize: "1/1.96\"", pixelSize: "0.8µm", fieldOfViewDeg: 24, opticalZoom: 3.2, digitalZoom: 60, stabilization: "OIS", video: ["4K@60"] },
        ],
        features: ["Leica optics", "Light Fusion 200", "Master video"],
        videoCapabilities: ["8K@30fps", "4K@120fps", "LOG video"],
      },
      battery: { ...baseSpecs().battery, capacityMah: 5600, chargingWatts: 120, wirelessWatts: 80, reverseWirelessWatts: 20, enduranceHours: 126 },
      connectivity: { ...baseSpecs().connectivity, irBlaster: true },
      extras: { ...baseSpecs().extras, satelliteSos: false },
    },
    score: { total: 94, hardware: 96, display: 95, camera: 94, battery: 95, value: 91, sentiment: 90, updatedAt: ts(Math.floor(Date.now() / 1000)) },
  }),
  makeDevice({
    id: "honor-magic-8-pro",
    slug: "honor-magic-8-pro",
    brand: "Honor",
    name: "Magic 8 Pro",
    modelNumbers: ["HSP-DC"],
    codename: "Odin",
    brandColor: "#00C0FF",
    status: "upcoming",
    announcedAt: ts(1760659200),
    releaseAt: null,
    priceSummary: {
      currency: "USD", latest: 899, msrp: 949, min: 869, max: 999, average: 905, dropPercent: 5, trend: "falling", sources: ["Honor Store", "Amazon EU"], updatedAt: ts(Math.floor(Date.now() / 1000)),
    },
    specs: {
      ...baseSpecs(),
      display: { ...baseSpecs().display, sizeIn: 6.82, resolution: "3168×1440", ppi: 512, peakBrightnessNits: 5000, glass: "Honor NanoCrystal Shield" },
      platform: { ...baseSpecs().platform, chipset: "Snapdragon 8 Elite", ui: "MagicOS 10", antutuV10: 3150000, geekbench6: { single: 3560, multi: 11400 } },
      cameras: {
        ...baseSpecs().cameras,
        rear: [
          { id: "main", position: "rear", kind: "wide", megapixels: 108, aperture: "f/1.4", sensorSize: "1/1.28\"", pixelSize: "1.4µm", fieldOfViewDeg: 85, opticalZoom: 1, digitalZoom: 100, stabilization: "OIS", video: ["8K@30"] },
          { id: "ultra", position: "rear", kind: "ultrawide", megapixels: 50, aperture: "f/2.0", sensorSize: "1/2.61\"", pixelSize: "0.7µm", fieldOfViewDeg: 122, opticalZoom: null, digitalZoom: 1, stabilization: "EIS", video: ["4K@60"] },
          { id: "tele", position: "rear", kind: "periscope", megapixels: 200, aperture: "f/2.6", sensorSize: "1/1.95\"", pixelSize: "0.8µm", fieldOfViewDeg: 23, opticalZoom: 4, digitalZoom: 120, stabilization: "OIS", video: ["8K@30"] },
        ],
        features: ["200MP periscope", "AI Zoom 2.0", "Falcon Capture"],
        videoCapabilities: ["8K@30fps", "4K@120fps", "Dolby Vision"],
      },
      battery: { ...baseSpecs().battery, capacityMah: 5850, chargingWatts: 100, wirelessWatts: 66, reverseWirelessWatts: 18, enduranceHours: 128 },
      extras: { ...baseSpecs().extras, stylus: true, satelliteSos: true },
    },
    score: { total: 95, hardware: 96, display: 96, camera: 95, battery: 96, value: 92, sentiment: 91, updatedAt: ts(Math.floor(Date.now() / 1000)) },
  }),
  makeDevice({
    id: "oppo-find-x9-pro",
    slug: "oppo-find-x9-pro",
    brand: "OPPO",
    name: "Find X9 Pro",
    modelNumbers: ["PHZ120"],
    codename: "Zelda",
    brandColor: "#00A64E",
    status: "announced",
    announcedAt: ts(1759420800),
    releaseAt: ts(1759420800 + 86400 * 30),
    priceSummary: {
      currency: "USD", latest: 1099, msrp: 1199, min: 1049, max: 1249, average: 1112, dropPercent: 8, trend: "falling", sources: ["OPPO Store", "Amazon EU"], updatedAt: ts(Math.floor(Date.now() / 1000)),
    },
    specs: {
      ...baseSpecs(),
      display: { ...baseSpecs().display, sizeIn: 6.82, resolution: "3168×1440", ppi: 510, peakBrightnessNits: 4500, type: "LTPO AMOLED", glass: "Gorilla Glass Victus 3" },
      platform: { ...baseSpecs().platform, chipset: "Snapdragon 8 Elite", ui: "ColorOS 16", antutuV10: 3120000, geekbench6: { single: 3540, multi: 11300 } },
      cameras: {
        ...baseSpecs().cameras,
        rear: [
          { id: "main", position: "rear", kind: "wide", megapixels: 50, aperture: "f/1.5", sensorSize: "1\"", pixelSize: "1.6µm", fieldOfViewDeg: 84, opticalZoom: 1, digitalZoom: 100, stabilization: "OIS+EIS", video: ["8K@30"] },
          { id: "ultra", position: "rear", kind: "ultrawide", megapixels: 50, aperture: "f/2.0", sensorSize: "1/2.51\"", pixelSize: "0.7µm", fieldOfViewDeg: 120, opticalZoom: null, digitalZoom: 1, stabilization: "EIS", video: ["4K@60"] },
          { id: "tele", position: "rear", kind: "periscope", megapixels: 50, aperture: "f/2.7", sensorSize: "1/2.51\"", pixelSize: "0.7µm", fieldOfViewDeg: 22, opticalZoom: 5, digitalZoom: 120, stabilization: "OIS", video: ["4K@60"] },
        ],
        features: ["Hasselblad Color", "1\" main sensor", "HyperTone engine"],
        videoCapabilities: ["8K@30fps", "4K@120fps", "Dolby Vision"],
      },
      battery: { ...baseSpecs().battery, capacityMah: 6200, chargingWatts: 120, wirelessWatts: 60, reverseWirelessWatts: 15, enduranceHours: 132 },
      connectivity: { ...baseSpecs().connectivity, irBlaster: true },
      extras: { ...baseSpecs().extras, stylus: false, satelliteSos: true },
    },
    score: { total: 95, hardware: 96, display: 95, camera: 97, battery: 96, value: 90, sentiment: 92, updatedAt: ts(Math.floor(Date.now() / 1000)) },
  }),
];

export function getDevCatalog(limit = 50): Device[] {
  return DEV_CATALOG.slice(0, limit);
}

export function findDeviceBySlug(slug: string): Device | null {
  return DEV_CATALOG.find((d) => d.slug === slug) ?? null;
}

export function findDevicesBySlugs(slugs: string[]): Device[] {
  return DEV_CATALOG.filter((d) => slugs.includes(d.slug));
}
