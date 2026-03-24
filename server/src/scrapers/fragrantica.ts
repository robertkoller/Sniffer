import { chromium } from 'playwright';
import type { ScrapedCologne } from '../types';

const BASE_URL = 'https://www.fragrantica.com';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --------------------------------------------------------------------------
// Search Fragrantica — intercept the Algolia response the browser makes
// --------------------------------------------------------------------------
async function searchFragranticaPage(query: string): Promise<{ name: string; brand: string; cologneUrl: string } | null> {
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
  const queryLower = query.toLowerCase();
  const queryMentionsGender = FEMININE_MARKERS.some(m => queryLower.includes(m));

  // Score how well a hit matches the query — lower is better (fewer extra words)
  // Checks query words against brand+name combined so "Creed Aventus" matches
  // a hit where brand="Creed" and name="Aventus".
  function matchScore(hitName: string, hitBrand: string, q: string): number {
    const queryWords  = q.toLowerCase().trim().split(/\s+/);
    const nameNorm    = hitName.toLowerCase().trim();
    const combined    = `${hitBrand.toLowerCase().trim()} ${nameNorm}`;
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
        const score = matchScore(name, brand, query);
        if (score < bestScore) {
          bestScore = score;
          bestHit   = { name, brand, cologneUrl: extractHitUrl(hit) };
        }
      }

      // If still nothing matched all query words, accept the very first named hit as fallback
      if (!bestHit) {
        const hit = allHits.find(h => String(h['naslov'] ?? ''));
        if (hit) {
          bestHit = { name: String(hit['naslov'] ?? ''), brand: String(hit['dizajner'] ?? ''), cologneUrl: extractHitUrl(hit) };
        }
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

// --------------------------------------------------------------------------
// Detail page — notes & description via Playwright
// --------------------------------------------------------------------------
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

      // Notes — top/middle/base from pyramid sections
      const notesTop: string[] = [];
      const notesMiddle: string[] = [];
      const notesBase: string[] = [];

      const sections: Element[] = Array.from(
        document.querySelectorAll('[class*="pyramid"] > div, [class*="notes"] > div')
      );

      for (const section of sections) {
        const label = section.textContent?.toLowerCase() ?? '';
        const noteLinks: HTMLAnchorElement[] = Array.from(section.querySelectorAll('a[href*="/notes/"]'));
        const names = noteLinks.map(a => a.textContent?.trim() ?? '').filter(Boolean);
        if (label.includes('top') || label.includes('head'))          notesTop.push(...names);
        else if (label.includes('heart') || label.includes('middle')) notesMiddle.push(...names);
        else if (label.includes('base'))                              notesBase.push(...names);
      }

      // Fallback: all note links → top (filter out generic labels)
      const EXCLUDED = new Set(['notes', 'note', 'ingredients']);
      if (!notesTop.length && !notesMiddle.length && !notesBase.length) {
        const seen = new Set<string>();
        (Array.from(document.querySelectorAll('a[href*="/notes/"]')) as HTMLAnchorElement[]).forEach(a => {
          const note = a.textContent?.trim() ?? '';
          if (note && !seen.has(note) && !EXCLUDED.has(note.toLowerCase())) {
            seen.add(note);
            notesTop.push(note);
          }
        });
      }

      // Remove generic labels from any category
      const clean = (arr: string[]) => arr.filter(n => !EXCLUDED.has(n.toLowerCase()) && n.length > 1);

      return { overview, notesTop, notesMiddle, notesBase };
    });

    const clean = (arr: string[]) =>
      arr.filter(n => !['notes', 'note', 'ingredients'].includes(n.toLowerCase()) && n.length > 1);

    return {
      overview: data.overview,
      notes: { top: clean(data.notesTop), middle: clean(data.notesMiddle), base: clean(data.notesBase) },
    };
  } finally {
    await browser.close();
  }
}

// --------------------------------------------------------------------------
// Public entry point
// --------------------------------------------------------------------------
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
