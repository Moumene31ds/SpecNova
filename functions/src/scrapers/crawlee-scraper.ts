import { PlaywrightCrawler, type PlaywrightCrawlingContext } from "@crawlee/playwright";

/**
 * Headless scraping engine. Multi-source: spec databases and FCC filings.
 * Produces a single concatenated text blob that the Gemini normalizer
 * turns into typed specs. Guarded by rotating browser sessions so
 * large-scale crawls stay under bot-detection thresholds.
 */
export class SpecScraper {
  private crawler: PlaywrightCrawler;
  private fragments: string[] = [];

  constructor() {
    this.crawler = new PlaywrightCrawler({
      maxRequestsPerCrawl: 24,
      maxConcurrency: 4,
      requestHandler: this.handleRequest.bind(this),
      failedRequestHandler: async ({ request }) => {
        console.warn(`[scraper] failed ${request.url}`);
      },
      useSessionPool: true,
      sessionPoolOptions: { maxPoolSize: 4 },
      maxRequestRetries: 2,
      requestHandlerTimeoutSecs: 30,
    });
  }

  private async handleRequest(context: PlaywrightCrawlingContext) {
    const { request, page } = context;
    const url = new URL(request.url);

    let text = "";
    try {
      // Runs inside the browser context (Playwright serializes the fn), so
      // `document` is accessed via `globalThis` to keep the Node-only lib.
      text = await page.evaluate(() => {
        const doc = globalThis as unknown as {
          document: {
            querySelector(sel: string): { textContent: string | null } | null;
            body: { textContent: string | null };
          };
        };
        const candidates = [
          doc.document.querySelector("main"),
          doc.document.querySelector("article"),
          doc.document.querySelector("#specs"),
          doc.document.querySelector(".specs"),
          doc.document.querySelector(".product-specifications"),
          doc.document.querySelector(".techspecs"),
        ];
        const source =
          candidates.find((el) => el && el.textContent && el.textContent.length > 200) ??
          doc.document.body;
        return source?.textContent ?? "";
      });
    } catch (err) {
      console.warn(`[scraper] extraction failed for ${url.hostname}`, err);
      return;
    }

    const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 6000);
    if (cleaned.length > 200) {
      this.fragments.push(`\n[SOURCE: ${url.hostname}]\n${cleaned}`);
    }
  }

  /** Enqueue sources, run the crawl, return concatenated raw data. */
  async scrape(query: string): Promise<string> {
    this.fragments = [];
    const encoded = encodeURIComponent(query);

    const urls = [
      `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${encoded}`,
      `https://www.devicespecifications.com/en/search?search=${encoded}`,
      `https://www.kimovil.com/en/find/search?q=${encoded}`,
      `https://www.fcc.gov/oetcf/eas/reports/GenericSearchResult.cfm?RequestTimeout=500&Mode=GenericSearch&String1=${encoded}`,
    ];

    await this.crawler.run(urls);

    if (this.fragments.length === 0) {
      throw new Error(`No scrapable sources returned for "${query}".`);
    }

    return this.fragments.join("\n").slice(0, 40_000);
  }
}
