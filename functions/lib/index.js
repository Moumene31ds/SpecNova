"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPriceDropNotification = exports.scheduledEmbeddingBackfill = exports.maintainEmbeddings = exports.ingestPricePoint = exports.scheduledPriceSweep = exports.ingestPriceFromClient = exports.onOemMediaJobCreated = exports.scheduledCatalogSweep = exports.onScrapeJobCreated = void 0;
require("firebase-functions/v2");
// Scraping & Zero-Missing pipeline
var on_demand_1 = require("./scrapers/on-demand");
Object.defineProperty(exports, "onScrapeJobCreated", { enumerable: true, get: function () { return on_demand_1.onScrapeJobCreated; } });
Object.defineProperty(exports, "scheduledCatalogSweep", { enumerable: true, get: function () { return on_demand_1.scheduledCatalogSweep; } });
// OEM media: AI QC -> CDN variants -> background removal -> Storage/Firestore
var processOEMImages_1 = require("./processOEMImages");
Object.defineProperty(exports, "onOemMediaJobCreated", { enumerable: true, get: function () { return processOEMImages_1.onOemMediaJobCreated; } });
// Price ingestion + alerts
var price_ingestion_1 = require("./pricing/price-ingestion");
Object.defineProperty(exports, "ingestPriceFromClient", { enumerable: true, get: function () { return price_ingestion_1.ingestPriceFromClient; } });
Object.defineProperty(exports, "scheduledPriceSweep", { enumerable: true, get: function () { return price_ingestion_1.scheduledPriceSweep; } });
Object.defineProperty(exports, "ingestPricePoint", { enumerable: true, get: function () { return price_ingestion_1.ingestPricePoint; } });
// Semantic index maintenance
var embed_device_1 = require("./embeddings/embed-device");
Object.defineProperty(exports, "maintainEmbeddings", { enumerable: true, get: function () { return embed_device_1.maintainEmbeddings; } });
Object.defineProperty(exports, "scheduledEmbeddingBackfill", { enumerable: true, get: function () { return embed_device_1.scheduledEmbeddingBackfill; } });
// FCM / email fan-out
var price_drop_fcm_1 = require("./notifications/price-drop-fcm");
Object.defineProperty(exports, "sendPriceDropNotification", { enumerable: true, get: function () { return price_drop_fcm_1.sendPriceDropNotification; } });
//# sourceMappingURL=index.js.map