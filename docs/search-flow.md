# Search Flow & Caching

This is the most important flow to understand, because it drives the app's perceived speed. The core idea: **show fragrance info instantly, load prices in the background.**

## The website's two-step search

1. **You type and search** → `GET /api/suggest?q=...` returns a list of matching colognes (image, brand, name, year, gender) in ~3–4s. The user picks the right one instead of the app guessing.
2. **You click a result** → two calls fire in parallel:
   - `GET /api/info` (with the picked cologne's Fragrantica URL) → notes/overview/image in ~1–2s → the page **renders immediately**.
   - `GET /api/prices?brand=&name=` → sellers via **Bing only** (~2–12s) → the price list **fills in** when ready, with a skeleton loader until then.

So the results page appears in ~1–2s instead of the old ~45s, and prices stream in behind it. Implemented in `client/App.tsx` (`handleSelectSuggestion`) and `client/components/ResultsView.tsx` (the `pricesLoading` state).

## The app's search

The mobile app uses `/api/suggest` → pick → `/api/info` (notes/image only). It does **not** fetch prices — the "See prices on Sniffer" button opens the website. So the app's search is fast and never triggers the slow seller scrape.

## `/api/search` — the full, slow path

Still exists for direct API use and as a fallback. It scrapes Fragrantica + Bing + retail sites, merges, trust-scores, and returns everything. It's strict-rate-limited (5/15 min) and slow on a cold cologne. The website no longer uses it for the normal pick flow.

Special case: if a cologne is cached with **info but zero sellers** (e.g. saved by `/api/info`), `/api/search` runs a **sellers-only** re-scrape (skipping Fragrantica) and updates the row. This also fixes the old "0 sellers cached forever" trap.

## Why cold searches were slow (and what fixed it)

A first-ever scrape launches headless browsers and hits bot-protected retail sites. The killers were FragranceNet/FragranceX Cloudflare challenges (~15–30s each). Fixes:

1. **Info split from prices** (above) — the page no longer waits on the price scrape.
2. **`/api/prices` skips Fragrantica** — the pick already knows the identity, so it only scrapes sellers.
3. **Live path is Bing-only** — the slow retail scrapers were moved out of the interactive path.
4. **The daily job does the thorough scrape** — `server/src/jobs/dailyUpdate.ts` re-scrapes every known cologne (Bing + retail sites) at 3 AM, so popular colognes stay warm with full coverage.

Measured after the change: page render ~1.6s, Bing prices ~2–3s (vs ~45s before). Repeat views are instant.

## Caching layers (there are several)

| Layer | Where | Scope | Notes |
|-------|-------|-------|-------|
| DB cache | `db/sniffer.db` (`colognes`/`sellers`) | Permanent, by slug | The main cache. Warm colognes return instantly. |
| Suggest cache | in-memory (server) | 30 min | `/api/suggest` results, keyed by query. |
| Warm prices | DB | Permanent | `/api/prices` returns instantly once a cologne has sellers. |
| Client session caches | `client/apiService.ts` | Browser session | `suggestionCache`, `searchCache`, `infoCache`, `priceCache` — re-searching/re-opening within a session is instant. Suggestion cache is cleared on sign-in/out and profile change (ordering depends on the account). |
| Mobile info cache | AsyncStorage | 30 days | The app caches `/api/info` per fragrance for offline/instant re-open. |

## Personalization

When a signed-in user searches, the web client sends the auth token with `/api/suggest`, and the server **orders results by the user's gender preference** (preferred gender → unisex → opposite). See [social-and-profiles.md](social-and-profiles.md).
