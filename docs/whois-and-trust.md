# WHOIS & Seller Trust Scoring

When Sniffer shows sellers for a cologne, it ranks them by a **trust/credibility score** so reputable retailers surface first and sketchy ones sink. WHOIS domain-age checking is one input to that score.

## The trust score (`server/src/scrapers/trustScorer.ts`)

`scoreSellerTrust()` produces a `credibilityScore` (0–100) and an `isTrusted` flag for each seller, from signals like:

- **Known retailer allowlist** — recognized sellers (Sephora, Nordstrom, Macy's, Ulta, FragranceNet, Jomashop, Amazon, brand official stores, …) score high and are marked trusted.
- **Price sanity** — a listing priced implausibly far from the reference (median) price is penalized. `computeReferencePrice()` computes that median.
- **Domain age** — older domains are more trustworthy; brand-new domains are suspicious. This is where WHOIS comes in (optional).
- **Product-text checks** — sample/decant/wrong-size/wrong-product listings are filtered or penalized upstream in the scrapers.

The final ordering the user sees also factors price (cheaper-than-median gets a boost), computed in `buildScentDetails()` in `db.ts`.

## WHOIS domain-age lookups (`server/src/scrapers/whoisLookup.ts`)

`getDomainAgeDays(hostname)` returns how many days ago a domain was registered:
1. Tries **RDAP** (the modern JSON registration-data protocol) first.
2. Falls back to a **WHOIS** query if RDAP fails.
3. Results are cached in the `domain_age_cache` table for **30 days** (a `null` age means the lookup was attempted but failed — still cached, so we don't retry constantly).

This adds roughly **~5 seconds** to a *fresh* seller scrape (parallel lookups across the seller domains, each capped). Cached domains and cached colognes are unaffected.

## Turning WHOIS on/off

**WHOIS is ON by default.** It's controlled by an environment variable, not a UI toggle (the old footer button was removed).

To turn it **off**: add to `server/.env`
```
WHOIS_ENABLED=false
```
…and restart the server. Remove the line or set it to `true` to turn it back on. (`0`/`false` = off; anything else or unset = on.)

- The flag helper is `whoisEnabled()` in **`server/src/utils/flags.ts`** — change the default there if you ever want it off-by-default.
- `GET /api/settings` reports the current state: `{ "whoisEnabled": true }`.
- It's wired into every seller scrape: the live `/api/prices`, the full `/api/search`, and the daily refresh job.

### Trade-off

WHOIS on = smarter trust scores, but ~5s slower on cold scrapes. WHOIS off = faster cold scrapes, but the score relies only on the retailer allowlist + price sanity (no domain-age signal). If cold-search latency ever bothers you, turning it off is the first lever.

## Where it all plugs together

```
scrapeBingShopping(query, brand, whoisEnabled())
        │
        ├─ extract seller cards (name, price, url, title)
        ├─ if whoisEnabled: getDomainAgeDays() per domain  ──►  domain_age_cache
        └─ scoreSellerTrust({ url, price, brand, productText, referencePrice, domainAgeDays })
                                        │
                                        └─►  { credibilityScore, isTrusted }
```
