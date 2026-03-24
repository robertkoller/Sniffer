import { chromium } from 'playwright';
import type { ScrapedSeller } from '../types';

// Known trusted seller names → mapped to their domain for trust scoring
const TRUSTED_SELLER_NAMES = new Map<string, string>([
  ['sephora', 'sephora.com'],
  ['nordstrom', 'nordstrom.com'],
  ["nordstrom rack", 'nordstromrack.com'],
  ['macy\'s', 'macys.com'],
  ['macys', 'macys.com'],
  ['bloomingdale\'s', 'bloomingdales.com'],
  ['bloomingdales', 'bloomingdales.com'],
  ['neiman marcus', 'neimanmarcus.com'],
  ['saks fifth avenue', 'saksfifthavenue.com'],
  ['ulta', 'ulta.com'],
  ['ulta beauty', 'ulta.com'],
  ['fragrancenet', 'fragrancenet.com'],
  ['fragrance net', 'fragrancenet.com'],
  ['fragrancex', 'fragrancex.com'],
  ['perfumania', 'perfumania.com'],
  ['jomashop', 'jomashop.com'],
  ['fragrancenet.com', 'fragrancenet.com'],
  ['fragrancex.com', 'fragrancex.com'],
  ['fragrance shop', 'fragranceshop.com'],
  ['fragranceshop.com', 'fragranceshop.com'],
  ['amazon', 'amazon.com'],
  ['amazon.com', 'amazon.com'],
  ['walmart', 'walmart.com'],
  ['target', 'target.com'],
  ['ebay', 'ebay.com'],
  ['ebay.com', 'ebay.com'],
  ['dillard\'s', 'dillards.com'],
  ['dillards', 'dillards.com'],
  ['belk', 'belk.com'],
  // Brand official stores
  ['christian dior', 'dior.com'],
  ['dior', 'dior.com'],
  ['tom ford', 'tomford.com'],
  ['chanel', 'chanel.com'],
  ['ysl beauty', 'yslbeauty.com'],
  ['armani beauty', 'armani.com'],
  ['versace', 'versace.com'],
  ['burberry', 'burberry.com'],
  ['gucci', 'gucci.com'],
  ['prada', 'prada.com'],
  ['hermes', 'hermes.com'],
  ['hermès', 'hermes.com'],
  ['creed', 'creedfragrances.com'],
]);

import { scoreSellerTrust } from './trustScorer';

function scoreByName(sellerName: string): { score: number; isTrusted: boolean } {
  const key = sellerName.toLowerCase().trim();
  const domain = TRUSTED_SELLER_NAMES.get(key);
  if (domain) {
    return { score: 90, isTrusted: true };
  }
  // Unknown seller — apply heuristic
  return scoreSellerTrust(`https://www.${key.replace(/\s+/g, '')}.com`);
}

export async function scrapeBingShopping(query: string): Promise<ScrapedSeller[]> {
  const searchQuery = `${query} 3.4oz 100ml fragrance`;
  const url = `https://www.bing.com/shop?q=${encodeURIComponent(searchQuery)}`;

  console.log(`[Bing Shopping] Searching: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const sellers = await page.evaluate(() => {
      // Returns true if the card's text is for a non-target size (not ~3.4oz / ~100ml)
      function isWrongSize(text: string): boolean {
        const lower = text.toLowerCase();
        // Match oz values — handles "3.4oz", "3.4 oz", "3.4 fl oz", "3.4 fl. oz"
        const ozMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?oz\b/);
        if (ozMatch) {
          const oz = parseFloat(ozMatch[1]);
          if (oz < 3.2 || oz > 3.6) return true; // outside ~3.4oz window
        }
        // Match ml values
        const mlMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*ml\b/);
        if (mlMatch) {
          const ml = parseFloat(mlMatch[1]);
          if (ml < 90 || ml > 110) return true; // outside ~100ml window
        }
        return false;
      }

      const cards: Element[] = Array.from(document.querySelectorAll('.br-gOffCard'));
      const seen = new Set<string>();
      const results: Array<{ name: string; price: string; href: string }> = [];

      for (const card of cards) {
        const priceEl   = card.querySelector('.br-price');
        const sellerEl  = card.querySelector('.br-offSlrTxt') ?? card.querySelector('.br-offSlr');
        const linkEl    = card.querySelector('a.br-offLink') as HTMLAnchorElement | null;

        const price  = priceEl?.textContent?.trim() ?? '';
        const seller = sellerEl?.textContent?.trim() ?? '';
        const href   = linkEl?.href ?? '';

        if (!price || !price.includes('$') || !seller || !href) continue;
        if (seen.has(seller.toLowerCase())) continue;

        // Filter out cards whose visible text indicates a different bottle size or a sample/travel size
        const cardText = card.textContent ?? '';
        if (isWrongSize(cardText)) continue;
        if (/\b(sample|travel spray|travel size|mini|miniature|decant|vial|gift set|inspiration kit|fragrance kit|trial|starter kit)\b/i.test(cardText)) continue;
        if (/our version of|type\b|inspired by|dupe|fragrance oil|impression of/i.test(cardText)) continue;

        seen.add(seller.toLowerCase());
        results.push({ name: seller, price, href });

        if (results.length >= 20) break;
      }

      return results;
    });

    console.log(`[Bing Shopping] Found ${sellers.length} sellers`);

    return sellers.map(s => {
      const { score, isTrusted } = scoreByName(s.name);
      return {
        name:             s.name,
        price:            s.price,
        url:              s.href,  // always the Bing redirect — resolves to the actual product listing
        credibilityScore: score,
        isTrusted,
      };
    });
  } finally {
    await browser.close();
  }
}
