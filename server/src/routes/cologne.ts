import { Router, Request, Response } from 'express';
import { getCologneBySlug, saveCologneWithSellers } from '../db';
import { scrapeFragrantica } from '../scrapers/fragrantica';
import { scrapeBingShopping } from '../scrapers/bingShopping';
import { identifyFromGoogleLens } from '../scrapers/googleLens';
import { generateSlug, canonicalSlug } from '../utils/slug';

const router = Router();

// GET /api/search?q=Dior+Sauvage
router.get('/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string)?.trim();
  if (!query) {
    res.status(400).json({ error: 'Missing query parameter: q' });
    return;
  }

  const querySlug = generateSlug(query);
  console.log(`[Search] "${query}" → slug: ${querySlug}`);

  // 1. Check DB first (instant return)
  const cached = getCologneBySlug(querySlug);
  if (cached) {
    console.log(`[Search] Cache hit for "${query}"`);
    res.json(cached);
    return;
  }

  // 2. Not in DB — scrape both sources in parallel
  console.log(`[Search] Cache miss — scraping for "${query}"`);
  try {
    const [fragranticaData, sellerData] = await Promise.allSettled([
      scrapeFragrantica(query),
      scrapeBingShopping(query),
    ]);

    if (fragranticaData.status === 'rejected') {
      console.error('[Fragrantica] Failed:', fragranticaData.reason);
      res.status(502).json({ error: `Could not find fragrance on Fragrantica: ${query}` });
      return;
    }

    const cologne = fragranticaData.value;
    const sellers = sellerData.status === 'fulfilled' ? sellerData.value : [];

    if (sellerData.status === 'rejected') {
      console.warn('[Bing Shopping] Failed (continuing without prices):', sellerData.reason);
    }

    // Use canonical slug (brand + name) so future searches match
    const slug = canonicalSlug(cologne.brand, cologne.name);

    const result = saveCologneWithSellers(
      slug,
      {
        name:           cologne.name,
        brand:          cologne.brand,
        overview:       cologne.overview,
        notes:          cologne.notes,
        fragrantica_url: cologne.url,
      },
      sellers
    );

    // Also index by query slug so the same query hits cache next time
    if (slug !== querySlug) {
      saveCologneWithSellers(querySlug, {
        name:           cologne.name,
        brand:          cologne.brand,
        overview:       cologne.overview,
        notes:          cologne.notes,
        fragrantica_url: cologne.url,
      }, sellers);
    }

    res.json(result);
  } catch (err) {
    console.error('[Search] Unexpected error:', err);
    res.status(500).json({ error: 'Scraping failed. Try again shortly.' });
  }
});

// POST /api/identify  — body: { image: "<base64 string>" }
router.post('/identify', async (req: Request, res: Response) => {
  const { image } = req.body as { image?: string };
  if (!image) {
    res.status(400).json({ error: 'Missing body field: image' });
    return;
  }

  // Strip the data URL prefix if present: "data:image/jpeg;base64,<data>"
  const base64 = image.includes(',') ? image.split(',')[1] : image;

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
