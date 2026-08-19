import type { Page } from 'playwright';
import { getSharedBrowser } from './browser';
import type { ScrapedSeller } from '../types';
import { scoreSellerTrust, computeReferencePrice, isAuthorizedRetailer } from './trustScorer';
import { getDomainAgeDays } from './whoisLookup';
import { resolveListings } from './listingResolver';

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

// Ad-network trackers / redirectors that are never the real store — mirror of the
// set unwrapTrackingUrl() follows inside the page, plus bing.com itself.
const TRACKER_HOSTS = /(^|\.)(bing\.com|dartsearch\.net|xg4ken\.com|agkn\.com|clickcease\.com|clickserve|doubleclick\.net|kenshoo|go\.redirectingat\.com|jdoqocy\.com|dpbolvw\.net|anrdoezrs\.net|tkqlhce\.com)/i;

// The URL to score trust against. Prefer the listing's real (unwrapped) destination
// URL so unknown discounters get judged on their ACTUAL domain — resolveUrl(name)
// only guesses `www.<name>.com`, which is wrong for anyone outside the known map.
// Fall back to the name guess when the href is still a tracker or unparseable.
function scoringUrlFor(href: string, sellerName: string): string {
  try {
    const parsed = new URL(href);
    if (/^https?:$/.test(parsed.protocol) && !TRACKER_HOSTS.test(parsed.hostname)) {
      return href;
    }
  } catch { /* fall through */ }
  return resolveUrl(sellerName);
}

// Build a looser retry query for when the full `brand + name` matches nothing.
// Two things over-constrain niche/clone fragrances: a house brand stores omit
// (Fragrantica "Fragrance World Barakkat Rouge 540" sells as just "Barakkat Rouge
// 540"), and a trailing concentration descriptor. Drop the leading brand and the
// trailing "… Extrait/Eau de Parfum/Toilette" so the core name can still match.
function simplifyQuery(fullQuery: string, brand?: string): string {
  let simplified = fullQuery.trim();
  if (brand) {
    const brandLower = brand.trim().toLowerCase();
    if (brandLower && simplified.toLowerCase().startsWith(brandLower + ' ')) {
      simplified = simplified.slice(brand.trim().length).trim();
    }
  }
  simplified = simplified
    .replace(/\s+(extrait\s+de\s+parfum|eau\s+de\s+parfum|eau\s+de\s+toilette|extrait|parfum|cologne|edp|edt)\s*$/i, '')
    .trim();
  return simplified;
}

// Generic words dropped when deriving a fragrance's distinctive tokens (Node-side
// twin of the in-page GENERIC set, without the size numbers).
const GENERIC_MATCH_TOKENS = new Set([
  'eau', 'de', 'toilette', 'parfum', 'extrait', 'cologne', 'fragrance', 'perfume',
  'spray', 'for', 'men', 'mens', 'women', 'womens', 'unisex', 'by', 'the', 'edp', 'edt',
  'ml', 'oz', 'fl', 'ounce', 'perfumes', 'parfums', 'fragrances',
]);

// The fragrance's own distinctive name tokens (brand prefix + generics stripped) —
// e.g. "Maison Francis Kurkdjian Baccarat Rouge 540" → ["baccarat","rouge","540"].
// Used to gate wave-2 enrichment: a resolved page must still name these, or its
// data is a clone / a bot-block fallback and must not be trusted.
function distinctiveNameTokens(query: string, brand?: string): string[] {
  let namePart = query.trim();
  if (brand) {
    const brandLower = brand.trim().toLowerCase();
    if (brandLower && namePart.toLowerCase().startsWith(brandLower + ' ')) {
      namePart = namePart.slice(brand.trim().length).trim();
    }
  }
  return namePart
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !GENERIC_MATCH_TOKENS.has(word));
}

function resolvedNameMatches(resolvedName: string | null, tokens: string[]): boolean {
  if (!resolvedName || tokens.length === 0) {
    return false;
  }
  const lower = resolvedName.toLowerCase();
  return tokens.every(token => lower.includes(token));
}


async function scrapeOnePage(
  page: Page,
  url: string,
  query: string,
  seenSellers: Set<string>,
  limit: number,
): Promise<Array<{ name: string; price: string; href: string; title: string; sizeOz: number | null }>> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Wait for offer cards to render (they load async); fall through after 12s either way
  await page.waitForSelector('.br-gOffCard', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const raw = await page.evaluate((queryStr: string): Array<{ name: string; price: string; href: string; title: string; sizeOz: number | null }> => {
    // Find a bottle size in oz from any of: title, card text, or the destination
    // URL slug (stores often put "-100-ml" / "-3-4-oz" in the path). Bing truncates
    // titles, so the URL is often the only place the size survives. Null = no size
    // stated anywhere.
    function detectSizeOz(...texts: string[]): number | null {
      for (const raw of texts) {
        if (!raw) continue;
        const lower = raw.toLowerCase().replace(/[_/]+/g, '-');
        const ozMatch = lower.match(/(\d+(?:[.\-]\d+)?)\s*-?\s*(?:fl\.?\s*-?\s*)?oz\b/);
        if (ozMatch) {
          const token = ozMatch[1];
          let value = parseFloat(token.replace('-', '.'));
          // Store URL slugs routinely drop the decimal point ("34-oz" = 3.4 oz,
          // "17-oz" = 1.7). A bare integer larger than any real cologne bottle is a
          // dropped-decimal — restore it so 3.4oz bottles aren't mis-tagged as 34.
          if (!/[.\-]/.test(token) && value > 13) value = value / 10;
          if (!isNaN(value)) return value;
        }
        const mlMatch = lower.match(/(\d+(?:[.\-]\d+)?)\s*-?\s*ml\b/);
        if (mlMatch) {
          const value = parseFloat(mlMatch[1].replace('-', '.'));
          if (!isNaN(value)) return value / 29.5735; // ml -> oz
        }
      }
      return null;
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

    // The decoded "buy" link is usually a merchant ad-network tracker (dartsearch,
    // xg4ken, agkn…) that fails or dead-ends when opened directly. The real store
    // URL is embedded as a param — follow it so the link lands on the product page.
    function unwrapTrackingUrl(startUrl: string): string {
      const DEST_PARAMS = ['ds_dest_url', 'murl', 'l1', 'RU', 'ru', 'url', 'u', 'r', 'landingurl', 'destinationurl'];
      const TRACKER = /(^|\.)(dartsearch\.net|xg4ken\.com|agkn\.com|clickcease\.com|clickserve|doubleclick\.net|kenshoo|go\.redirectingat\.com|jdoqocy\.com|dpbolvw\.net|anrdoezrs\.net|tkqlhce\.com)/i;
      let current = startUrl;
      for (let hop = 0; hop < 5; hop++) {
        let parsed: URL;
        try { parsed = new URL(current); } catch { return current; }
        if (!TRACKER.test(parsed.hostname)) return current;
        let next = '';
        for (const key of DEST_PARAMS) {
          const val = parsed.searchParams.get(key);
          if (val && /^https?:\/\//i.test(val)) { next = val; break; }
        }
        if (!next) {
          for (const [, val] of parsed.searchParams) {
            if (/^https?:\/\//i.test(val)) {
              try { if (!TRACKER.test(new URL(val).hostname)) { next = val; break; } } catch { /* skip */ }
            }
          }
        }
        if (!next) return current;
        current = next;
      }
      return current;
    }

    const GENERIC = new Set([
      'eau', 'de', 'toilette', 'parfum', 'extrait', 'cologne', 'fragrance', 'perfume',
      'spray', 'for', 'men', 'mens', 'him', 'women', 'womens', 'her', 'by',
      'the', 'a', 'an', 'edp', 'edt', 'ml', 'oz', 'fl', 'new', 'authentic',
      'genuine', 'sealed', '34', '100', 'ounce', 'fluid',
      // Brand-suffix noise: Fragrantica says "Lattafa Perfumes"/"... Parfums" but
      // stores drop it, so it must not be a required match word.
      'perfumes', 'parfums', 'fragrances',
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
    const results: Array<{ name: string; price: string; href: string; title: string; sizeOz: number | null }> = [];

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
      const actualUrl = unwrapTrackingUrl(decodeActualUrl(href));

      // Keep every size — breadth is the point. Tag the detected size (from title,
      // card text, or destination URL slug) so the client can filter/label; null
      // means Bing truncated it away and we couldn't tell. Still drop wrong PRODUCTS
      // (samples, dupes, body sprays) and off-fragrance matches.
      if (!title || !titleMatchesQuery(title)) continue;
      if (SAMPLE_TYPES.test(cardText) || SAMPLE_TYPES.test(title) || SAMPLE_URL.test(actualUrl)) continue;
      if (DUPE_TYPES.test(cardText)) continue;
      if (BAD_PRODUCT_TYPES.test(cardText) || BAD_PRODUCT_URL.test(actualUrl)) continue;

      const sizeOz = detectSizeOz(title, cardText, actualUrl);
      results.push({ name: seller, price, href: actualUrl, title, sizeOz });
    }
    return results;
  }, query);

  const out: Array<{ name: string; price: string; href: string; title: string; sizeOz: number | null }> = [];
  for (const r of raw) {
    if (out.length >= limit) break;
    if (seenSellers.has(r.name.toLowerCase())) continue;
    seenSellers.add(r.name.toLowerCase());
    out.push(r);
  }
  return out;
}

export async function scrapeBingShopping(query: string, brand?: string, whoisEnabled = false): Promise<ScrapedSeller[]> {
  // FORM=SHOPTB is required — without it Bing serves an empty "no shopping results" page
  // Some Fragrantica brands carry a suffix stores omit (e.g. "Lattafa Perfumes"
  // sells as just "Lattafa"), which otherwise zeroes out Bing results. Drop a
  // non-leading perfumes/parfums/fragrances word (keep a leading one so
  // "Parfums de Marly ..." survives).
  const cleanedQuery = query
    .split(/\s+/)
    .filter((word, index) => index === 0 || !/^(perfumes|parfums|fragrances)$/i.test(word))
    .join(' ');
  const url = `https://www.bing.com/shop?q=${encodeURIComponent(cleanedQuery)}&FORM=SHOPTB`;
  console.log(`[Bing Shopping] Searching: ${url}`);

  const browser = await getSharedBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  // Mask headless indicators that Bing uses for bot detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();

  try {
    const seenSellers = new Set<string>();
    let sellers = await scrapeOnePage(page, url, cleanedQuery, seenSellers, 40);
    console.log(`[Bing Shopping] Found ${sellers.length} sellers`);

    // Nothing matched — the query is likely over-specified (house brand + a
    // concentration suffix stores drop). Retry once with a looser query.
    if (sellers.length === 0) {
      const simplified = simplifyQuery(cleanedQuery, brand);
      if (simplified && simplified.toLowerCase() !== cleanedQuery.toLowerCase()) {
        const retryUrl = `https://www.bing.com/shop?q=${encodeURIComponent(simplified)}&FORM=SHOPTB`;
        console.log(`[Bing Shopping] 0 results — retrying simplified "${simplified}": ${retryUrl}`);
        seenSellers.clear();
        sellers = await scrapeOnePage(page, retryUrl, simplified, seenSellers, 40);
        console.log(`[Bing Shopping] Retry found ${sellers.length} sellers`);
      }
    }

    // Compute median price across all results for price-sanity scoring
    const referencePrice = computeReferencePrice(sellers.map(s => s.price));

    // Anti-counterfeit floor. Two anchors, whichever is higher:
    //  - Authorized-retailer median: what real premium/brand sellers charge. A
    //    listing far below this is a clone/fake (e.g. a $23 "Baccarat Rouge 540"
    //    against a ~$250 authorized median). This survives clone-dominated result
    //    sets that would otherwise collapse the plain median and let fakes through.
    //  - Plain all-listings median (with a $10 absolute minimum) — the fallback for
    //    fragrances with no authorized sellers at all (e.g. clone-house exclusives),
    //    so those still surface.
    const trustedAnchor = computeReferencePrice(
      sellers.filter(s => isAuthorizedRetailer(scoringUrlFor(s.href, s.name))).map(s => s.price),
    );
    const anchorFloor = trustedAnchor > 0 ? trustedAnchor * 0.30 : 0;
    const medianFloor = referencePrice > 0 ? Math.max(referencePrice * 0.30, 10) : 0;
    const priceFloor  = Math.max(anchorFloor, medianFloor);
    console.log(`[Bing Shopping] Reference $${referencePrice.toFixed(2)} | trusted anchor $${trustedAnchor.toFixed(2)} | floor $${priceFloor.toFixed(2)}`);

    const plausibleSellers = priceFloor > 0
      ? sellers.filter(s => {
          const p = parseFloat(s.price.replace(/[^0-9.]/g, ''));
          return isNaN(p) || p >= priceFloor;
        })
      : sellers;
    console.log(`[Bing Shopping] After price floor ($${priceFloor.toFixed(2)}): ${plausibleSellers.length} sellers`);

    // Wave-2 enrichment (Stage 2): Bing truncates most sizes out of its cards. For
    // the cheapest few unsized listings — the ones a user is most likely to click
    // and most likely to be a mis-sized/clone "deal" — read the real size off the
    // destination page. Only trust it when the page's own product name still names
    // the fragrance (guards against clones and bot-block fallback pages). Capped +
    // concurrency-bounded so it adds one short burst, and the result is cached.
    const nameTokens = distinctiveNameTokens(cleanedQuery, brand);
    const unsized = plausibleSellers
      .filter(s => s.sizeOz == null)
      .sort((a, b) =>
        (parseFloat(a.price.replace(/[^0-9.]/g, '')) || Infinity) -
        (parseFloat(b.price.replace(/[^0-9.]/g, '')) || Infinity))
      .slice(0, 5);
    if (unsized.length > 0) {
      const resolved = await resolveListings(unsized.map(s => s.href), 5);
      let filled = 0;
      unsized.forEach((seller, index) => {
        const listing = resolved[index];
        if (listing.sizeOz != null && resolvedNameMatches(listing.productName, nameTokens)) {
          seller.sizeOz = listing.sizeOz;
          filled++;
        }
      });
      console.log(`[Bing Shopping] Wave-2 resolved ${filled}/${unsized.length} unknown sizes from destination pages`);
    }

    // Optionally enrich with domain age via RDAP/WHOIS (run in parallel, capped at 5s each).
    // Look up the REAL destination host, not a guess from the seller name.
    const domainAges = new Map<string, number | null>();
    if (whoisEnabled) {
      console.log('[Bing Shopping] Running WHOIS domain-age lookups...');
      await Promise.all(plausibleSellers.map(async s => {
        try {
          const hostname = new URL(scoringUrlFor(s.href, s.name)).hostname.replace(/^www\./, '');
          const age = await getDomainAgeDays(hostname);
          domainAges.set(s.name, age);
        } catch { /* skip */ }
      }));
    }

    return plausibleSellers.map(s => {
      const { score, isTrusted } = scoreSellerTrust({
        url:            scoringUrlFor(s.href, s.name),
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
        sizeOz:           s.sizeOz,
      };
    });
  } finally {
    await context.close();
  }
}
