# Sniffer — Server

Node.js/Express backend. Handles all scraping, caching, and trust scoring. Runs on port 3001.

## Entry point

`src/index.ts` — starts Express, registers routes, initialises the database, and schedules the nightly price refresh cron job (3 AM).

## Request flow

```
Client search request
  └── GET /api/search?q=Creed+Aventus
        ├── Check SQLite cache (slug lookup)
        │     └── Cache hit → return immediately
        └── Cache miss
              ├── scrapeFragrantica(query)   → name, brand, notes, description
              └── scrapeBingShopping(query, brand) → seller list with prices
                    └── scoreSellerTrust(...)  → trust score per seller
              └── Save to SQLite
              └── Return to client
```

## Source layout

```
src/
  index.ts          Express app setup, CORS, cron job
  db.ts             SQLite access layer
  types.ts          Shared TypeScript interfaces
  routes/
    cologne.ts      GET /api/search  and  POST /api/identify
  scrapers/
    fragrantica.ts  Playwright scraper for Fragrantica (notes, description)
    bingShopping.ts Playwright scraper for Bing Shopping (prices, sellers)
    googleLens.ts   Playwright scraper for Google Lens (photo ID)
    trustScorer.ts  Deterministic trust scoring logic
  jobs/
    dailyUpdate.ts  node-cron job — re-scrapes seller prices nightly
  utils/
    slug.ts         Slug generation for DB cache keys
```

## Why Playwright instead of axios?

Fragrantica and Bing Shopping both use JavaScript-heavy pages and Cloudflare bot protection. A real browser (Chromium via Playwright) bypasses these. Axios/fetch gets 403'd.

## Environment

No `.env` required for basic use. CORS is pre-configured for `http://localhost:3000`.
