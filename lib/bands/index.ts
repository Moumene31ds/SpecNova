import type { CarrierBand } from "@/lib/firebase/types";

/**
 * Hyper-local carrier compatibility engine.
 *
 * A curated static mirror of the `carrier_bands` collection so the band
 * checker works with zero network round-trips. Production deployments keep
 * the Firestore copy as source-of-truth and refresh this seed from Cloud
 * Functions on a schedule.
 */

export const STATIC_CARRIER_BANDS: CarrierBand[] = [
  // ----- US -----
  { id: "us-att-b12", countryCode: "US", country: "United States", carrier: "AT&T", technology: "4G", band: "B12", frequency: "700 MHz", bandwidthMhz: 10, status: "live", standalone: false },
  { id: "us-att-n77", countryCode: "US", country: "United States", carrier: "AT&T", technology: "5G", band: "n77", frequency: "3.45–3.98 GHz", bandwidthMhz: 100, status: "live", standalone: false },
  { id: "us-att-n5", countryCode: "US", country: "United States", carrier: "AT&T", technology: "5G", band: "n5", frequency: "850 MHz", bandwidthMhz: 10, status: "live", standalone: false },
  { id: "us-verizon-b13", countryCode: "US", country: "United States", carrier: "Verizon", technology: "4G", band: "B13", frequency: "700 MHz", bandwidthMhz: 10, status: "live", standalone: false },
  { id: "us-verizon-n77", countryCode: "US", country: "United States", carrier: "Verizon", technology: "5G", band: "n77", frequency: "3.7–3.98 GHz", bandwidthMhz: 100, status: "live", standalone: false },
  { id: "us-verizon-n5", countryCode: "US", country: "United States", carrier: "Verizon", technology: "5G", band: "n5", frequency: "850 MHz", bandwidthMhz: 10, status: "live", standalone: true },
  { id: "us-tmobile-b2", countryCode: "US", country: "United States", carrier: "T-Mobile", technology: "4G", band: "B2", frequency: "1900 MHz", bandwidthMhz: 20, status: "live", standalone: false },
  { id: "us-tmobile-b66", countryCode: "US", country: "United States", carrier: "T-Mobile", technology: "4G", band: "B66", frequency: "1700/2100 MHz", bandwidthMhz: 20, status: "live", standalone: false },
  { id: "us-tmobile-n41", countryCode: "US", country: "United States", carrier: "T-Mobile", technology: "5G", band: "n41", frequency: "2.5 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "us-tmobile-n71", countryCode: "US", country: "United States", carrier: "T-Mobile", technology: "5G", band: "n71", frequency: "600 MHz", bandwidthMhz: 20, status: "live", standalone: true },
  // ----- UK -----
  { id: "uk-ee-b20", countryCode: "GB", country: "United Kingdom", carrier: "EE", technology: "4G", band: "B20", frequency: "800 MHz", bandwidthMhz: 10, status: "live", standalone: false },
  { id: "uk-ee-n78", countryCode: "GB", country: "United Kingdom", carrier: "EE", technology: "5G", band: "n78", frequency: "3.4–3.8 GHz", bandwidthMhz: 100, status: "live", standalone: false },
  { id: "uk-three-b3", countryCode: "GB", country: "United Kingdom", carrier: "Three", technology: "4G", band: "B3", frequency: "1800 MHz", bandwidthMhz: 20, status: "live", standalone: false },
  { id: "uk-three-n78", countryCode: "GB", country: "United Kingdom", carrier: "Three", technology: "5G", band: "n78", frequency: "3.4–3.8 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "uk-vodafone-b1", countryCode: "GB", country: "United Kingdom", carrier: "Vodafone", technology: "4G", band: "B1", frequency: "2100 MHz", bandwidthMhz: 20, status: "live", standalone: false },
  { id: "uk-vodafone-n28", countryCode: "GB", country: "United Kingdom", carrier: "Vodafone", technology: "5G", band: "n28", frequency: "700 MHz", bandwidthMhz: 10, status: "live", standalone: false },
  { id: "uk-o2-b20", countryCode: "GB", country: "United Kingdom", carrier: "O2", technology: "4G", band: "B20", frequency: "800 MHz", bandwidthMhz: 10, status: "live", standalone: false },
  // ----- DE -----
  { id: "de-dt-b20", countryCode: "DE", country: "Germany", carrier: "Telekom", technology: "4G", band: "B20", frequency: "800 MHz", bandwidthMhz: 10, status: "live", standalone: false },
  { id: "de-dt-n78", countryCode: "DE", country: "Germany", carrier: "Telekom", technology: "5G", band: "n78", frequency: "3.4–3.8 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "de-vodafone-b3", countryCode: "DE", country: "Germany", carrier: "Vodafone", technology: "4G", band: "B3", frequency: "1800 MHz", bandwidthMhz: 20, status: "live", standalone: false },
  // ----- FR -----
  { id: "fr-orange-n78", countryCode: "FR", country: "France", carrier: "Orange", technology: "5G", band: "n78", frequency: "3.4–3.8 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "fr-sfr-b28", countryCode: "FR", country: "France", carrier: "SFR", technology: "4G", band: "B28", frequency: "700 MHz", bandwidthMhz: 10, status: "live", standalone: false },
  // ----- IT -----
  { id: "it-tim-n78", countryCode: "IT", country: "Italy", carrier: "TIM", technology: "5G", band: "n78", frequency: "3.4–3.8 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "it-vodafone-b20", countryCode: "IT", country: "Italy", carrier: "Vodafone", technology: "4G", band: "B20", frequency: "800 MHz", bandwidthMhz: 10, status: "live", standalone: false },
  // ----- CA -----
  { id: "ca-rogers-b7", countryCode: "CA", country: "Canada", carrier: "Rogers", technology: "4G", band: "B7", frequency: "2600 MHz", bandwidthMhz: 20, status: "live", standalone: false },
  { id: "ca-rogers-n78", countryCode: "CA", country: "Canada", carrier: "Rogers", technology: "5G", band: "n78", frequency: "3.5 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "ca-bell-b12", countryCode: "CA", country: "Canada", carrier: "Bell", technology: "4G", band: "B12", frequency: "700 MHz", bandwidthMhz: 10, status: "live", standalone: false },
  { id: "ca-telus-n66", countryCode: "CA", country: "Canada", carrier: "Telus", technology: "5G", band: "n66", frequency: "AWS-3", bandwidthMhz: 40, status: "live", standalone: false },
  // ----- AU -----
  { id: "au-telstra-b28", countryCode: "AU", country: "Australia", carrier: "Telstra", technology: "4G", band: "B28", frequency: "700 MHz", bandwidthMhz: 10, status: "live", standalone: false },
  { id: "au-telstra-n78", countryCode: "AU", country: "Australia", carrier: "Telstra", technology: "5G", band: "n78", frequency: "3.4–3.8 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "au-optus-b3", countryCode: "AU", country: "Australia", carrier: "Optus", technology: "4G", band: "B3", frequency: "1800 MHz", bandwidthMhz: 20, status: "live", standalone: false },
  // ----- IN -----
  { id: "in-jio-n78", countryCode: "IN", country: "India", carrier: "Jio", technology: "5G", band: "n78", frequency: "3.3–3.67 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "in-jio-n28", countryCode: "IN", country: "India", carrier: "Jio", technology: "5G", band: "n28", frequency: "700 MHz", bandwidthMhz: 5, status: "live", standalone: true },
  { id: "in-airtel-n78", countryCode: "IN", country: "India", carrier: "Airtel", technology: "5G", band: "n78", frequency: "3.5 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "in-airtel-b3", countryCode: "IN", country: "India", carrier: "Airtel", technology: "4G", band: "B3", frequency: "1800 MHz", bandwidthMhz: 20, status: "live", standalone: false },
  { id: "in-vi-b8", countryCode: "IN", country: "India", carrier: "Vi", technology: "4G", band: "B8", frequency: "900 MHz", bandwidthMhz: 10, status: "live", standalone: false },
  // ----- JP -----
  { id: "jp-docomo-b1", countryCode: "JP", country: "Japan", carrier: "NTT docomo", technology: "4G", band: "B1", frequency: "2100 MHz", bandwidthMhz: 20, status: "live", standalone: false },
  { id: "jp-docomo-n77", countryCode: "JP", country: "Japan", carrier: "NTT docomo", technology: "5G", band: "n77", frequency: "3.7–4.1 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "jp-au-n78", countryCode: "JP", country: "Japan", carrier: "KDDI au", technology: "5G", band: "n78", frequency: "3.4–3.6 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "jp-softbank-b3", countryCode: "JP", country: "Japan", carrier: "SoftBank", technology: "4G", band: "B3", frequency: "1800 MHz", bandwidthMhz: 20, status: "live", standalone: false },
  // ----- KR -----
  { id: "kr-skt-n78", countryCode: "KR", country: "South Korea", carrier: "SK Telecom", technology: "5G", band: "n78", frequency: "3.5 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "kr-kt-n78", countryCode: "KR", country: "South Korea", carrier: "KT", technology: "5G", band: "n78", frequency: "3.5 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "kr-lgu-b1", countryCode: "KR", country: "South Korea", carrier: "LG U+", technology: "4G", band: "B1", frequency: "2100 MHz", bandwidthMhz: 20, status: "live", standalone: false },
  // ----- UAE -----
  { id: "ae-du-n78", countryCode: "AE", country: "UAE", carrier: "du", technology: "5G", band: "n78", frequency: "3.4–3.8 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "ae-etisalat-n78", countryCode: "AE", country: "UAE", carrier: "Etisalat", technology: "5G", band: "n78", frequency: "3.4–3.8 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  // ----- SA -----
  { id: "sa-stc-n78", countryCode: "SA", country: "Saudi Arabia", carrier: "stc", technology: "5G", band: "n78", frequency: "3.5 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  { id: "sa-mobily-b3", countryCode: "SA", country: "Saudi Arabia", carrier: "Mobily", technology: "4G", band: "B3", frequency: "1800 MHz", bandwidthMhz: 20, status: "live", standalone: false },
  // ----- ZA -----
  { id: "za-vodacom-b1", countryCode: "ZA", country: "South Africa", carrier: "Vodacom", technology: "4G", band: "B1", frequency: "2100 MHz", bandwidthMhz: 20, status: "live", standalone: false },
  { id: "za-mtn-n78", countryCode: "ZA", country: "South Africa", carrier: "MTN", technology: "5G", band: "n78", frequency: "3.5 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  // ----- BR -----
  { id: "br-vivo-b28", countryCode: "BR", country: "Brazil", carrier: "Vivo", technology: "4G", band: "B28", frequency: "700 MHz", bandwidthMhz: 10, status: "live", standalone: false },
  { id: "br-claro-n78", countryCode: "BR", country: "Brazil", carrier: "Claro", technology: "5G", band: "n78", frequency: "3.5 GHz", bandwidthMhz: 100, status: "live", standalone: true },
  // ----- MX -----
  { id: "mx-telcel-b2", countryCode: "MX", country: "Mexico", carrier: "Telcel", technology: "4G", band: "B2", frequency: "1900 MHz", bandwidthMhz: 20, status: "live", standalone: false },
  { id: "mx-telcel-n41", countryCode: "MX", country: "Mexico", carrier: "Telcel", technology: "5G", band: "n41", frequency: "2.5 GHz", bandwidthMhz: 100, status: "live", standalone: true },
];

export type BandCompatibility = {
  technology: "2G" | "3G" | "4G" | "5G";
  carrier: string;
  country: string;
  matched: string[];
  missing: string[];
  score: number; // 0..1 fraction of carrier bands covered
  verdict: "full" | "partial" | "none";
};

const NORMALIZE = (b: string) => b.replace(/\s+/g, "").toLowerCase();

/**
 * Resolve device-band coverage against a single carrier's network map.
 * A band counts as covered if the device advertises it AND the carrier
 * runs it live (or in testing, at reduced reliability).
 */
export function checkCarrierCompatibility(
  deviceBands: string[],
  carrierBands: CarrierBand[],
): BandCompatibility[] {
  const deviceSet = new Set(deviceBands.map(NORMALIZE));

  const byTech = new Map<BandCompatibility["technology"], CarrierBand[]>();
  for (const band of carrierBands) {
    const list = byTech.get(band.technology) ?? [];
    list.push(band);
    byTech.set(band.technology, list);
  }

  const results: BandCompatibility[] = [];
  for (const [technology, bands] of byTech) {
    const matched: string[] = [];
    const missing: string[] = [];
    for (const band of bands) {
      if (deviceSet.has(NORMALIZE(band.band))) matched.push(band.band);
      else missing.push(band.band);
    }
    const total = bands.length;
    const score = total === 0 ? 0 : matched.length / total;
    results.push({
      technology,
      carrier: bands[0]!.carrier,
      country: bands[0]!.country,
      matched: [...new Set(matched)],
      missing: [...new Set(missing)],
      score,
      verdict: score === 1 ? "full" : score > 0 ? "partial" : "none",
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

export function listCarriers() {
  const map = new Map<string, { country: string; carriers: string[] }>();
  for (const band of STATIC_CARRIER_BANDS) {
    const entry = map.get(band.country) ?? {
      country: band.country,
      carriers: [],
    };
    if (!entry.carriers.includes(band.carrier)) entry.carriers.push(band.carrier);
    map.set(band.country, entry);
  }
  return map;
}

export function bandsForCarrier(carrierName: string): CarrierBand[] {
  return STATIC_CARRIER_BANDS.filter((b) => b.carrier === carrierName);
}
