import { Router, Request, Response } from 'express';
import { getCologneBySlug, saveCologneWithSellers, getSetting } from '../db';
import { scrapeFragrantica } from '../scrapers/fragrantica';
import { scrapeBingShopping } from '../scrapers/bingShopping';
import { findSellerSites } from '../scrapers/aiSellerSearch';
import { scrapeDirectPrices } from '../scrapers/directPriceScraper';
import { computeReferencePrice } from '../scrapers/trustScorer';
import { identifyFromGoogleLens } from '../scrapers/googleLens';
import { generateSlug, canonicalSlug } from '../utils/slug';
import type { ScrapedSeller } from '../types';

const router = Router();

function saveAndRespond(
  res: Response,
  cologne: { name: string; brand: string; overview: string; notes: { top: string[]; middle: string[]; base: string[] }; url: string },
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
  };
  const result = saveCologneWithSellers(slug, colognePayload, sellers);
  if (slug !== querySlug) saveCologneWithSellers(querySlug, colognePayload, sellers);
  res.json(result);
}

// Merge two seller arrays — AI results fill in sellers Bing didn't find.
// Deduplicate by lowercased name. Re-score trust using the combined reference price.
function mergeSellers(
  bingSellers: ScrapedSeller[],
  aiSellers: ScrapedSeller[],
): ScrapedSeller[] {
  const seen = new Set(bingSellers.map(s => s.name.toLowerCase()));
  const newFromAi = aiSellers.filter(s => !seen.has(s.name.toLowerCase()));
  return [...bingSellers, ...newFromAi];
}

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

  // 1. DB cache check
  const cached = getCologneBySlug(querySlug);
  if (cached) {
    console.log(`[Search] Cache hit for "${query}"`);
    res.json(cached);
    return;
  }

  console.log(`[Search] Cache miss — scraping for "${query}"`);
  try {
    const whoisEnabled    = getSetting('whois_enabled') === '1';
    const aiSearchEnabled = getSetting('ai_search_enabled') === '1';

    if (aiSearchEnabled) {
      // AI mode: Gemini verifies the fragrance and returns niche seller URLs.
      // Bing scraper runs in parallel for mainstream sellers.
      // Results are merged so we get the best of both.

      let aiResult;
      try {
        aiResult = await findSellerSites(query);
      } catch (err) {
        console.warn('[AI Search] Gemini call failed:', err);
        aiResult = null;
      }

      // Hard stop if Gemini says the fragrance doesn't exist
      if (aiResult && !aiResult.exists) {
        console.log(`[AI Search] Fragrance not found: "${query}"`);
        res.status(404).json({
          error: aiResult.uncertaintyWarning
            ?? `Could not find a fragrance matching "${query}". Please check the name and try again.`,
        });
        return;
      }

      // Use Gemini's canonical name for Fragrantica to avoid wrong-match results
      const fragranticaQuery = (aiResult?.canonicalBrand && aiResult?.canonicalName)
        ? `${aiResult.canonicalBrand} ${aiResult.canonicalName}`
        : query;
      if (fragranticaQuery !== query) {
        console.log(`[AI Search] Using canonical name for Fragrantica: "${fragranticaQuery}"`);
      }

      // Fragrantica + Bing run concurrently (AI scraping happens after so we have
      // Bing's reference price to share across both result sets)
      const [fragranticaData, bingResult] = await Promise.all([
        scrapeFragrantica(fragranticaQuery).then(
          v => ({ status: 'fulfilled' as const, value: v }),
          e => ({ status: 'rejected' as const, reason: e }),
        ),
        // Use canonical name for Bing so title-matching filters out variants
        // (e.g. "Absolu Aventus" won't pass when searching "Creed Aventus")
        scrapeBingShopping(fragranticaQuery, undefined, whoisEnabled).then(
          v => ({ status: 'fulfilled' as const, value: v }),
          e => ({ status: 'rejected' as const, reason: e }),
        ),
      ]);

      if (fragranticaData.status === 'rejected') {
        console.error('[Fragrantica] Failed:', fragranticaData.reason);
        res.status(502).json({ error: `Could not find fragrance on Fragrantica: ${query}` });
        return;
      }

      const cologne = fragranticaData.value;
      const bingSellers: ScrapedSeller[] = bingResult.status === 'fulfilled' ? bingResult.value : [];
      if (bingResult.status === 'rejected') {
        console.warn('[Bing Shopping] Failed:', bingResult.reason);
      }

      // Scrape AI-provided niche sites, sharing Bing's reference price for consistent scoring
      let aiSellers: ScrapedSeller[] = [];
      if (aiResult?.sellers.length) {
        const bingRefPrice = computeReferencePrice(bingSellers.map(s => s.price));
        aiSellers = await scrapeDirectPrices(aiResult.sellers, cologne.brand, bingRefPrice || undefined);
        console.log(`[AI Search] Got ${aiSellers.length} priced sellers from AI sites`);
      }

      const merged = mergeSellers(bingSellers, aiSellers);
      console.log(`[Search] Merged: ${bingSellers.length} Bing + ${aiSellers.length} AI = ${merged.length} total sellers`);

      saveAndRespond(res, cologne, merged, querySlug);
      return;
    }

    // Non-AI mode: Fragrantica first, then Bing
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

    const sellerData = await scrapeBingShopping(`${cologne.brand} ${cologne.name}`, cologne.brand, whoisEnabled).then(
      v => ({ status: 'fulfilled' as const, value: v }),
      e => ({ status: 'rejected' as const, reason: e }),
    );
    const sellers = sellerData.status === 'fulfilled' ? sellerData.value : [];
    if (sellerData.status === 'rejected') {
      console.warn('[Bing Shopping] Failed (continuing without prices):', sellerData.reason);
    }

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
