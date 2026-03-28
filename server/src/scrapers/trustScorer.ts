// Authorized premium retailers — highest trust
const PREMIUM_RETAILERS = new Set([
  'nordstrom.com', 'sephora.com', 'macys.com', 'bloomingdales.com',
  'neimanmarcus.com', 'saksfifthavenue.com', 'dillards.com', 'belk.com',
  'ulta.com', 'perfumania.com', 'nordstromrack.com', 'walmart.com',
]);

// Brand-owned sites — also highest trust
const BRAND_SITES = new Set([
  'dior.com', 'tomford.com', 'chanel.com', 'ysl.com', 'yslbeauty.com',
  'versace.com', 'giorgioarmani.com', 'armani.com', 'calvinklein.com',
  'gucci.com', 'prada.com', 'burberry.com', 'hermes.com',
  'creedfragrances.com', 'bvlgari.com', 'givenchy.com', 'lancome.com',
  'carolinaherrera.com', 'valentino.com', 'montblanc.com', 'jimmychoo.com',
  'jomalone.com', 'maisonmargiela.com', 'acquadiparma.com', 'byredo.com',
]);

// Gray market — discount parallel importers, real product but not authorized
const GRAY_MARKET = new Set([
  'jomashop.com', 'fragrancenet.com', 'fragrancex.com',
  'fragranceshop.com', 'fragrancebuy.ca', 'beautycounter.com',
]);

// Large marketplaces — real but may carry 3rd-party grey/fake sellers
const MARKETPLACES = new Set([
  'amazon.com', 'target.com', 'ebay.com', 'costco.com', 'groupon.com',
]);

// Luxury brands — used for domain mismatch detection
const LUXURY_BRANDS = new Set([
  'dior', 'chanel', 'gucci', 'prada', 'hermes', 'creed', 'tomford', 'tom ford',
  'versace', 'burberry', 'givenchy', 'lancome', 'bvlgari', 'bulgari',
  'ysl', 'armani', 'valentino', 'montblanc', 'jimmychoo', 'carolina herrera',
  'jo malone', 'maison margiela', 'byredo', 'le labo', 'acqua di parma',
  'xerjoff', 'amouage', 'roja dove', 'clive christian', 'memo paris',
]);

// TLDs associated with spam/low-trust registrations
const SUSPICIOUS_TLDS = new Set(['xyz', 'top', 'shop', 'ru', 'tk', 'pw', 'cc', 'biz', 'gq', 'ml', 'cf']);

export interface TrustInput {
  url: string;
  price: string;
  brand?: string;
  productText?: string;
  referencePrice?: number;
  domainAgeDays?: number | null; // null = lookup failed; undefined = not checked
}

export function scoreSellerTrust(input: TrustInput): { score: number; isTrusted: boolean } {
  const { url, price, brand, productText, referencePrice, domainAgeDays } = input;

  // Extract domain components
  let hostname: string;
  let protocol: string;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
    protocol = parsed.protocol;
  } catch {
    return { score: 25, isTrusted: false };
  }

  const parts       = hostname.split('.');
  const tld         = parts[parts.length - 1] ?? '';
  const domainLabel = parts[0] ?? '';

  let score = 50; // base

  // Known retailer classification
  if (PREMIUM_RETAILERS.has(hostname) || BRAND_SITES.has(hostname)) {
    score += 40;
  } else if (GRAY_MARKET.has(hostname)) {
    score += 5;
  } else if (MARKETPLACES.has(hostname)) {
    score += 10;
  }

  // HTTPS
  if (protocol === 'https:') score += 5;
  else score -= 20;

  // TLD
  if (tld === 'com') score += 5;
  else if (SUSPICIOUS_TLDS.has(tld)) score -= 10;

  // Suspicious keywords in domain
  if (/cheap|discount|outlet|replica|fake|knockoff|imitation|counterfeit/.test(hostname)) {
    score -= 25;
  }

  // Domain structure heuristics — penalise each hyphen individually so a domain
  // with 1 hyphen barely loses points while 4+ hyphens tanks the score
  const hyphenCount = (domainLabel.match(/-/g) ?? []).length;
  score -= Math.min(hyphenCount * 4, 18);
  if (/\d/.test(domainLabel)) score -= 5;

  // Price sanity vs reference — continuous curve so scores spread out naturally.
  // Below 80% of median: penalty grows quadratically toward -38 at 0%.
  const numericPrice = parseFloat(price.replace(/[^0-9.]/g, ''));
  if (!isNaN(numericPrice) && referencePrice && referencePrice > 0) {
    const ratio = numericPrice / referencePrice;
    if (ratio < 0.8) {
      const below = (0.8 - ratio) / 0.8; // 0→1 as price drops from 80% to 0%
      score -= Math.round(below * below * 38);
    }
  }

  // Product text signals
  if (productText) {
    const t = productText.toLowerCase();
    if (/\btester\b|no box|without box|unboxed/.test(t))          score -= 10;
    if (/replica|inspired by|our version|dupe|imitation/.test(t)) score -= 40;
    if (/return policy|free returns|easy returns/.test(t))         score += 5;
    if (t.length > 80 && !/contact|customer service|support/.test(t)) score -= 10;
  }

  // Brand mismatch (luxury brand not sold on its own site)
  if (brand) {
    const brandLower = brand.toLowerCase().replace(/\s+/g, '');
    const isLuxury = [...LUXURY_BRANDS].some(b => {
      const bNorm = b.replace(/\s+/g, '');
      return brandLower.includes(bNorm) || bNorm.includes(brandLower);
    });
    const isKnown =
      PREMIUM_RETAILERS.has(hostname) ||
      BRAND_SITES.has(hostname) ||
      GRAY_MARKET.has(hostname) ||
      MARKETPLACES.has(hostname);
    if (isLuxury && !isKnown && !hostname.includes(brandLower.slice(0, 5))) {
      score -= 10;
    }
  }

  // Domain age — smooth logarithmic curve for unknown sites.
  // New domains lose up to 35 points; established old ones earn up to +12.
  // Uses log scale so every year counts less than the last (2nd year matters
  // more than the 10th), giving natural spread across the 0–100 range.
  const isKnownSite =
    PREMIUM_RETAILERS.has(hostname) ||
    BRAND_SITES.has(hostname) ||
    GRAY_MARKET.has(hostname) ||
    MARKETPLACES.has(hostname);
  if (!isKnownSite && domainAgeDays != null) {
    // log10 scale: day 0 → -35, 30d → -17, 1yr → -4, 3yr → +3, 5yr → +6, 20yr → +12
    const adj = -35 + 47 * Math.log10(domainAgeDays + 1) / Math.log10(7301);
    score += Math.max(-35, Math.min(12, adj));
  }

  // Clamp and return
  score = Math.round(Math.max(0, Math.min(100, score)));
  return { score, isTrusted: score >= 80 };
}

// Compute the median price from a list of price strings
export function computeReferencePrice(prices: string[]): number {
  const numeric = prices
    .map(p => parseFloat(p.replace(/[^0-9.]/g, '')))
    .filter(n => !isNaN(n) && n > 0)
    .sort((a, b) => a - b);
  if (!numeric.length) return 0;
  const mid = Math.floor(numeric.length / 2);
  return numeric.length % 2 === 0
    ? (numeric[mid - 1] + numeric[mid]) / 2
    : numeric[mid];
}
