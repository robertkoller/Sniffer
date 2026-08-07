import { Router, Request, Response } from 'express';
import { getCologneBySlug, getCologneRowBySlug, saveCologneWithSellers, updateSellersForCologne } from '../db';
import { scrapeFragrantica, scrapeFragranticaDetail, suggestFragrantica, type FragranceSuggestion } from '../scrapers/fragrantica';
import { scrapeBingShopping } from '../scrapers/bingShopping';
import { scrapeAllSites } from '../scrapers/siteScrapers';
import { identifyFromGoogleLens } from '../scrapers/googleLens';
import { generateSlug, canonicalSlug } from '../utils/slug';
import { whoisEnabled } from '../utils/flags';
import { profileForRequest } from './profile';
import type { ScrapedSeller } from '../types';

const router = Router();

function saveAndRespond(
  res: Response,
  cologne: { name: string; brand: string; overview: string; notes: { top: string[]; middle: string[]; base: string[] }; url: string; imageUrl?: string; noteImages?: Record<string, string> },
  sellers: ScrapedSeller[],
  querySlug: string,
) {
  const slug = canonicalSlug(cologne.brand, cologne.name);
  const colognePayload = {
    name:            cologne.name,
    brand:           cologne.brand,
    overview:        cologne.overview,
    notes:           cologne.notes,
    fragrantica_url: cologne.url,
    image_url:       cologne.imageUrl ?? null,
    note_images:     cologne.noteImages ? JSON.stringify(cologne.noteImages) : null,
  };
  const result = saveCologneWithSellers(slug, colognePayload, sellers);
  if (slug !== querySlug) saveCologneWithSellers(querySlug, colognePayload, sellers);
  res.json(result);
}

// Merge seller arrays — deduplicate by lowercased name, earlier lists win on conflict.
function mergeSellers(...lists: ScrapedSeller[][]): ScrapedSeller[] {
  const seen = new Set<string>();
  const result: ScrapedSeller[] = [];
  for (const list of lists) {
    for (const seller of list) {
      const key = seller.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(seller);
      }
    }
  }
  return result;
}

// GET /api/suggest?q=jpg — fast multi-result search (identity + image only).
// Results come straight from Fragrantica's search index; cached in memory.
const suggestCache = new Map<string, { expiresAt: number; suggestions: FragranceSuggestion[] }>();
const SUGGEST_CACHE_TTL_MS = 30 * 60 * 1000;

// Stable-sort suggestions by the user's gender preference: preferred gender
// first, unisex next, opposite last. Relevance order is preserved within groups.
function orderByProfile(suggestions: FragranceSuggestion[], preference: 'men' | 'women' | 'all'): FragranceSuggestion[] {
  if (preference === 'all') {
    return suggestions;
  }
  const preferred = preference === 'men' ? 'male' : 'female';
  const opposite  = preference === 'men' ? 'female' : 'male';

  function genderRank(gender?: string): number {
    if (gender === preferred) return 0;
    if (gender === 'unisex')  return 1;
    if (gender === opposite)  return 3;
    return 2;
  }

  return suggestions
    .map((suggestion, index) => ({ suggestion, index }))
    .sort((a, b) =>
      genderRank(a.suggestion.gender) - genderRank(b.suggestion.gender) || a.index - b.index)
    .map(entry => entry.suggestion);
}

router.get('/suggest', async (req: Request, res: Response) => {
  const raw = (req.query.q as string)?.trim() ?? '';
  const query = raw.replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!query) {
    res.status(400).json({ error: 'Missing query parameter: q' });
    return;
  }
  if (query.length > 120) {
    res.status(400).json({ error: 'Query too long (max 120 characters).' });
    return;
  }

  const preference = profileForRequest(req).genderPreference;
  const cached = suggestCache.get(query);
  if (cached && cached.expiresAt > Date.now()) {
    res.json({ suggestions: orderByProfile(cached.suggestions, preference) });
    return;
  }

  try {
    const suggestions = await suggestFragrantica(query, 12);
    suggestCache.set(query, { expiresAt: Date.now() + SUGGEST_CACHE_TTL_MS, suggestions });
    res.json({ suggestions: orderByProfile(suggestions, preference) });
  } catch (err) {
    console.error('[Suggest] Failed:', err);
    res.status(502).json({ error: 'Suggestion search failed. Try again shortly.' });
  }
});

// GET /api/info?q=<name> [&url=<fragrantica url>&brand=&name=&image=]
// Lightweight fragrance info for Sniffy: identity, notes, overview, image.
// NO seller scraping — that's the website's job. When url/brand/name come from
// a /api/suggest hit, the Fragrantica search step is skipped entirely (~5s).
router.get('/info', async (req: Request, res: Response) => {
  const rawQuery = ((req.query.q as string) ?? '').replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim();
  const hintUrl   = ((req.query.url as string) ?? '').trim();
  const hintBrand = ((req.query.brand as string) ?? '').trim();
  const hintName  = ((req.query.name as string) ?? '').trim();
  const hintImage = ((req.query.image as string) ?? '').trim();

  const hasHints = hintUrl.startsWith('https://www.fragrantica.com/') && hintBrand && hintName;
  if (!rawQuery && !hasHints) {
    res.status(400).json({ error: 'Missing query parameter: q' });
    return;
  }
  if (rawQuery.length > 120) {
    res.status(400).json({ error: 'Query too long (max 120 characters).' });
    return;
  }

  function respondInfo(details: { name: string; brand: string; overview: string; imageUrl?: string; notes: { top: string[]; middle: string[]; base: string[] }; noteImages?: Record<string, string> }) {
    res.json({
      name:       details.name,
      brand:      details.brand,
      overview:   details.overview,
      imageUrl:   details.imageUrl,
      notes:      details.notes,
      noteImages: details.noteImages,
    });
  }

  // Cache check — by canonical slug when hints identify the fragrance, else by query slug
  const lookupSlug = hasHints ? canonicalSlug(hintBrand, hintName) : generateSlug(rawQuery);
  const cached = getCologneBySlug(lookupSlug);
  if (cached) {
    console.log(`[Info] Cache hit for "${lookupSlug}"`);
    respondInfo(cached);
    return;
  }

  try {
    if (hasHints) {
      console.log(`[Info] Detail-only scrape: ${hintUrl}`);
      const { overview, notes, noteImages } = await scrapeFragranticaDetail(hintUrl);
      const details = {
        name: hintName, brand: hintBrand, overview, notes, noteImages,
        url: hintUrl,
        imageUrl: hintImage.startsWith('https://') ? hintImage : undefined,
      };
      saveCologneWithSellers(lookupSlug, {
        name: details.name, brand: details.brand, overview: details.overview,
        notes: details.notes, fragrantica_url: details.url, image_url: details.imageUrl ?? null,
        note_images: JSON.stringify(noteImages),
      }, []);
      respondInfo(details);
      return;
    }

    console.log(`[Info] Full Fragrantica scrape for "${rawQuery}"`);
    const cologne = await scrapeFragrantica(rawQuery);
    const slug = canonicalSlug(cologne.brand, cologne.name);
    const payload = {
      name: cologne.name, brand: cologne.brand, overview: cologne.overview,
      notes: cologne.notes, fragrantica_url: cologne.url, image_url: cologne.imageUrl ?? null,
      note_images: cologne.noteImages ? JSON.stringify(cologne.noteImages) : null,
    };
    saveCologneWithSellers(slug, payload, []);
    if (slug !== lookupSlug) saveCologneWithSellers(lookupSlug, payload, []);
    respondInfo(cologne);
  } catch (err) {
    console.error('[Info] Failed:', err);
    res.status(502).json({ error: `Could not find fragrance info for: ${rawQuery || hintName}` });
  }
});

// GET /api/prices?brand=&name= — sellers only for an already-identified cologne.
// The web pick flow calls this AFTER /api/info has rendered the page, so prices
// stream in without blocking. Skips Fragrantica entirely, and uses Bing only
// (fast, ~12s) rather than the slow retail-site scrapers — the daily job does the
// thorough scrape. Warm-cached: once a cologne has sellers, returns instantly.
router.get('/prices', async (req: Request, res: Response) => {
  const brand = ((req.query.brand as string) ?? '').trim();
  const name  = ((req.query.name as string) ?? '').trim();
  if (!brand || !name) {
    res.status(400).json({ error: 'Missing brand or name.' });
    return;
  }
  const slug = canonicalSlug(brand, name);

  // Warm cache: if this cologne already has sellers (from a prior pick or the
  // daily job), return them instantly — no scrape.
  const cached = getCologneBySlug(slug);
  if (cached && cached.onlineSellers.length > 0) {
    res.json({ onlineSellers: cached.onlineSellers });
    return;
  }

  try {
    const bingSellers = await scrapeBingShopping(`${brand} ${name}`, brand, whoisEnabled());

    // Cache onto the cologne row if it exists yet (/api/info creates it in parallel).
    const row = getCologneRowBySlug(slug);
    if (row) {
      updateSellersForCologne(row.id, bingSellers);
      const rebuilt = getCologneBySlug(slug);
      res.json({ onlineSellers: rebuilt?.onlineSellers ?? [] });
      return;
    }
    res.json({ onlineSellers: bingSellers });
  } catch (err) {
    console.error('[Prices] Failed:', err);
    res.status(502).json({ error: 'Could not load prices. Try again shortly.' });
  }
});

// GET /api/search?q=Dior+Sauvage
router.get('/search', async (req: Request, res: Response) => {
  const raw = (req.query.q as string)?.trim() ?? '';
  // Strip control characters and collapse whitespace
  const query = raw.replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim();
  if (!query) {
    res.status(400).json({ error: 'Missing query parameter: q' });
    return;
  }
  if (query.length > 120) {
    res.status(400).json({ error: 'Query too long (max 120 characters).' });
    return;
  }

  const querySlug = generateSlug(query);
  console.log(`[Search] "${query}" → slug: ${querySlug}`);

  // 1. DB cache check — only a full hit (info + sellers) short-circuits.
  // A cologne with zero sellers (saved via /api/info, or a past failed seller
  // scrape) keeps its info but gets a fresh sellers-only scrape.
  const cached = getCologneBySlug(querySlug);
  if (cached && cached.onlineSellers.length > 0) {
    console.log(`[Search] Cache hit for "${query}"`);
    res.json(cached);
    return;
  }

  if (cached) {
    console.log(`[Search] Info cached but no sellers — scraping sellers for "${cached.brand} ${cached.name}"`);
    try {
      const [bingResult, siteResult] = await Promise.all([
        scrapeBingShopping(`${cached.brand} ${cached.name}`, cached.brand, whoisEnabled()).then(
          v => ({ status: 'fulfilled' as const, value: v }),
          e => ({ status: 'rejected' as const, reason: e }),
        ),
        scrapeAllSites(cached.brand, cached.name).then(
          v => ({ status: 'fulfilled' as const, value: v }),
          e => ({ status: 'rejected' as const, reason: e }),
        ),
      ]);
      const bingSellers: ScrapedSeller[] = bingResult.status === 'fulfilled' ? bingResult.value : [];
      const siteSellers: ScrapedSeller[] = siteResult.status === 'fulfilled' ? siteResult.value : [];
      if (bingResult.status === 'rejected') console.warn('[Bing Shopping] Failed:', bingResult.reason);
      if (siteResult.status === 'rejected') console.warn('[SiteScrapers] Failed:', siteResult.reason);

      const sellers = mergeSellers(siteSellers, bingSellers);
      console.log(`[Search] Sellers-only scrape got ${sellers.length} sellers`);

      // Update every row holding this cologne (query slug + canonical alias)
      const slugsToUpdate = new Set([querySlug, canonicalSlug(cached.brand, cached.name)]);
      for (const slug of slugsToUpdate) {
        const row = getCologneRowBySlug(slug);
        if (row) updateSellersForCologne(row.id, sellers);
      }
      res.json(getCologneBySlug(querySlug));
    } catch (err) {
      console.error('[Search] Sellers-only scrape failed:', err);
      res.json(cached); // still return the info we have
    }
    return;
  }

  console.log(`[Search] Cache miss — scraping for "${query}"`);
  try {
    // Fragrantica first (identity/notes), then Bing + site scrapers concurrently
    const fragranticaData = await scrapeFragrantica(query).then(
      v => ({ status: 'fulfilled' as const, value: v }),
      e => ({ status: 'rejected' as const, reason: e }),
    );

    if (fragranticaData.status === 'rejected') {
      console.error('[Fragrantica] Failed:', fragranticaData.reason);
      res.status(502).json({ error: `Could not find fragrance on Fragrantica: ${query}` });
      return;
    }

    const cologne = fragranticaData.value;

    const [sellerData, siteSellersResult] = await Promise.all([
      scrapeBingShopping(`${cologne.brand} ${cologne.name}`, cologne.brand, whoisEnabled()).then(
        v => ({ status: 'fulfilled' as const, value: v }),
        e => ({ status: 'rejected' as const, reason: e }),
      ),
      scrapeAllSites(cologne.brand, cologne.name).then(
        v => ({ status: 'fulfilled' as const, value: v }),
        e => ({ status: 'rejected' as const, reason: e }),
      ),
    ]);

    const bingSellers: ScrapedSeller[] = sellerData.status === 'fulfilled'        ? sellerData.value        : [];
    const siteSellers: ScrapedSeller[] = siteSellersResult.status === 'fulfilled' ? siteSellersResult.value : [];
    if (sellerData.status === 'rejected')        console.warn('[Bing Shopping] Failed (continuing without prices):', sellerData.reason);
    if (siteSellersResult.status === 'rejected') console.warn('[SiteScrapers] Failed:', siteSellersResult.reason);

    const sellers = mergeSellers(siteSellers, bingSellers);
    saveAndRespond(res, cologne, sellers, querySlug);
  } catch (err) {
    console.error('[Search] Unexpected error:', err);
    res.status(500).json({ error: 'Scraping failed. Try again shortly.' });
  }
});

// POST /api/identify  — body: { image: "<base64 string>" }
router.post('/identify', async (req: Request, res: Response) => {
  const { image } = req.body as { image?: unknown };
  if (!image || typeof image !== 'string') {
    res.status(400).json({ error: 'Missing or invalid body field: image (must be a string).' });
    return;
  }
  // 10 MB base64 cap (~7.5 MB decoded) — well under the 15 MB express.json limit
  if (image.length > 10 * 1024 * 1024) {
    res.status(413).json({ error: 'Image too large (max 10 MB base64).' });
    return;
  }
  const base64 = image.includes(',') ? image.split(',')[1] : image;
  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
    res.status(400).json({ error: 'Invalid image encoding (expected base64).' });
    return;
  }

  try {
    const name = await identifyFromGoogleLens(base64);
    if (!name) {
      res.status(422).json({ error: 'Could not identify cologne from image. Try a clearer photo.' });
      return;
    }
    res.json({ name });
  } catch (err) {
    console.error('[Identify] Error:', err);
    res.status(500).json({ error: 'Image identification failed.' });
  }
});

export default router;
