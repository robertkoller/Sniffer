// Manual scraper smoke test: npx ts-node src/testScrapers.ts
import { scrapeBingShopping } from './scrapers/bingShopping';
import { scrapeAllSites } from './scrapers/siteScrapers';

(async () => {
  console.log('--- Bing Shopping ---');
  const bingSellers = await scrapeBingShopping('Dior Sauvage', 'Dior', false);
  for (const seller of bingSellers.slice(0, 8)) {
    console.log(`  ${seller.name} — ${seller.price} (score ${seller.credibilityScore}, trusted ${seller.isTrusted})`);
  }
  console.log(`  total: ${bingSellers.length}`);

  console.log('--- Site scrapers ---');
  const siteSellers = await scrapeAllSites('Dior', 'Sauvage');
  for (const seller of siteSellers) {
    console.log(`  ${seller.name} — ${seller.price} (score ${seller.credibilityScore}, trusted ${seller.isTrusted}) ${seller.url.slice(0, 80)}`);
  }
})();
