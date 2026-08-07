# Scrapers

All scraping is **TypeScript running headless Chromium via Playwright** (no Python, no AI/LLM). Files live in `server/src/scrapers/`.

| File | Scrapes | Returns |
|------|---------|---------|
| `fragrantica.ts` | Fragrantica | Fragrance identity, notes, overview, bottle image, note images |
| `bingShopping.ts` | Bing Shopping | Online sellers + prices |
| `siteScrapers.ts` | FragranceNet, FragranceX | Online sellers + prices (per-retailer) |
| `googleLens.ts` | Google Lens | A fragrance name from a bottle photo |
| `trustScorer.ts` | (no scraping) | Trust scoring for sellers — see [whois-and-trust.md](whois-and-trust.md) |
| `whoisLookup.ts` | RDAP/WHOIS | Domain age (days) — see [whois-and-trust.md](whois-and-trust.md) |

## Fragrantica (`fragrantica.ts`) — identity, notes, images

Fragrantica's search is powered by Algolia. Instead of parsing HTML, we **intercept the Algolia API response** the page makes (`page.on('response', ...)` filtering for `algolia.net`) and read the hits directly.

Key functions:
- `suggestFragrantica(query, limit)` → the multi-result list for `/api/suggest`.
- `scrapeFragrantica(query)` → full identity + notes for one best-match cologne.
- `scrapeFragranticaDetail(url)` → notes/overview/images for a known cologne page (skips the search step).

Load-bearing details (easy to break):
- **Brand aliases** (`jpg`, `mfk`, `tf`, `pdm`, …) are expanded before searching. The **expanded** query must be used in the page URL, not just for scoring (this was a bug).
- **Images** use a fixed hotlink pattern: `https://fimgs.net/mdimg/perfume/375x500.<id>.jpg` for bottles, `https://fimgs.net/mdimg/sastojci/t.<id>.jpg` for note thumbnails.
- **Note-link poll fix:** the detail scraper must wait for *real* note links matching `/notes/.+-\d+\.html`. The bare `/notes/` category link is in the static HTML immediately, so an earlier poll exited too soon and sometimes returned **empty notes**. Don't "simplify" that regex.

## Bing Shopping (`bingShopping.ts`) — the main seller source

- The URL **must** include `&FORM=SHOPTB` — without it Bing serves an empty "no shopping results" page. (This silently broke everything once.)
- Offer cards are `.br-gOffCard`; it waits for them to render, then extracts seller/price/title/link.
- Filters out wrong sizes, samples/decants/gift sets, and non-perfume products (aftershave, body wash, etc.), checking both card text and the decoded destination URL (Bing wraps links in an `aclick` redirect with a base64 `u` param).
- Applies a price floor (drops implausibly cheap listings vs the median).
- Optionally enriches trust with **WHOIS domain age** when enabled.

## Retail sites (`siteScrapers.ts`) — FragranceNet & FragranceX

These add per-retailer coverage but are the **slowest** part (bot challenges).

- **FragranceNet** is a Next.js app: read `props.pageProps.pageData` from the `__NEXT_DATA__` JSON rather than the DOM. Search at `/fn/search/<query>`; real per-size prices are in the product page's `skuMap`. Its Cloudflare flags a *second* navigation in the same browser context ("Just a moment…" forever) — so **each navigation uses a fresh browser context** (see `PageFactory`).
- **FragranceX** search is at `/search/search_results?stext=`; a bot challenge auto-passes after ~15–20s, so we **poll** rather than fixed-wait. Search cards show smallest-size "from" prices, so we visit the product page for the real 3.4oz price.

Because these are slow (~15–30s each of Cloudflare waiting), they are used in the **daily background job** and the full `/api/search`, but **not** in the fast live `/api/prices` path (which is Bing-only). See [search-flow.md](search-flow.md).

## Photo identify (`googleLens.ts`)

Powers `POST /api/identify`. It's a **Playwright scrape of Google Lens** — it uploads the image and reads the best-guess label. This is *not* an AI/LLM API and costs nothing per call. (It survived the AI removal precisely because it isn't Gemini.)

## Speed notes

The scrapers used to sleep fixed multi-second delays. They now **poll and early-exit** as soon as the data appears:
- Fragrantica suggest: ~10s → ~3.5s.
- Fragrantica detail: ~4.5s → <1s.

See [search-flow.md](search-flow.md) for the full speed story.

## Testing scrapers

```bash
cd server
npx ts-node src/testScrapers.ts     # drives Bing + site scrapers directly
```

When sites change their markup (they will), start here to see which source broke.
