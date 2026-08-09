import cron from 'node-cron';
import { getAllColognes, updateSellersForCologne, purgeExpired } from '../db';
import { scrapeBingShopping } from '../scrapers/bingShopping';
import { scrapeAllSites } from '../scrapers/siteScrapers';
import { whoisEnabled } from '../utils/flags';
import type { ScrapedSeller } from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Merge seller arrays — deduplicate by lowercased name, earlier lists win.
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

// The daily job does the SLOW, thorough scrape (Bing + retail sites) so popular
// colognes stay warm in the DB with full coverage — keeping the live pick path
// (Bing only, via /api/prices) fast.
async function refreshAllPrices(): Promise<void> {
  const colognes = getAllColognes();
  if (!colognes.length) return;

  console.log(`[Daily Update] Refreshing prices for ${colognes.length} cologne(s)...`);

  for (const cologne of colognes) {
    try {
      console.log(`[Daily Update] Updating: ${cologne.brand} ${cologne.name}`);
      const [bingSellers, siteSellers] = await Promise.all([
        scrapeBingShopping(`${cologne.brand} ${cologne.name}`, cologne.brand, whoisEnabled()).catch(() => [] as ScrapedSeller[]),
        scrapeAllSites(cologne.brand, cologne.name).catch(() => [] as ScrapedSeller[]),
      ]);
      const sellers = mergeSellers(siteSellers, bingSellers);
      updateSellersForCologne(cologne.id, sellers);
      console.log(`[Daily Update] Updated ${sellers.length} sellers for ${cologne.name}`);
    } catch (err) {
      console.error(`[Daily Update] Failed for ${cologne.name}:`, err);
    }

    // Waiting to avoid rate limits
    await delay(3000);
  }

  console.log('[Daily Update] Done.');
}

export function startDailyUpdate(): void {
  // Run every day at 3:00 AM
  cron.schedule('0 3 * * *', () => {
    console.log('[Daily Update] Starting scheduled price refresh...');
    purgeExpired(); // clear expired sessions / OAuth nonces
    refreshAllPrices().catch(err => console.error('[Daily Update] Fatal error:', err));
  });

  console.log('[Daily Update] Scheduled for 3:00 AM daily');
}
