import { chromium } from 'playwright';
import { scoreSellerTrust, computeReferencePrice } from './trustScorer';
import type { ScrapedSeller } from '../types';

export interface SellerSite {
  name: string;
  url: string;
}

// Scrape a single product page and extract its price.
async function scrapePriceFromPage(url: string): Promise<string | null> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  try {
    // Use networkidle so JS-rendered prices have time to appear
    await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });

    const price = await page.evaluate((): string | null => {
      function extractDollar(text: string): string | null {
        const m = text.match(/\$\s*[\d,]+(?:\.\d{1,2})?/);
        return m ? m[0].replace(/\s/g, '') : null;
      }

      // 1. JSON-LD structured data — handles most well-built storefronts
      const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const script of jsonLdScripts) {
        try {
          const raw = JSON.parse(script.textContent ?? '{}') as Record<string, unknown>;

          // Walk @graph arrays
          const nodes: Array<Record<string, unknown>> = Array.isArray(raw['@graph'])
            ? (raw['@graph'] as Array<Record<string, unknown>>)
            : [raw];

          for (const node of nodes) {
            if (node['@type'] !== 'Product') continue;
            const offersRaw = node['offers'];
            const offersList: Array<Record<string, unknown>> = Array.isArray(offersRaw)
              ? offersRaw as Array<Record<string, unknown>>
              : offersRaw ? [offersRaw as Record<string, unknown>] : [];
            for (const offer of offersList) {
              const p = offer['price'] ?? offer['lowPrice'];
              if (p !== undefined && p !== '') return `$${p}`;
            }
          }
        } catch { /* malformed JSON-LD */ }
      }

      // 2. Shopify — window.ShopifyAnalytics or meta[name="product:price:amount"]
      const shopifyMeta = document.querySelector('meta[name="product:price:amount"], meta[property="product:price:amount"]');
      if (shopifyMeta) {
        const val = shopifyMeta.getAttribute('content');
        if (val) return `$${parseFloat(val).toFixed(2)}`;
      }

      // Shopify also embeds price in og tags
      const ogPrice = document.querySelector('meta[property="og:price:amount"]');
      if (ogPrice) {
        const val = ogPrice.getAttribute('content');
        if (val) return `$${parseFloat(val).toFixed(2)}`;
      }

      // 3. itemprop="price" (schema.org microdata)
      const microdata = document.querySelector('[itemprop="price"]');
      if (microdata) {
        const content = microdata.getAttribute('content') ?? microdata.textContent ?? '';
        const extracted = extractDollar(content) ?? (content.trim() ? `$${content.trim()}` : null);
        if (extracted) return extracted;
      }

      // 4. CSS selectors — ordered by specificity/reliability
      const PRICE_SELECTORS = [
        // Shopify themes
        '.price__regular .price-item--regular',
        '.price__sale .price-item--sale',
        '[data-product-price]',
        'span[data-price]',
        '.product__price .price',
        '.product-single__price',
        // WooCommerce
        '.woocommerce-Price-amount bdi',
        'p.price .woocommerce-Price-amount',
        '.summary .price ins .woocommerce-Price-amount',
        '.summary .price .woocommerce-Price-amount',
        // BigCommerce / generic
        '[data-product-price-without-tax]',
        '[data-testid="product-price"]',
        '[data-automation="product-price"]',
        '.product-price__price',
        '.product-price',
        '.price-sales',
        '.price__current',
        '.js-price',
        // Amazon
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.a-price .a-offscreen',
        // Fallback
        '.price',
      ];

      for (const sel of PRICE_SELECTORS) {
        const els = Array.from(document.querySelectorAll(sel));
        for (const el of els) {
          const text = (el.getAttribute('content') ?? el.textContent ?? '').trim();
          if (!text) continue;
          const extracted = extractDollar(text);
          if (extracted) return extracted;
        }
      }

      return null;
    });

    return price;
  } catch (err) {
    console.warn(`[DirectScraper] Failed to load ${url}:`, (err as Error).message.split('\n')[0]);
    return null;
  } finally {
    await browser.close();
  }
}

// Given a list of AI-provided seller sites, scrape prices and score trust.
// referencePrice is passed in from the combined Bing+AI pool for consistent scoring.
export async function scrapeDirectPrices(
  sites: SellerSite[],
  brand: string,
  referencePrice?: number,
): Promise<ScrapedSeller[]> {
  const CONCURRENCY = 4;
  const results: Array<{ name: string; url: string; price: string }> = [];

  for (let i = 0; i < sites.length; i += CONCURRENCY) {
    const batch = sites.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async site => {
        const price = await scrapePriceFromPage(site.url);
        return { name: site.name, url: site.url, price };
      })
    );
    for (const r of batchResults) {
      if (r.price) {
        results.push({ name: r.name, url: r.url, price: r.price });
      } else {
        console.log(`[DirectScraper] No price found for ${r.name} (${r.url})`);
      }
    }
  }

  console.log(`[DirectScraper] Got prices from ${results.length}/${sites.length} sites`);
  if (!results.length) return [];

  const ref = referencePrice ?? computeReferencePrice(results.map(r => r.price));
  const priceFloor = Math.max(ref * 0.25, 30);
  const plausible = ref > 0
    ? results.filter(r => {
        const p = parseFloat(r.price.replace(/[^0-9.]/g, ''));
        return isNaN(p) || p >= priceFloor;
      })
    : results;

  return plausible.map(r => {
    const { score, isTrusted } = scoreSellerTrust({
      url:            r.url,
      price:          r.price,
      brand,
      referencePrice: ref,
    });
    return { name: r.name, price: r.price, url: r.url, credibilityScore: score, isTrusted };
  });
}
