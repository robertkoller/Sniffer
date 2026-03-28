import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const RADIUS_METERS = 24000; // ~15 miles

// Cologne retailers that regularly carry fragrances
const STORE_PATTERN = 'Sephora|Nordstrom|Macy|Ulta|Bloomingdale|Neiman Marcus|Perfumania|Dillard|Belk|Saks';

// --- Brand tier classification ---
// Niche brands: specialty/luxury department stores only
const NICHE_BRAND_FRAGMENTS = [
  'creed', 'amouage', 'xerjoff', 'roja', 'clive christian', 'memo paris',
  'byredo', 'le labo', 'diptyque', 'frederic malle', 'acqua di parma',
  'kilian', 'maison francis kurkdjian', 'mfk', 'parfums de marly', 'initio',
  'serge lutens', 'penhaligon', 'lattafa',
];

// Mainstream brands: widely available at department stores and Sephora
const MAINSTREAM_BRAND_FRAGMENTS = [
  'dior', 'chanel', 'ysl', 'yves saint laurent', 'versace', 'prada', 'armani',
  'burberry', 'calvin klein', 'gucci', 'valentino', 'lancome', 'bvlgari',
  'carolina herrera', 'montblanc', 'jimmy choo', 'narciso rodriguez',
  'jo malone', 'givenchy', 'coach', 'polo', 'hugo boss', 'dolce', 'viktor',
  'maison margiela', 'tom ford', 'marc jacobs',
];

// Retailers that carry niche/luxury brands
const LUXURY_RETAILER_FRAGMENTS = ['nordstrom', 'bloomingdale', 'neiman', 'saks', 'dillard'];
// Retailers that carry mainstream brands (and sometimes niche)
const MAINSTREAM_RETAILER_FRAGMENTS = ['sephora', 'macy', 'ulta', 'belk', 'perfumania'];

function getStockLikelihood(brand: string, retailerName: string): 'likely' | 'uncertain' {
  const b = brand.toLowerCase();
  const r = retailerName.toLowerCase();

  const isNiche      = NICHE_BRAND_FRAGMENTS.some(f => b.includes(f));
  const isMainstream = MAINSTREAM_BRAND_FRAGMENTS.some(f => b.includes(f));
  const isLuxuryRetailer     = LUXURY_RETAILER_FRAGMENTS.some(f => r.includes(f));
  const isMainstreamRetailer = MAINSTREAM_RETAILER_FRAGMENTS.some(f => r.includes(f));

  if (isNiche)      return isLuxuryRetailer ? 'likely' : 'uncertain';
  if (isMainstream) return (isLuxuryRetailer || isMainstreamRetailer) ? 'likely' : 'uncertain';
  return 'uncertain';
}

// Haversine distance in miles
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildAddress(tags: Record<string, string>): string {
  if (tags['addr:full']) return tags['addr:full'];
  const num    = tags['addr:housenumber'] ?? '';
  const street = tags['addr:street'] ?? '';
  const city   = tags['addr:city'] ?? '';
  const state  = tags['addr:state'] ?? '';
  const line1  = [num, street].filter(Boolean).join(' ');
  return [line1, city, state].filter(Boolean).join(', ');
}

// GET /api/stores/nearby?lat=X&lng=Y&brand=Dior
router.get('/stores/nearby', async (req: Request, res: Response) => {
  const lat   = parseFloat(req.query.lat as string);
  const lng   = parseFloat(req.query.lng as string);
  const brand = (req.query.brand as string) ?? '';

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: 'lat and lng are required numeric query params' });
    return;
  }

  const overpassQuery = `
    [out:json][timeout:20];
    (
      node["name"~"${STORE_PATTERN}",i](around:${RADIUS_METERS},${lat},${lng});
      way["name"~"${STORE_PATTERN}",i](around:${RADIUS_METERS},${lat},${lng});
      relation["name"~"${STORE_PATTERN}",i](around:${RADIUS_METERS},${lat},${lng});
    );
    out center;
  `;

  const OVERPASS_URLS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter',
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let response: { data: any } | null = null;
  let lastError: Error | null = null;
  for (const url of OVERPASS_URLS) {
    try {
      response = await axios.post(
        url,
        `data=${encodeURIComponent(overpassQuery)}`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 22000 },
      );
      console.log(`[Stores] Using mirror: ${url}`);
      break;
    } catch (err) {
      lastError = err as Error;
      console.warn(`[Stores] ${url} failed: ${(err as Error).message}, trying next…`);
    }
  }

  try {
    if (!response) throw lastError ?? new Error('All Overpass mirrors failed');

    type OverpassElement = {
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags: Record<string, string>;
    };

    const elements: OverpassElement[] = response!.data.elements ?? [];

    const seen = new Set<string>();
    const stores: Array<{
      name: string;
      address: string;
      distance: number;
      lat: number;
      lng: number;
      stockLikelihood: 'likely' | 'uncertain';
    }> = [];

    for (const el of elements) {
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      const name  = el.tags?.['name'] ?? '';

      if (!elLat || !elLng || !name) continue;

      const address = buildAddress(el.tags);
      const dist    = distanceMiles(lat, lng, elLat, elLng);

      // Deduplicate: same store may appear as both a node and a way
      const key = `${name.toLowerCase()}|${address.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      stores.push({
        name,
        address,
        distance:        Math.round(dist * 10) / 10,
        lat:             elLat,
        lng:             elLng,
        stockLikelihood: getStockLikelihood(brand, name),
      });
    }

    stores.sort((a, b) => a.distance - b.distance);
    console.log(`[Stores] Found ${stores.length} stores near (${lat.toFixed(3)}, ${lng.toFixed(3)}) for brand "${brand}"`);
    res.json(stores.slice(0, 8));

  } catch (err) {
    console.error('[Stores] Overpass query failed:', (err as Error).message);
    res.status(502).json({ error: 'Could not fetch nearby stores. Try again shortly.' });
  }
});

export default router;
