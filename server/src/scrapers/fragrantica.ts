import { chromium } from 'playwright';
import type { ScrapedCologne } from '../types';

const BASE_URL = 'https://www.fragrantica.com';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

// Search Fragrantica — intercept the Algolia response the browser makes
async function searchFragranticaPage(query: string): Promise<{ name: string; brand: string; cologneUrl: string } | null> {
  // Expand abbreviations so "mfk grand soir" gives you "Maison Francis Kurkdjian Grand Soir"
  const expandedQuery = expandAbbreviations(query);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  let bestHit: { name: string; brand: string; cologneUrl: string } | null = null;
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
          bestHit   = { name, brand, cologneUrl: extractHitUrl(hit) };
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
        let bestPartialHit: { name: string; brand: string; cologneUrl: string } | null = null;

        for (const hit of allHits) {
          const name  = String(hit['naslov'] ?? '');
          const brand = String(hit['dizajner'] ?? '');
          if (!name) continue;
          const combined = stripAccents(`${brand} ${name}`).toLowerCase();
          const matchCount = specificWords.filter(w => combined.includes(w)).length;
          if (matchCount > bestPartialCount) {
            bestPartialCount = matchCount;
            bestPartialHit = { name, brand, cologneUrl: extractHitUrl(hit) };
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
    await page.goto(`${BASE_URL}/search/?query=${encodeURIComponent(query)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    // Wait for the Algolia response to come back
    await page.waitForTimeout(8000);
    return bestHit;
  } finally {
    await browser.close();
  }
}

// Detail page scraper from Playright
async function scrapeDetailPage(cologneUrl: string): Promise<{
  overview: string;
  notes: { top: string[]; middle: string[]; base: string[] };
}> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  try {
    await page.goto(cologneUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

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
      const seen = new Set<string>();
      allEls.forEach((el, i) => {
        if (el.tagName !== 'A') return;
        const href = (el as HTMLAnchorElement).href ?? '';
        if (!href.includes('/notes/')) return;
        const noteName = el.textContent?.trim() ?? '';
        if (!noteName || seen.has(noteName) || EXCLUDED.has(noteName.toLowerCase())) return;
        seen.add(noteName);

        // Category = the last heading that appeared before this link in DOM order
        let cat: 'top' | 'middle' | 'base' = 'top'; // default
        if (baseIdx !== -1 && i > baseIdx) cat = 'base';
        else if (midIdx !== -1 && i > midIdx) cat = 'middle';
        else if (topIdx !== -1 && i > topIdx) cat = 'top';

        if (cat === 'top') notesTop.push(noteName);
        else if (cat === 'middle') notesMiddle.push(noteName);
        else notesBase.push(noteName);
      });

      return { overview, notesTop, notesMiddle, notesBase };
    });

    const clean = (arr: string[]) =>
      arr.filter(n => !['notes', 'note', 'ingredients'].includes(n.toLowerCase()) && n.length > 1);

    // Strip the appended notes list Fragrantica concatenates onto the description
    // e.g. "...unique.Top Notes: Bergamot, Saffron Middle Notes: ..."
    const overview = data.overview.replace(/\s*Top Notes?:.*$/is, '').trim();

    return {
      overview,
      notes: { top: clean(data.notesTop), middle: clean(data.notesMiddle), base: clean(data.notesBase) },
    };
  } finally {
    await browser.close();
  }
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

  const { overview, notes } = await scrapeDetailPage(result.cologneUrl);

  return {
    name:     result.name,
    brand:    result.brand,
    overview,
    notes,
    url:      result.cologneUrl,
  };
}
