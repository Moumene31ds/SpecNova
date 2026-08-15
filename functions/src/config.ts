import "firebase-functions/v2";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Shared Cloud Functions runtime config. The service account is injected
 * via Firebase-managed runtime credentials (no env JSON needed on GCP);
 * local emulation uses the default application credentials.
 */

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";

export const PRICE_SOURCE_ENDPOINTS = [
  "https://www.amazon.com/s?k=",
  "https://www.aliexpress.com/w/wholesale-",
] as const;

export function getApp() {
  if (getApps().length > 0) return getApps()[0]!;
  return initializeApp({
    credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
      : undefined,
    projectId: process.env.GCLOUD_PROJECT,
  });
}

export const db = getFirestore(getApp());

export const COLLECTIONS = {
  devices: "devices",
  variants: "variants",
  embeddings: "embeddings",
  priceHistory: "price_history",
  carrierBands: "carrier_bands",
  priceAlerts: "price_alerts",
  scrapeJobs: "scrape_jobs",
  oemMediaJobs: "oem_media_jobs",
  users: "users",
  auditLogs: "audit_logs",
} as const;

export const EMBEDDING_DIMENSION = 768;
