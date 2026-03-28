# Scrapers

Three Playwright-based scrapers plus the trust scoring module.

---

## fragrantica.ts

**Purpose:** Fetches cologne metadata — name, brand, overview description, and fragrance notes (top/middle/base).

**How it works:**
1. Opens `fragrantica.com/search/?query=<query>` in a headless Chromium browser.
2. Intercepts the Algolia API response the page fires in the background. Fragrantica uses Algolia for search — the response contains structured JSON with all hit data.
3. Scores every hit against the query using `matchScore()`:
   - All query words must appear in `brand + name` combined (so "Creed Aventus" matches a hit where `brand=Creed, name=Aventus`).
   - Fewer extra words = lower score = better match.
   - Heavy penalty (+100) for feminine variants ("for Her", "pour Femme", etc.) when the query doesn't mention gender.
4. Opens the winning hit's detail page and scrapes the notes pyramid and description.

**Key fields in Algolia hits:**
- `naslov` — fragrance name
- `dizajner` — brand
- `url.EN[0]` — Fragrantica detail page URL

---

## bingShopping.ts

**Purpose:** Finds current prices from real sellers across the web.

**How it works:**
1. Searches Bing Shopping for `<query> 3.4oz 100ml fragrance`.
2. For each product card, applies filters (see below).
3. Collects up to 40 unique sellers.
4. Computes a **reference price** (median of all collected prices).
5. Scores each seller via `trustScorer.ts`, passing the resolved seller domain, price, brand, card title, and reference price.

**Filters applied to every card:**
| Filter | What it blocks |
|---|---|
| `isTargetSize()` | Cards that don't explicitly state 3.4 oz / 100 ml, or that mention any other size (incl. multi-variant cards like "3.4 oz \| 1.0 oz") |
| Sample/travel keywords | sample, travel spray, mini, decant, gift set, inspiration kit, etc. |
| Knockoff keywords | "our version of", "inspired by", "dupe", "fragrance oil", etc. |
| Non-fragrance product types | after shave, lotion, shower gel, deodorant, body wash, etc. |

**Seller URL resolution:**
- Known sellers (Sephora, eBay, etc.) → resolved to their canonical domain for trust scoring.
- Unknown sellers → domain guessed from seller name.
- The actual link shown to the user is always the Bing redirect URL, which goes to the real product listing.

---

## googleLens.ts

**Purpose:** Identifies a fragrance from a photo.

**How it works:**
1. Writes the base64 image to a temp file.
2. Opens Google Lens in Playwright.
3. Uploads the image via the hidden file input.
4. Extracts the inferred product name from the results page.
5. The identified name is then passed to the normal search flow.

---

## trustScorer.ts

See [TRUST_SCORE.md](../../../TRUST_SCORE.md) in the project root for full documentation.
