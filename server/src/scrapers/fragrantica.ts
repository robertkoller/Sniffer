import axios from 'axios';
import type { ScrapedCologne } from '../types';
import { getSharedBrowser } from './browser';

const BASE_URL = 'https://www.fragrantica.com';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Wait for intercepted results instead of sleeping a fixed 8s: polls until the
// condition holds, then gives a short grace window for stragglers.
async function waitForResults(check: () => boolean, maxWaitMs: number, graceMs = 700): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (check()) {
      await delay(graceMs);
      return;
    }
    await delay(250);
  }
}

// Fragrantica's image CDN allows hotlinking; images follow a fixed id-based pattern.
function imageUrlForPerfumeId(id: unknown): string | undefined {
  const numericId = String(id ?? '').replace(/[^0-9]/g, '');
  return numericId ? `https://fimgs.net/mdimg/perfume/375x500.${numericId}.jpg` : undefined;
}

// Common fragrance brand abbreviations users type that don't match Fragrantica's full brand names
const BRAND_ALIASES: Record<string, string> = {
  'mfk':  'maison francis kurkdjian',
  'tf':   'tom ford',
  'cdg':  'comme des garcons',
  'ysl':  'yves saint laurent',
  'jo malone': 'jo malone london',
  'mm':   'maison margiela',
  'adp':  'acqua di parma',
  'lb':   'le labo',
  'jpg':  'jean paul gaultier',
  'pdm':  'parfums de marly',
  'adg':  'giorgio armani acqua di gio',
  'd&g':  'dolce gabbana',
  'ck':   'calvin klein',
  'ch':   'carolina herrera',
};

function expandAbbreviations(query: string): string {
  // Strip accents first so "mfk baccarat rougé" → "mfk baccarat rouge" before alias check
  let q = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  for (const [abbr, full] of Object.entries(BRAND_ALIASES)) {
    const re = new RegExp(`\\b${abbr}\\b`, 'g');
    q = q.replace(re, full);
  }
  return q;
}

export interface FragranceSuggestion {
  id: string;
  name: string;
  brand: string;
  year?: number;
  gender?: string;
  thumbnail?: string;
  imageUrl?: string;
  url: string;
}

// Fragrantica's search is powered by Algolia. Rather than drive a whole headless
// browser just to intercept that one request (~10s), we call the Algolia REST API
// directly (~200-500ms). The catch: Fragrantica's front-end key is a *secured*,
// time-limited key (it base64-decodes to `...validUntil=<epoch>`), so we harvest
// the current one from their page occasionally and refresh it before it expires
// or when Algolia rejects it. The browser scrape stays as a fallback.
const ALGOLIA_INDEX = 'fragrantica_perfumes';
const ALGOLIA_ATTRS = ['naslov', 'dizajner', 'godina', 'id', 'slug', 'thumbnail', 'spol'];

interface AlgoliaCreds { appId: string; apiKey: string; index: string; validUntil: number; }
let algoliaCreds: AlgoliaCreds | null = null;

// Secured Algolia keys base64-decode to a string ending in `validUntil=<epoch>`.
function decodeValidUntil(apiKey: string): number {
  try {
    const decoded = Buffer.from(apiKey, 'base64').toString('utf8');
    const match = decoded.match(/validUntil=(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

// Load a Fragrantica search page in the shared browser and capture the Algolia
// request its front-end fires, pulling appId/key/index off it.
async function harvestAlgoliaCreds(): Promise<AlgoliaCreds> {
  const browser = await getSharedBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();
  let found: AlgoliaCreds | null = null;

  page.on('request', request => {
    if (found || request.method() !== 'POST' || !request.url().includes('algolia.net')) return;
    try {
      const url = new URL(request.url());
      const apiKey = url.searchParams.get('x-algolia-api-key') ?? '';
      const appId = (url.searchParams.get('x-algolia-application-id') ?? '').toUpperCase();
      const body = JSON.parse(request.postData() ?? '{}') as { requests?: Array<{ indexName?: string }> };
      const index = body.requests?.[0]?.indexName ?? ALGOLIA_INDEX;
      if (apiKey && appId) {
        found = { appId, apiKey, index, validUntil: decodeValidUntil(apiKey) };
      }
    } catch {
      // Not the request we want — ignore.
    }
  });

  try {
    await page.goto(`${BASE_URL}/search/?query=aventus`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForResults(() => found !== null, 8000);
  } finally {
    await context.close();
  }

  if (!found) throw new Error('Could not harvest Algolia credentials from Fragrantica');
  const credentials = found as AlgoliaCreds;
  console.log(`[Algolia] Harvested key for ${credentials.appId}/${credentials.index} (valid until ${new Date(credentials.validUntil * 1000).toISOString()})`);
  return credentials;
}

// Cached creds, refreshed a day before expiry (or on demand after a rejection).
async function getAlgoliaCreds(forceRefresh = false): Promise<AlgoliaCreds> {
  const nowSec = Math.floor(Date.now() / 1000);
  const stale = !algoliaCreds || algoliaCreds.validUntil - nowSec < 86400;
  if (forceRefresh || stale) {
    algoliaCreds = await harvestAlgoliaCreds();
  }
  return algoliaCreds!;
}

// The fast path: query Algolia over HTTP with the harvested key.
async function suggestViaAlgolia(query: string, limit: number): Promise<FragranceSuggestion[]> {
  const expandedQuery = expandAbbreviations(query);

  async function runQuery(creds: AlgoliaCreds): Promise<Array<Record<string, unknown>>> {
    const params = new URLSearchParams({
      attributesToRetrieve: JSON.stringify(ALGOLIA_ATTRS),
      hitsPerPage: '60',
      query: expandedQuery,
    }).toString();
    const response = await axios.post(
      `https://${creds.appId.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries`,
      { requests: [{ indexName: creds.index, params }] },
      {
        headers: {
          'x-algolia-api-key': creds.apiKey,
          'x-algolia-application-id': creds.appId,
          'content-type': 'application/json',
        },
        timeout: 8000,
      },
    );
    const data = response.data as { results?: Array<{ hits?: Array<Record<string, unknown>> }> };
    return data.results?.[0]?.hits ?? [];
  }

  let creds = await getAlgoliaCreds();
  let hits: Array<Record<string, unknown>>;
  try {
    hits = await runQuery(creds);
  } catch (err) {
    // 401/403 means the key rotated out from under us — re-harvest once and retry.
    if (axios.isAxiosError(err) && (err.response?.status === 403 || err.response?.status === 401)) {
      creds = await getAlgoliaCreds(true);
      hits = await runQuery(creds);
    } else {
      throw err;
    }
  }

  const seenIds = new Set<string>();
  const suggestions: FragranceSuggestion[] = [];
  for (const hit of hits) {
    const id = String(hit['objectID'] ?? hit['id'] ?? '');
    const name = String(hit['naslov'] ?? '');
    const brand = String(hit['dizajner'] ?? '');
    if (!id || !name || seenIds.has(id)) continue;
    seenIds.add(id);
    const slug = hit['slug'] as string | undefined;
    suggestions.push({
      id,
      name,
      brand,
      year: typeof hit['godina'] === 'number' ? hit['godina'] as number : undefined,
      gender: typeof hit['spol'] === 'string' ? hit['spol'] as string : undefined,
      thumbnail: typeof hit['thumbnail'] === 'string' ? hit['thumbnail'] as string : undefined,
      imageUrl: imageUrlForPerfumeId(id),
      url: slug ? `${BASE_URL}/perfume/${slug}-${id}.html` : `${BASE_URL}/search/?query=${encodeURIComponent(name)}`,
    });
    if (suggestions.length >= limit) break;
  }
  return suggestions;
}

// Public entry point: try the fast Algolia HTTP path, fall back to the browser
// scrape if it fails (key unharvestable, network, zero hits).
export async function suggestFragrantica(query: string, limit = 12): Promise<FragranceSuggestion[]> {
  try {
    const viaAlgolia = await suggestViaAlgolia(query, limit);
    if (viaAlgolia.length > 0) return viaAlgolia;
    console.warn('[Fragrantica] Algolia returned 0 hits; falling back to browser scrape');
  } catch (err) {
    console.warn('[Fragrantica] Algolia suggest failed; falling back to browser scrape:', (err as Error).message);
  }
  return suggestFragranticaViaBrowser(query, limit);
}

// Lightweight multi-result search via the browser: load the Fragrantica search
// page once and return the Algolia hits in relevance order. Fallback for the
// direct-HTTP path above.
async function suggestFragranticaViaBrowser(query: string, limit = 12): Promise<FragranceSuggestion[]> {
  const expandedQuery = expandAbbreviations(query);
  console.log(`[Fragrantica] Suggesting for: "${expandedQuery}"`);

  const browser = await getSharedBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  const seenIds = new Set<string>();
  const suggestions: FragranceSuggestion[] = [];

  page.on('response', async response => {
    if (!response.url().includes('algolia.net')) return;
    try {
      const json = await response.json() as {
        results?: Array<{ hits?: Array<Record<string, unknown>> }>;
        hits?: Array<Record<string, unknown>>;
      };
      const allHits: Array<Record<string, unknown>> = [];
      if (json?.results?.length) {
        for (const result of json.results) {
          if (result.hits?.length) allHits.push(...result.hits);
        }
      } else if (json?.hits?.length) {
        allHits.push(...json.hits);
      }

      for (const hit of allHits) {
        const id = String(hit['objectID'] ?? hit['id'] ?? '');
        const name = String(hit['naslov'] ?? '');
        const brand = String(hit['dizajner'] ?? '');
        if (!id || !name || seenIds.has(id)) continue;
        seenIds.add(id);

        const slug = hit['slug'] as string | undefined;
        suggestions.push({
          id,
          name,
          brand,
          year: typeof hit['godina'] === 'number' ? hit['godina'] as number : undefined,
          gender: typeof hit['spol'] === 'string' ? hit['spol'] as string : undefined,
          thumbnail: typeof hit['thumbnail'] === 'string' ? hit['thumbnail'] as string : undefined,
          imageUrl: imageUrlForPerfumeId(id),
          url: slug ? `${BASE_URL}/perfume/${slug}-${id}.html` : `${BASE_URL}/search/?query=${encodeURIComponent(name)}`,
        });
      }
    } catch {
      // Not a search response — ignore
    }
  });

  try {
    await page.goto(`${BASE_URL}/search/?query=${encodeURIComponent(expandedQuery)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await waitForResults(() => suggestions.length >= 3, 8000);
    return suggestions.slice(0, limit);
  } finally {
    await context.close();
  }
}

// Search Fragrantica — intercept the Algolia response the browser makes
async function searchFragranticaPage(query: string): Promise<{ name: string; brand: string; cologneUrl: string; imageUrl?: string } | null> {
  // Expand abbreviations so "mfk grand soir" gives you "Maison Francis Kurkdjian Grand Soir"
  const expandedQuery = expandAbbreviations(query);

  const browser = await getSharedBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  let bestHit: { name: string; brand: string; cologneUrl: string; imageUrl?: string } | null = null;
  let bestScore = Infinity;

  // Gendered suffixes that indicate a women's/unisex variant
  const FEMININE_MARKERS = ['for her', 'for women', 'femme', 'pour femme', 'woman', 'women'];
  const queryLower = expandedQuery.toLowerCase();
  const queryMentionsGender = FEMININE_MARKERS.some(m => queryLower.includes(m));

  // Strip diacritics so "vanillé" matches "vanille", "lancôme" matches "lancome", etc.
  function stripAccents(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // Score how well a hit matches the query — lower is better (fewer extra words)
  // Checks query words against brand+name combined so "Creed Aventus" matches
  // a hit where brand="Creed" and name="Aventus".
  function matchScore(hitName: string, hitBrand: string, q: string): number {
    const queryWords  = stripAccents(q).toLowerCase().trim().split(/\s+/);
    const nameNorm    = stripAccents(hitName).toLowerCase().trim();
    const combined    = `${stripAccents(hitBrand).toLowerCase().trim()} ${nameNorm}`;
    // All query words must appear somewhere in brand+name
    if (!queryWords.every(w => combined.includes(w))) return Infinity;
    // Score = extra words in the name beyond the query (prefer shorter/exact names)
    const nameWords = nameNorm.split(/\s+/);
    let score = nameWords.length - queryWords.length;
    // Heavy penalty for feminine variants when the query doesn't mention gender
    if (!queryMentionsGender && FEMININE_MARKERS.some(m => nameNorm.includes(m))) {
      score += 100;
    }
    return score;
  }

  function extractHitUrl(hit: Record<string, unknown>): string {
    // Fragrantica removed the 'url' field from Algolia hits.
    // The current format is slug="Dior/Sauvage" + id=31861
    // → https://www.fragrantica.com/perfume/Dior/Sauvage-31861.html
    const slug = hit['slug'] as string | undefined;
    const id   = hit['id'] ?? hit['objectID'];
    if (slug && id) return `${BASE_URL}/perfume/${slug}-${id}.html`;

    // Legacy fallback for the old url.EN format (kept in case it ever returns)
    const urlField = hit['url'] as Record<string, string | string[]> | string | undefined;
    const enField  = typeof urlField === 'object' ? urlField?.['EN'] : urlField;
    const rawUrl   = Array.isArray(enField) ? (enField[0] ?? '') : (enField ?? '');
    return rawUrl.startsWith('http') ? rawUrl : `${BASE_URL}${rawUrl}`;
  }

  // Process ALL Algolia responses — Fragrantica sends multiple (different indexes).
  // Keep updating bestHit across responses so the globally best match wins.
  page.on('response', async response => {
    if (!response.url().includes('algolia.net')) return;
    try {
      const json = await response.json() as {
        results?: Array<{ hits?: Array<Record<string, unknown>> }>;
        hits?: Array<Record<string, unknown>>;
      };

      // Flatten hits from ALL result indexes in this response
      const allHits: Array<Record<string, unknown>> = [];
      if (json?.results?.length) {
        for (const result of json.results) {
          if (result.hits?.length) allHits.push(...result.hits);
        }
      } else if (json?.hits?.length) {
        allHits.push(...json.hits);
      }
      if (!allHits.length) return;

      for (const hit of allHits) {
        const name  = String(hit['naslov'] ?? '');
        const brand = String(hit['dizajner'] ?? '');
        if (!name) continue;
        const score = matchScore(name, brand, expandedQuery);
        if (score < bestScore) {
          bestScore = score;
          bestHit   = {
            name,
            brand,
            cologneUrl: extractHitUrl(hit),
            imageUrl: imageUrlForPerfumeId(hit['objectID'] ?? hit['id']),
          };
        }
      }

      // Partial fallback: if nothing matched all query words, find the hit that
      // matches the most query words — but only if at least one SPECIFIC word
      // (not a generic fragrance term) matches. Prevents "teriaq intense" → "J'adore Intense".
      if (!bestHit) {
        const GENERIC_WORDS = new Set([
          'intense', 'eau', 'de', 'parfum', 'toilette', 'cologne', 'fragrance',
          'perfume', 'for', 'men', 'women', 'homme', 'femme', 'noir', 'bleu',
          'blue', 'black', 'white', 'gold', 'rose', 'sport', 'sport', 'edition',
        ]);
        const qWords = expandedQuery.toLowerCase().trim().split(/\s+/);
        const specificWords = qWords.filter(w => w.length > 2 && !GENERIC_WORDS.has(w));

        let bestPartialCount = 0;
        let bestPartialHit: { name: string; brand: string; cologneUrl: string; imageUrl?: string } | null = null;

        for (const hit of allHits) {
          const name  = String(hit['naslov'] ?? '');
          const brand = String(hit['dizajner'] ?? '');
          if (!name) continue;
          const combined = stripAccents(`${brand} ${name}`).toLowerCase();
          const matchCount = specificWords.filter(w => combined.includes(w)).length;
          if (matchCount > bestPartialCount) {
            bestPartialCount = matchCount;
            bestPartialHit = {
              name,
              brand,
              cologneUrl: extractHitUrl(hit),
              imageUrl: imageUrlForPerfumeId(hit['objectID'] ?? hit['id']),
            };
          }
        }

        // Only accept if at least one specific word matched
        if (bestPartialCount > 0) bestHit = bestPartialHit;
      }
    } catch {
      // Not JSON or not a search response — ignore
    }
  });

  try {
    // Search with the expanded query so aliases like "jpg" actually reach Fragrantica
    await page.goto(`${BASE_URL}/search/?query=${encodeURIComponent(expandedQuery)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    // Wait for the Algolia response — exit early once a match lands
    await waitForResults(() => bestHit !== null, 8000);
    return bestHit;
  } finally {
    await context.close();
  }
}

// Detail page scraper from Playwright
async function scrapeDetailPage(cologneUrl: string): Promise<{
  overview: string;
  notes: { top: string[]; middle: string[]; base: string[] };
  noteImages: Record<string, string>;
}> {
  const browser = await getSharedBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  try {
    await page.goto(cologneUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Poll for real note links (e.g. /notes/Bergamot-75.html) rather than a fixed
    // sleep. The bare "/notes/" category link is in the static HTML immediately, so
    // we must wait specifically for the note pyramid's individual note links.
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const realNoteCount = await page.evaluate(
        () => Array.from(document.querySelectorAll('a[href*="/notes/"]'))
          .filter(a => /\/notes\/.+-\d+\.html/.test((a as HTMLAnchorElement).href)).length,
      ).catch(() => 0);
      if (realNoteCount > 0) {
        break;
      }
      await delay(250);
    }

    const data = await page.evaluate(() => {
      // Overview
      const overviewEl = document.querySelector('[itemprop="description"]')
        ?? document.querySelector('.fragrantica-description')
        ?? document.querySelector('p.description');
      const overview = overviewEl?.textContent?.trim() ?? '';

      // Notes — classify by DOM position relative to "Top / Heart / Base" headings.
      // This avoids relying on class names that change with Fragrantica redesigns.
      const notesTop: string[] = [];
      const notesMiddle: string[] = [];
      const notesBase: string[] = [];
      const EXCLUDED = new Set(['notes', 'note', 'ingredients']);

      // Get ALL elements in document order so we can compare positions by index.
      const allEls: Element[] = Array.from(document.body.querySelectorAll('*'));

      // Find the DOM index of heading elements that mark each category.
      // Only look at small elements (few children) so we don't match large containers.
      let topIdx = -1, midIdx = -1, baseIdx = -1;
      allEls.forEach((el, i) => {
        if (el.children.length > 10) return;
        const t = (el.textContent ?? '').trim().toLowerCase();
        if (/^top\s*notes?$/.test(t) || t === 'top') {
          if (topIdx === -1) topIdx = i;
        } else if (/^(heart|middle)\s*notes?$/.test(t) || t === 'heart' || t === 'middle') {
          if (midIdx === -1) midIdx = i;
        } else if (/^base\s*notes?$/.test(t) || t === 'base') {
          if (baseIdx === -1) baseIdx = i;
        }
      });

      // Assign each note link to a category based on which heading last preceded it.
      // Also grab each note's thumbnail image (Fragrantica renders one per link).
      const seen = new Set<string>();
      const noteImages: Record<string, string> = {};
      allEls.forEach((el, i) => {
        if (el.tagName !== 'A') return;
        const href = (el as HTMLAnchorElement).href ?? '';
        if (!href.includes('/notes/')) return;
        const noteName = el.textContent?.trim() ?? '';
        if (!noteName || seen.has(noteName) || EXCLUDED.has(noteName.toLowerCase())) return;
        seen.add(noteName);

        const imgEl = (el.querySelector('img') ?? el.parentElement?.querySelector('img')) as HTMLImageElement | null;
        if (imgEl?.src && imgEl.src.startsWith('http')) {
          noteImages[noteName] = imgEl.src;
        }

        // Category = the last heading that appeared before this link in DOM order
        let cat: 'top' | 'middle' | 'base' = 'top'; // default
        if (baseIdx !== -1 && i > baseIdx) cat = 'base';
        else if (midIdx !== -1 && i > midIdx) cat = 'middle';
        else if (topIdx !== -1 && i > topIdx) cat = 'top';

        if (cat === 'top') notesTop.push(noteName);
        else if (cat === 'middle') notesMiddle.push(noteName);
        else notesBase.push(noteName);
      });

      return { overview, notesTop, notesMiddle, notesBase, noteImages };
    });

    const clean = (arr: string[]) =>
      arr.filter(n => !['notes', 'note', 'ingredients'].includes(n.toLowerCase()) && n.length > 1);

    // Strip the appended notes list Fragrantica concatenates onto the description
    // e.g. "...unique.Top Notes: Bergamot, Saffron Middle Notes: ..."
    const overview = data.overview.replace(/\s*Top Notes?:.*$/is, '').trim();

    return {
      overview,
      notes: { top: clean(data.notesTop), middle: clean(data.notesMiddle), base: clean(data.notesBase) },
      noteImages: data.noteImages,
    };
  } finally {
    await context.close();
  }
}

// Detail-only scrape for when the fragrance page URL is already known
// (e.g. from a /api/suggest hit) — skips the search step entirely.
export async function scrapeFragranticaDetail(cologneUrl: string): Promise<{
  overview: string;
  notes: { top: string[]; middle: string[]; base: string[] };
  noteImages: Record<string, string>;
}> {
  return scrapeDetailPage(cologneUrl);
}

// Public entry point for scraping Fragrantica — returns null if no good match found
export async function scrapeFragrantica(query: string): Promise<ScrapedCologne> {
  console.log(`[Fragrantica] Searching for: "${query}"`);
  const result = await searchFragranticaPage(query);

  if (!result) {
    throw new Error(`No Fragrantica results found for: "${query}"`);
  }

  console.log(`[Fragrantica] Found: ${result.brand} - ${result.name} → ${result.cologneUrl}`);
  await delay(500);

  const { overview, notes, noteImages } = await scrapeDetailPage(result.cologneUrl);

  return {
    name:     result.name,
    brand:    result.brand,
    overview,
    notes,
    noteImages,
    url:      result.cologneUrl,
    imageUrl: result.imageUrl,
  };
}
