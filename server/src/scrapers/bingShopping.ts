import { chromium } from 'playwright';
import type { Page } from 'playwright';
import type { ScrapedSeller } from '../types';
import { scoreSellerTrust, computeReferencePrice } from './trustScorer';
import { getDomainAgeDays } from './whoisLookup';

// Known seller names (used to build a scoreable URL)
const SELLER_DOMAINS = new Map<string, string>([
  ['sephora', 'sephora.com'],
  ['nordstrom', 'nordstrom.com'],
  ['nordstrom rack', 'nordstromrack.com'],
  ["macy's", 'macys.com'],
  ['macys', 'macys.com'],
  ["bloomingdale's", 'bloomingdales.com'],
  ['bloomingdales', 'bloomingdales.com'],
  ['neiman marcus', 'neimanmarcus.com'],
  ['saks fifth avenue', 'saksfifthavenue.com'],
  ['ulta', 'ulta.com'],
  ['ulta beauty', 'ulta.com'],
  ['fragrancenet', 'fragrancenet.com'],
  ['foreverlux', 'foreverlux.com'],
  ['fragrance net', 'fragrancenet.com'],
  ['fragrancenet.com', 'fragrancenet.com'],
  ['fragrancex', 'fragrancex.com'],
  ['fragrancex.com', 'fragrancex.com'],
  ['perfumania', 'perfumania.com'],
  ['jomashop', 'jomashop.com'],
  ['fragrance shop', 'fragranceshop.com'],
  ['fragranceshop.com', 'fragranceshop.com'],
  ['amazon', 'amazon.com'],
  ['amazon.com', 'amazon.com'],
  ['walmart', 'walmart.com'],
  ['target', 'target.com'],
  ['ebay', 'ebay.com'],
  ['ebay.com', 'ebay.com'],
  ["dillard's", 'dillards.com'],
  ['dillards', 'dillards.com'],
  ['belk', 'belk.com'],
  ['costco', 'costco.com'],
  // Brand official stores
  ['christian dior', 'dior.com'],
  ['lattafa', 'lattafa-usa.com'],
  ['dior', 'dior.com'],
  ['tom ford', 'tomford.com'],
  ['chanel', 'chanel.com'],
  ['ysl beauty', 'yslbeauty.com'],
  ['yves saint laurent', 'ysl.com'],
  ['armani beauty', 'armani.com'],
  ['giorgio armani', 'giorgioarmani.com'],
  ['versace', 'versace.com'],
  ['burberry', 'burberry.com'],
  ['gucci', 'gucci.com'],
  ['prada', 'prada.com'],
  ['hermes', 'hermes.com'],
  ['hermès', 'hermes.com'],
  ['creed', 'creedfragrances.com'],
  ['jo malone', 'jomalone.com'],
  ['jo malone london', 'jomalone.com'],
  ['maison margiela', 'maisonmargiela.com'],
  ['acqua di parma', 'acquadiparma.com'],
  ['calvin klein', 'calvinklein.com'],
  ['jimmy choo', 'jimmychoo.com'],
  ['montblanc', 'montblanc.com'],
  ['valentino', 'valentino.com'],
  ['carolina herrera', 'carolinaherrera.com'],
  ['givenchy', 'givenchy.com'],
  ['bvlgari', 'bvlgari.com'],
  ['bulgari', 'bvlgari.com'],
  ['lancome', 'lancome.com'],
  ["lancôme", 'lancome.com'],
]);

function resolveUrl(sellerName: string): string {
  const key    = sellerName.toLowerCase().trim();
  const domain = SELLER_DOMAINS.get(key);
  if (domain) return `https://www.${domain}`;
  // Construct a best-guess domain from the seller name
  return `https://www.${key.replace(/[^a-z0-9]/g, '')}.com`;
}


async function scrapeOnePage(
  page: Page,
  url: string,
  query: string,
  seenSellers: Set<string>,
  limit: number,
): Promise<Array<{ name: string; price: string; href: string; title: string }>> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const raw = await page.evaluate((queryStr: string): Array<{ name: string; price: string; href: string; title: string }> => {
    function hasWrongSize(text: string): boolean {
      const lower = text.toLowerCase();
      for (const m of lower.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?oz\b/g)) {
        if (parseFloat(m[1]) < 3.2 || parseFloat(m[1]) > 3.6) return true;
      }
      for (const m of lower.matchAll(/\b(\d+(?:\.\d+)?)\s*ml\b/g)) {
        if (parseFloat(m[1]) < 90 || parseFloat(m[1]) > 110) return true;
      }
      return false;
    }

    // Decode the real destination URL from a Bing aclick redirect.
    // Bing encodes the actual URL as a base64+URL-encoded 'u' query param.
    function decodeActualUrl(bingHref: string): string {
      try {
        const u = new URL(bingHref).searchParams.get('u');
        if (!u) return bingHref;
        return decodeURIComponent(atob(u));
      } catch { return bingHref; }
    }

    const GENERIC = new Set([
      'eau', 'de', 'toilette', 'parfum', 'cologne', 'fragrance', 'perfume',
      'spray', 'for', 'men', 'mens', 'him', 'women', 'womens', 'her', 'by',
      'the', 'a', 'an', 'edp', 'edt', 'ml', 'oz', 'fl', 'new', 'authentic',
      'genuine', 'sealed', '34', '100', 'ounce', 'fluid',
      // Common compound brand-name words that are not product differentiators
      'christian', 'giorgio', 'yves', 'saint', 'original',
      // Note: variant words like "intense", "noir", "sport", "absolu", "elixir" are
      // intentionally NOT here — they distinguish product lines and must match the query.
    ]);
    const queryWords = queryStr.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);

    function titleMatchesQuery(title: string): boolean {
      // Strip Bing's DOM truncation ellipsis before tokenising.
      const isTruncated = title.endsWith('\u2026');
      const titleClean = isTruncated ? title.slice(0, -1) : title;

      const titleWords = titleClean
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !GENERIC.has(w));

      const specificQueryWords = queryWords.filter(w => !GENERIC.has(w));
      if (!specificQueryWords.length) return true;

      if (isTruncated) {
        // For truncated titles, only require words ≥5 chars — distinctive product
        // identifiers appear near the start; short words may be cut off legitimately.
        const longSpecific = specificQueryWords.filter(w => w.length >= 5);
        if (!longSpecific.length) return true;
        return longSpecific.every(q => titleWords.some(w => w.includes(q) || q.includes(w)));
      }
      // Full titles: every specific word must match.
      return specificQueryWords.every(q => titleWords.some(w => w.includes(q) || q.includes(w)));
    }

    // Bad product-type keywords — checked against BOTH card text AND the real
    // destination URL (decoded from Bing's redirect). The URL is the more
    // reliable signal since sellers often mislabel card text.
    const BAD_PRODUCT_TYPES = /after[\s-]*shave|aftershave|body[\s-]*spray|body[\s-]*lotion|\blotion\b|shower[\s-]*gel|body[\s-]*wash|deodorant|hair[\s-]*mist|body[\s-]*mist|shampoo/i;
    const BAD_PRODUCT_URL   = /after.?shave|aftershave|body.lotion|body.spray|shower.gel|body.wash|hair.mist|deodorant/i;
    const SAMPLE_TYPES      = /\b(sample|sampler|travel[\s-]*spray|travel[\s-]*size|mini|miniature|decant|vial|gift[\s-]*set|discovery[\s-]*set|kit|trial)\b/i;
    const SAMPLE_URL        = /sample|decant|vial|travel[\-_]size|miniature|gift[\-_]set/i;
    const DUPE_TYPES        = /our version of|type\b|inspired by|dupe|fragrance oil|impression of/i;

    const cards: Element[] = Array.from(document.querySelectorAll('.br-gOffCard'));
    const results: Array<{ name: string; price: string; href: string; title: string }> = [];

    for (const card of cards) {
      const priceEl  = card.querySelector('.br-price');
      const sellerEl = card.querySelector('.br-offSlrTxt') ?? card.querySelector('.br-offSlr');
      const linkEl   = card.querySelector('a.br-offLink') as HTMLAnchorElement | null;
      const titleEl  = card.querySelector('.br-offTtl') ?? card.querySelector('[class*="title"]') ?? card.querySelector('h3');

      const price  = priceEl?.textContent?.trim() ?? '';
      const seller = sellerEl?.textContent?.trim() ?? '';
      const href   = linkEl?.href ?? '';
      const title  = titleEl?.textContent?.trim() ?? '';

      if (!price || !price.includes('$') || !seller || !href) continue;

      const cardText  = card.textContent ?? '';
      const actualUrl = decodeActualUrl(href);

      if (hasWrongSize(cardText) || hasWrongSize(title)) continue;
      if (!title || !titleMatchesQuery(title)) continue;
      if (SAMPLE_TYPES.test(cardText) || SAMPLE_TYPES.test(title) || SAMPLE_URL.test(actualUrl)) continue;
      if (DUPE_TYPES.test(cardText)) continue;
      if (BAD_PRODUCT_TYPES.test(cardText) || BAD_PRODUCT_URL.test(actualUrl)) continue;

      results.push({ name: seller, price, href, title });
    }
    return results;
  }, query);

  const out: Array<{ name: string; price: string; href: string; title: string }> = [];
  for (const r of raw) {
    if (out.length >= limit) break;
    if (seenSellers.has(r.name.toLowerCase())) continue;
    seenSellers.add(r.name.toLowerCase());
    out.push(r);
  }
  return out;
}

export async function scrapeBingShopping(query: string, brand?: string, whoisEnabled = false): Promise<ScrapedSeller[]> {
  const url = `https://www.bing.com/shop?q=${encodeURIComponent(`${query} 3.4oz 100ml fragrance`)}`;
  console.log(`[Bing Shopping] Searching: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    const seenSellers = new Set<string>();
    const sellers = await scrapeOnePage(page, url, query, seenSellers, 40);
    console.log(`[Bing Shopping] Found ${sellers.length} sellers`);

    // Compute median price across all results for price-sanity scoring
    const referencePrice = computeReferencePrice(sellers.map(s => s.price));
    console.log(`[Bing Shopping] Reference price: $${referencePrice.toFixed(2)}`);

    // Drop listings whose price is implausibly low vs the median.
    // Floor = 30% of median, with a $20 absolute minimum to catch mislabeled
    // sample/travel vials priced very cheaply but not labelled as such.
    const priceFloor = Math.max(referencePrice * 0.30, 10);
    const plausibleSellers = referencePrice > 0
      ? sellers.filter(s => {
          const p = parseFloat(s.price.replace(/[^0-9.]/g, ''));
          return isNaN(p) || p >= priceFloor;
        })
      : sellers;
    console.log(`[Bing Shopping] After price floor ($${priceFloor.toFixed(2)}): ${plausibleSellers.length} sellers`);

    // Optionally enrich with domain age via RDAP/WHOIS (run in parallel, capped at 5s each)
    const domainAges = new Map<string, number | null>();
    if (whoisEnabled) {
      console.log('[Bing Shopping] Running WHOIS domain-age lookups...');
      await Promise.all(plausibleSellers.map(async s => {
        const resolved = resolveUrl(s.name);
        try {
          const hostname = new URL(resolved).hostname.replace(/^www\./, '');
          const age = await getDomainAgeDays(hostname);
          domainAges.set(s.name, age);
        } catch { /* skip */ }
      }));
    }

    return plausibleSellers.map(s => {
      const resolvedUrl = resolveUrl(s.name);
      const { score, isTrusted } = scoreSellerTrust({
        url:            resolvedUrl,
        price:          s.price,
        brand:          brand ?? query,
        productText:    s.title,
        referencePrice,
        domainAgeDays:  whoisEnabled ? domainAges.get(s.name) : undefined,
      });
      return {
        name:             s.name,
        price:            s.price,
        url:              s.href,
        credibilityScore: score,
        isTrusted,
      };
    });
  } finally {
    await browser.close();
  }
}
