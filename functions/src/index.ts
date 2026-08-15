import "firebase-functions/v2";

// Scraping & Zero-Missing pipeline
export {
  onScrapeJobCreated,
  scheduledCatalogSweep,
} from "./scrapers/on-demand";

// OEM media: AI QC -> CDN variants -> background removal -> Storage/Firestore
export { onOemMediaJobCreated } from "./processOEMImages";

// Price ingestion + alerts
export {
  ingestPriceFromClient,
  scheduledPriceSweep,
  ingestPricePoint,
} from "./pricing/price-ingestion";

// Semantic index maintenance
export {
  maintainEmbeddings,
  scheduledEmbeddingBackfill,
} from "./embeddings/embed-device";

// FCM / email fan-out
export { sendPriceDropNotification } from "./notifications/price-drop-fcm";
