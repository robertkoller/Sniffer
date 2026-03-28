import cron from 'node-cron';
import { getAllColognes, updateSellersForCologne } from '../db';
import { scrapeBingShopping } from '../scrapers/bingShopping';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function refreshAllPrices(): Promise<void> {
  const colognes = getAllColognes();
  if (!colognes.length) return;

  console.log(`[Daily Update] Refreshing prices for ${colognes.length} cologne(s)...`);

  for (const cologne of colognes) {
    try {
      console.log(`[Daily Update] Updating: ${cologne.brand} ${cologne.name}`);
      const sellers = await scrapeBingShopping(`${cologne.brand} ${cologne.name}`);
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
    refreshAllPrices().catch(err => console.error('[Daily Update] Fatal error:', err));
  });

  console.log('[Daily Update] Scheduled for 3:00 AM daily');
}
