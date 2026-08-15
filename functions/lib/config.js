"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMBEDDING_DIMENSION = exports.COLLECTIONS = exports.db = exports.PRICE_SOURCE_ENDPOINTS = exports.GEMINI_API_KEY = void 0;
exports.getApp = getApp;
require("firebase-functions/v2");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
/**
 * Shared Cloud Functions runtime config. The service account is injected
 * via Firebase-managed runtime credentials (no env JSON needed on GCP);
 * local emulation uses the default application credentials.
 */
exports.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
exports.PRICE_SOURCE_ENDPOINTS = [
    "https://www.amazon.com/s?k=",
    "https://www.aliexpress.com/w/wholesale-",
];
function getApp() {
    if ((0, app_1.getApps)().length > 0)
        return (0, app_1.getApps)()[0];
    return (0, app_1.initializeApp)({
        credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
            ? (0, app_1.cert)(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
            : undefined,
        projectId: process.env.GCLOUD_PROJECT,
    });
}
exports.db = (0, firestore_1.getFirestore)(getApp());
exports.COLLECTIONS = {
    devices: "devices",
    variants: "variants",
    embeddings: "embeddings",
    priceHistory: "price_history",
    carrierBands: "carrier_bands",
    priceAlerts: "price_alerts",
    scrapeJobs: "scrape_jobs",
    oemMediaJobs: "oem_media_jobs",
    users: "users",
};
exports.EMBEDDING_DIMENSION = 768;
//# sourceMappingURL=config.js.map