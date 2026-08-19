import axios from 'axios';

// Stage 2 "fluid resolver": given a store product URL, read the real size, price,
// and product identity straight from the page's own metadata (JSON-LD, og:title,
// <title>) instead of trusting Bing's truncated card. This fills the sizeOz gap
// left by the Bing scrape and, because the page names the actual brand, gives a
// second line of defense against clones stuffing a famous name into their listing.
//
// Deliberately lightweight: a single axios GET + string parsing, not a Playwright
// nav. Most stores server-render this metadata, and this keeps the 1GB box cheap.
// Pages that need JS / bot bypass simply resolve to nulls (no regression).

export interface ResolvedListing {
  sizeOz: number | null;      // detected bottle size, null if unreadable
  price: string | null;       // page's own price, e.g. "$219.95"
  productName: string | null; // page's product name (carries the real brand)
}

const RESOLVER_TIMEOUT_MS = 7000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Node-side twin of bingShopping's detectSizeOz (kept in sync): read a bottle size
// in oz from any text, restoring decimals that store slugs/titles drop ("34 oz" =
// 3.4). Null when no size is stated.
export function detectSizeOz(...texts: Array<string | null | undefined>): number | null {
  for (const raw of texts) {
    if (!raw) {
      continue;
    }
    const lower = raw.toLowerCase().replace(/[_/]+/g, '-');
    const ozMatch = lower.match(/(\d+(?:[.\-]\d+)?)\s*-?\s*(?:fl\.?\s*-?\s*)?oz\b/);
    if (ozMatch) {
      const token = ozMatch[1];
      let value = parseFloat(token.replace('-', '.'));
      if (!/[.\-]/.test(token) && value > 13) {
        value = value / 10;
      }
      if (!isNaN(value)) {
        return value;
      }
    }
    const mlMatch = lower.match(/(\d+(?:[.\-]\d+)?)\s*-?\s*ml\b/);
    if (mlMatch) {
      const value = parseFloat(mlMatch[1].replace('-', '.'));
      if (!isNaN(value)) {
        return value / 29.5735;
      }
    }
  }
  return null;
}

// Decode the handful of HTML entities that show up in scraped metadata.
function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Walk a parsed JSON-LD value (object, array, or {@graph:[…]}) for the first
// node that looks like a Product, returning its name/description/price.
function findProductNode(node: unknown): { name?: string; description?: string; price?: string } | null {
  if (!node || typeof node !== 'object') {
    return null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductNode(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  const record = node as Record<string, unknown>;
  if (Array.isArray(record['@graph'])) {
    const found = findProductNode(record['@graph']);
    if (found) {
      return found;
    }
  }
  const type = record['@type'];
  const isProduct = typeof type === 'string'
    ? /product/i.test(type)
    : Array.isArray(type) && type.some(t => typeof t === 'string' && /product/i.test(t));
  if (isProduct) {
    let offer = record['offers'];
    if (Array.isArray(offer)) {
      offer = offer[0];
    }
    const price = offer && typeof offer === 'object'
      ? (offer as Record<string, unknown>)['price']
      : undefined;
    return {
      name: typeof record['name'] === 'string' ? record['name'] : undefined,
      description: typeof record['description'] === 'string' ? record['description'] : undefined,
      price: price != null ? String(price) : undefined,
    };
  }
  return null;
}

function extractFromHtml(html: string, url: string): ResolvedListing {
  let productName: string | null = null;
  let priceNumber: string | null = null;

  for (const match of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1].trim());
    } catch {
      continue;
    }
    const product = findProductNode(parsed);
    if (product) {
      if (product.name && !productName) {
        productName = decodeEntities(product.name);
      }
      if (product.price && !priceNumber) {
        priceNumber = product.price;
      }
      if (productName && priceNumber) {
        break;
      }
    }
  }

  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogTitle = ogTitleMatch ? decodeEntities(ogTitleMatch[1]) : null;
  const pageTitle = titleMatch ? decodeEntities(titleMatch[1]) : null;

  // Look for a JSON-LD description too (size sometimes only lives there).
  const ldDescMatch = html.match(/"description"\s*:\s*"([^"]{0,300})"/i);
  const ldDesc = ldDescMatch ? decodeEntities(ldDescMatch[1]) : null;

  const sizeOz = detectSizeOz(productName, ogTitle, pageTitle, ldDesc, url);

  let price: string | null = null;
  if (priceNumber) {
    const numeric = parseFloat(priceNumber.replace(/[^0-9.]/g, ''));
    if (!isNaN(numeric) && numeric > 0) {
      price = `$${numeric.toFixed(2)}`;
    }
  }

  return { sizeOz, price, productName: productName ?? ogTitle ?? pageTitle };
}

// Fetch one listing and read its metadata. Never throws — an unreadable/blocked
// page resolves to all-nulls so callers can leave the Bing card data as-is.
export async function resolveListing(url: string): Promise<ResolvedListing> {
  try {
    const response = await axios.get<string>(url, {
      timeout: RESOLVER_TIMEOUT_MS,
      maxRedirects: 5,
      responseType: 'text',
      // Cap the body so a giant page can't blow memory on the 1GB box.
      maxContentLength: 3 * 1024 * 1024,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      validateStatus: status => status >= 200 && status < 400,
    });
    if (typeof response.data !== 'string') {
      return { sizeOz: null, price: null, productName: null };
    }
    return extractFromHtml(response.data, url);
  } catch {
    return { sizeOz: null, price: null, productName: null };
  }
}

// Resolve many listings with bounded concurrency so wave-2 enrichment can't stall
// a request or hammer the box. Returns results in the same order as the input.
export async function resolveListings(urls: string[], concurrency = 6): Promise<ResolvedListing[]> {
  const results: ResolvedListing[] = new Array(urls.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < urls.length) {
      const index = cursor++;
      results[index] = await resolveListing(urls[index]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
