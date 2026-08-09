import type { Page, BrowserContext } from 'playwright';
import { getSharedBrowser } from './browser';
import type { ScrapedSeller } from '../types';
import { scoreSellerTrust, computeReferencePrice } from './trustScorer';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface ProductMatch {
  title: string;
  price: string;
  url:   string;
}

// -----------------------------------------------------------------------
// Shared browser config (same stealth setup as bingShopping.ts)
// -----------------------------------------------------------------------

// -----------------------------------------------------------------------
// Scoring — runs in Node.js after page.evaluate returns raw card data
// -----------------------------------------------------------------------

// Variant keywords that are NOT in the base fragrance name should score negatively.
// e.g. "Sauvage Elixir" when searching "Dior Sauvage"
const WRONG_VARIANTS = [
  'elixir', 'absolu', 'intense', 'noir', 'sport', 'blue', 'rouge',
  'nectar', 'discovery set', 'gift set', 'sample', 'travel size',
  'mini', 'miniature', 'decant', 'vial', 'trial', 'explorer', 'set',
];

const GENERIC_WORDS = new Set([
  'eau', 'de', 'toilette', 'parfum', 'cologne', 'fragrance',
  'perfume', 'spray', 'for', 'men', 'women', 'by', 'the',
]);

function scoreMatch(title: string, brand: string, name: string): number {
  const t = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

  const brandWords = brand.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const nameWords  = name.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !GENERIC_WORDS.has(w));

  let score = 0;

  // Brand match
  const brandMatches = brandWords.filter(w => t.includes(w)).length;
  score += brandMatches * 2;

  // Name word match
  if (nameWords.length > 0) {
    const nameMatches = nameWords.filter(w => t.includes(w)).length;
    score += (nameMatches / nameWords.length) * 8;
    if (nameMatches < nameWords.length) score -= 4; // penalty for missing words
  }

  // Size bonus: 3.4oz / 100ml preferred
  if (t.includes('3.4') || /\b100\s*ml\b/.test(t)) score += 2;

  // Wrong variant penalty (only when the variant word isn't part of the query name)
  for (const variant of WRONG_VARIANTS) {
    if (t.includes(variant) && !name.toLowerCase().includes(variant)) {
      score -= 15;
    }
  }

  // Small/travel size penalty
  if (/\b(0\.\d+|1\.0?|1\.7|2\.0?)\s*oz\b/.test(t) ||
      /\b(10|15|20|30|50)\s*ml\b/.test(t)) {
    score -= 10;
  }

  return score;
}

// -----------------------------------------------------------------------
// Generic product-card extractor (runs inside page.evaluate)
// Returns the N best-matching cards found anywhere on the page.
// -----------------------------------------------------------------------

type RawCard = { title: string; price: string; url: string };

// Shared browser-side extractor for price text
const PRICE_SELECTORS = [
  '[class*="price"]', '[data-price]', '[itemprop="price"]',
  '[class*="amount"]', '[class*="cost"]',
];

async function extractCards(page: Page): Promise<RawCard[]> {
  return page.evaluate((priceSels: string[]) => {
    function extractDollar(text: string): string | null {
      const m = text.match(/\$\s*[\d,]+(?:\.\d{1,2})?/);
      return m ? m[0].replace(/\s/g, '') : null;
    }

    function getPriceFromContainer(container: Element): string | null {
      for (const sel of priceSels) {
        const el = container.querySelector(sel);
        if (!el) continue;
        const content = el.getAttribute('content') ?? el.textContent ?? '';
        const p = extractDollar(content);
        if (p) return p;
      }
      // fallback: any dollar amount in the container text
      return extractDollar(container.textContent ?? '');
    }

    // Container selectors ordered from most specific to least
    const CONTAINER_SELS = [
      '[class*="product-tile"]',
      '[class*="product-card"]',
      '[class*="product-item"]',
      '[class*="product_item"]',
      '[class*="ProductCard"]',
      '[class*="ProductTile"]',
      '[class*="item-tile"]',
      'article[class*="product"]',
      'li[class*="product"]',
      '[data-product-id]',
      '[data-item-id]',
      '[data-testid*="product"]',
    ];

    const seen = new Set<string>();
    const results: Array<{ title: string; price: string; url: string }> = [];

    let containers: Element[] = [];
    for (const sel of CONTAINER_SELS) {
      const found = Array.from(document.querySelectorAll(sel));
      if (found.length >= 3) { containers = found; break; }
    }

    // If specific selectors fail, fall back to finding anchors with prices nearby
    if (!containers.length) {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      for (const a of anchors) {
        const href = (a as HTMLAnchorElement).href;
        if (!href || href.includes('#') || href.includes('javascript')) continue;
        // Walk up to find a container that has a price
        let node: Element | null = a;
        for (let i = 0; i < 5; i++) {
          node = node?.parentElement ?? null;
          if (!node) break;
          const price = getPriceFromContainer(node);
          if (price) {
            containers.push(node);
            break;
          }
        }
      }
    }

    for (const container of containers) {
      const link = container.querySelector('a[href]') as HTMLAnchorElement | null;
      const href  = link?.href ?? '';
      if (!href || seen.has(href)) continue;
      seen.add(href);

      // Title: try common selectors, fall back to link text, then container text
      const titleEl =
        container.querySelector('[class*="name"], [class*="title"], [class*="Name"], [class*="Title"], h1, h2, h3') ??
        link;
      const title = titleEl?.textContent?.trim() ?? container.textContent?.slice(0, 120).trim() ?? '';

      const price = getPriceFromContainer(container);
      if (!price) continue;

      results.push({ title, price, url: href });
    }

    return results;
  }, PRICE_SELECTORS);
}

// Pick the best-scoring card for a given brand+name
function bestMatch(cards: RawCard[], brand: string, name: string): ProductMatch | null {
  let best: { score: number; card: RawCard } | null = null;
  for (const card of cards) {
    if (!card.title || !card.price || !card.url) continue;
    const score = scoreMatch(card.title, brand, name);
    if (!best || score > best.score) best = { score, card };
  }
  if (!best || best.score < 3) return null;
  return { title: best.card.title, price: best.card.price, url: best.card.url };
}

// -----------------------------------------------------------------------
// Individual site scrapers
// -----------------------------------------------------------------------

// Both retailers front their pages with a bot-verification interstitial that
// auto-passes after ~10-20s in a realistic browser, so every extraction below
// polls until data appears instead of using a fixed delay.

async function waitForCards(page: Page, maxWaitMs: number): Promise<RawCard[]> {
  const deadline = Date.now() + maxWaitMs;
  let cards: RawCard[] = [];
  while (Date.now() < deadline) {
    try {
      cards = await extractCards(page);
      if (cards.length >= 3) return cards;
    } catch {
      // Execution context destroyed by challenge redirect — keep polling
    }
    await page.waitForTimeout(1500);
  }
  return cards;
}

// FragranceNet is a Next.js app — all page data lives in the __NEXT_DATA__ JSON
// script, which is far more reliable than scraping the rendered DOM.
async function getNextPageData(page: Page, maxWaitMs: number): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const raw = await page.evaluate(() => {
        const script = document.querySelector('#__NEXT_DATA__')
          ?? Array.from(document.querySelectorAll('script')).find(s => (s.textContent ?? '').startsWith('{"props"'));
        return script?.textContent ?? null;
      });
      if (raw) {
        const parsed = JSON.parse(raw) as { props?: { pageProps?: { pageData?: Record<string, unknown> } } };
        const pageData = parsed?.props?.pageProps?.pageData;
        if (pageData) return pageData;
      }
    } catch {
      // Challenge redirect or partial page — keep polling
    }
    await page.waitForTimeout(1500);
  }
  return null;
}

// Pick the standard full-size (3.4oz / 100ml) price from a list of size variants,
// skipping testers, refill bottles, minis, and sets.
function pickStandardSizePrice(sizes: Array<{ label: string; price: string }>): string | null {
  const AVOID = /tester|refill\b|travel|mini|gift|set|deodorant|shower|lotion|balm|soap/i;

  function isStandardSize(label: string): boolean {
    const ozMatch = label.match(/(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?oz/i);
    if (ozMatch) {
      const value = parseFloat(ozMatch[1]);
      return value >= 3.2 && value <= 3.6;
    }
    const mlMatch = label.match(/(\d+(?:\.\d+)?)\s*ml/i);
    if (mlMatch) {
      const value = parseFloat(mlMatch[1]);
      return value >= 90 && value <= 110;
    }
    return false;
  }

  const candidates = sizes.filter(s => s.label && s.price && isStandardSize(s.label) && !AVOID.test(s.label));
  if (!candidates.length) {
    return null;
  }
  const cheapest = candidates.reduce((a, b) => {
    const priceA = parseFloat(a.price.replace(/[^0-9.]/g, ''));
    const priceB = parseFloat(b.price.replace(/[^0-9.]/g, ''));
    return priceA <= priceB ? a : b;
  });
  return cheapest.price.startsWith('$') ? cheapest.price : `$${cheapest.price}`;
}

async function scrapeFragranceNet(newPage: PageFactory, brand: string, name: string): Promise<ProductMatch | null> {
  const q = encodeURIComponent(`${brand} ${name}`);
  try {
    // Step 1: search — products are in pageData.results with a "from" price only.
    // Fresh context per navigation: Cloudflare flags a second goto in the same one.
    let results: Array<{
      section?: string; isSellable?: boolean; outOfStock?: boolean; productPath?: string;
      designer?: string; brand?: string; description?: string;
    }> = [];
    {
      const { page, close } = await newPage();
      try {
        await page.goto(`https://www.fragrancenet.com/fn/search/${q}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
        const searchData = await getNextPageData(page, 30000);
        results = (searchData?.results ?? []) as typeof results;
      } finally {
        await close();
      }
    }
    if (!Array.isArray(results) || !results.length) {
      console.log(`[FragranceNet] No search data for "${brand} ${name}"`);
      return null;
    }

    let best: { score: number; product: (typeof results)[number] } | null = null;
    for (const product of results) {
      if (product.section !== 'f' || !product.isSellable || product.outOfStock || !product.productPath) continue;
      const title = `${product.designer ?? ''} ${product.brand ?? ''} ${product.description ?? ''}`;
      const score = scoreMatch(title, brand, name);
      if (!best || score > best.score) best = { score, product };
    }
    if (!best || best.score < 3) {
      console.log(`[FragranceNet] No match for "${brand} ${name}" (${results.length} results)`);
      return null;
    }

    // Step 2: product page — pageData.skuMap has real per-size prices
    const productUrl = `https://www.fragrancenet.com/${best.product.productPath!.replace(/^\//, '')}`;
    let skuMap: Record<string, { SIZE?: string; ourPrice?: string }> = {};
    {
      const { page, close } = await newPage();
      try {
        await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        const productData = await getNextPageData(page, 30000);
        skuMap = (productData?.skuMap ?? {}) as typeof skuMap;
      } finally {
        await close();
      }
    }
    const price = pickStandardSizePrice(
      Object.values(skuMap).map(sku => ({ label: sku.SIZE ?? '', price: sku.ourPrice ?? '' })),
    );
    if (!price) {
      console.log(`[FragranceNet] No full-size price for "${brand} ${name}"`);
      return null;
    }

    const title = `${best.product.designer} ${best.product.brand} ${best.product.description} 3.4 oz`;
    console.log(`[FragranceNet] Found: "${title}" — ${price}`);
    return { title, price, url: productUrl };
  } catch (err) {
    console.warn(`[FragranceNet] Error: ${(err as Error).message.split('\n')[0]}`);
    return null;
  }
}

// Extract the full-size price from a FragranceX product page: find the smallest
// DOM container mentioning 3.4oz/100ml together with a dollar price.
async function extractFragranceXSizePrice(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    let best: string | null = null;
    let bestLength = Infinity;
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (el.children.length > 8) continue;
      const text = el.textContent ?? '';
      if (text.length > 220 || text.length >= bestLength) continue;
      if (!/3\.4\s*(?:fl\.?\s*)?oz|100\s*ml/i.test(text)) continue;
      if (/sample|decant|travel|mini|tester|gift|set|refill\b/i.test(text)) continue;
      const priceMatch = text.match(/\$\s*[\d,]+(?:\.\d{1,2})?/);
      if (priceMatch) {
        best = priceMatch[0].replace(/\s/g, '');
        bestLength = text.length;
      }
    }
    return best;
  });
}

async function scrapeFragranceX(newPage: PageFactory, brand: string, name: string): Promise<ProductMatch | null> {
  const q = encodeURIComponent(`${brand} ${name}`);
  const { page, close } = await newPage();
  try {
    await page.goto(`https://www.fragrancex.com/search/search_results?stext=${q}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    const cards = await waitForCards(page, 30000);
    const match = bestMatch(cards, brand, name);
    if (!match) {
      console.log(`[FragranceX] No match for "${brand} ${name}" (${cards.length} cards found)`);
      return null;
    }

    // The search card price is the smallest-size "from" price — visit the
    // product page to get the real 3.4oz price. Drop the result if none exists.
    await page.goto(match.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(4000);
    let price: string | null = null;
    for (let attempt = 0; attempt < 5 && !price; attempt++) {
      try {
        price = await extractFragranceXSizePrice(page);
      } catch {}
      if (!price) await page.waitForTimeout(2000);
    }
    if (!price) {
      console.log(`[FragranceX] No full-size price for "${match.title}"`);
      return null;
    }
    console.log(`[FragranceX] Found: "${match.title}" — ${price}`);
    return { title: `${match.title} 3.4 oz`, price, url: match.url };
  } catch (err) {
    console.warn(`[FragranceX] Error: ${(err as Error).message.split('\n')[0]}`);
    return null;
  } finally {
    await close();
  }
}

// -----------------------------------------------------------------------
// Main export
// -----------------------------------------------------------------------

// Factory handed to each scraper: opens a page in a FRESH browser context.
// FragranceNet's Cloudflare flags rapid multi-page navigation within one
// context (second goto gets stuck on "Just a moment..."), but a clean
// context sails through — so each navigation gets its own context.
type PageFactory = () => Promise<{ page: Page; close: () => Promise<void> }>;

const SITE_SCRAPERS: Array<{
  name: string;
  fn:   (newPage: PageFactory, brand: string, name: string) => Promise<ProductMatch | null>;
}> = [
  { name: 'FragranceNet', fn: scrapeFragranceNet },
  { name: 'FragranceX',   fn: scrapeFragranceX },
];

export async function scrapeAllSites(brand: string, name: string): Promise<ScrapedSeller[]> {
  const browser = await getSharedBrowser();

  let results: Array<{ siteName: string; match: ProductMatch }> = [];
  // We share one long-lived browser, so close our own contexts (not the browser).
  const openContexts: BrowserContext[] = [];

  try {
    const newPage: PageFactory = async () => {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport:  { width: 1366, height: 768 },
        locale:    'en-US',
        timezoneId: 'America/Los_Angeles',
        extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
      });
      openContexts.push(context);
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
      const page = await context.newPage();
      return { page, close: () => context.close() };
    };

    // Run all site scrapers in parallel
    const settled = await Promise.allSettled(
      SITE_SCRAPERS.map(async site => {
        const match = await site.fn(newPage, brand, name);
        return match ? { siteName: site.name, match } : null;
      }),
    );

    results = settled
      .filter((r): r is PromiseFulfilledResult<{ siteName: string; match: ProductMatch } | null> =>
        r.status === 'fulfilled' && r.value !== null,
      )
      .map(r => r.value!);

  } finally {
    await Promise.allSettled(openContexts.map(context => context.close()));
  }

  console.log(`[SiteScrapers] Got prices from ${results.length}/${SITE_SCRAPERS.length} sites`);
  if (!results.length) return [];

  const referencePrice = computeReferencePrice(results.map(r => r.match.price));
  const priceFloor     = Math.max(referencePrice * 0.30, 20);

  return results
    .filter(r => {
      const p = parseFloat(r.match.price.replace(/[^0-9.]/g, ''));
      return isNaN(p) || referencePrice === 0 || p >= priceFloor;
    })
    .map(r => {
      const { score, isTrusted } = scoreSellerTrust({
        url:            r.match.url,
        price:          r.match.price,
        brand,
        productText:    r.match.title,
        referencePrice,
      });
      return {
        name:             r.siteName,
        price:            r.match.price,
        url:              r.match.url,
        credibilityScore: score,
        isTrusted,
      };
    });
}
