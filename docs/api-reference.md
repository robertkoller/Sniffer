# API Reference

All endpoints are mounted under `/api` (except `/health`). Base URL in dev: `http://localhost:3001`.

Routes are defined in `server/src/routes/` and mounted in `server/src/index.ts`.

## Rate limits

Limiters run **before** body parsing. See [security.md](security.md).

- **General:** 100 requests / 15 min per IP (all endpoints).
- **Strict:** 5 / 15 min on `/api/search` and `/api/identify` (the expensive full scrapes).
- **Scrape:** 40 / 15 min on `/api/suggest`, `/api/info`, `/api/prices`, `/api/stores/nearby`.

## Auth

Send `Authorization: Bearer <token>` to authenticate. Tokens come from the sign-in flows below, last 90 days, and are stored **hashed** server-side. Endpoints marked 🔒 require a valid token.

---

## Search & fragrance data (`routes/cologne.ts`)

### `GET /api/suggest?q=<query>`
Fast multi-result search. Returns up to 12 fragrance matches straight from Fragrantica's search index. ~3–4s uncached; 30-min in-memory server cache.
- If a Bearer token is sent, results are **ordered by the user's gender preference** (preferred gender first, unisex next, opposite last).
- Response: `{ suggestions: [{ id, name, brand, year?, gender?, thumbnail?, imageUrl?, url }] }`

### `GET /api/info?...`
Fast fragrance info — notes, overview, image — **no sellers**. Renders a page before prices load.
- `?q=<name>` for a plain lookup, **or** `?url=&brand=&name=&image=` from a `/api/suggest` hit (skips the Fragrantica search step, ~2–5s).
- Saves the cologne to the DB with zero sellers.
- Response: `{ name, brand, overview, imageUrl?, notes, noteImages? }`

### `GET /api/prices?brand=&name=`
Sellers only for an already-identified cologne. **Bing only** (fast), skips Fragrantica. Warm-cached: once a cologne has sellers, returns instantly.
- Response: `{ onlineSellers: [{ name, price, url, credibilityScore, isTrusted }] }`

### `GET /api/search?q=<query>`
The full, slow path: Fragrantica + Bing + retail-site scrapers, merged and trust-scored. DB-cached by slug. Returns the complete `ScentDetails` (info + `onlineSellers` + `physicalStores`). Strict-rate-limited. If a cached cologne has info but 0 sellers, it re-scrapes just the sellers.

### `POST /api/identify`
Body `{ image: "<base64>" }`. Identifies a fragrance from a bottle photo via a Google Lens scrape (Playwright, **not** an AI API). Returns `{ name }`. Strict-rate-limited.

---

## Settings (`routes/settings.ts`)

### `GET /api/settings`
Returns `{ whoisEnabled: boolean }` — the current WHOIS state (controlled by the `WHOIS_ENABLED` env var). Read-only now; the old toggle endpoints were removed.

---

## Stores (`routes/stores.ts`)

### `GET /api/stores/nearby?lat=&lng=&brand=`
Returns nearby physical stores likely to carry the brand.

---

## Taste profile (`routes/profile.ts`)

### `GET /api/profile`
Returns `{ profile: { genderPreference, scentFamilies }, scentFamilyOptions }`. Per-account when a token is sent; otherwise a legacy single-user profile.

### `PUT /api/profile`
Body `{ genderPreference?, scentFamilies? }`. Saves the taste profile (per-account with a token). `genderPreference` drives `/api/suggest` ordering.

---

## Auth (`routes/auth.ts`)

### `GET /api/auth/google/start?return=<url>`
Begins the Google OAuth flow. Validates `return` against an allowlist, mints a single-use anti-CSRF `state` nonce (return URL held server-side), then redirects to Google.

### `GET /api/auth/google/callback`
Google redirects here with `code` + `state`. The server **consumes** the nonce (unknown/expired/replayed → 400), exchanges the code, creates/updates the user, issues a token, and redirects back — token in the URL **fragment** (`return#token=`) for web, **query** (`return?token=`) for app deep links.

### `POST /api/auth/google`
Body `{ idToken }`. For native Google SDK flows; requires `GOOGLE_CLIENT_ID` and always verifies the token `aud`. Returns `{ token, user }`.

### `POST /api/auth/dev`
Body `{ email, name }`. Password-less dev login — **off unless `ENABLE_DEV_LOGIN=true`** (set by `npm run dev`; never in production). Returns `{ token, user }`.

### `GET /api/auth/me` 🔒
Returns `{ user }` for the current token.

### `POST /api/auth/logout`
Invalidates the current token.

---

## Social (`routes/social.ts`)

### `PUT /api/social/library` 🔒
The app pushes the user's library snapshot: `{ collection, wishlist, currentlyWearingSlug, showcaseSlugs, sections, complimentLog }`. **Wear counts are ignored here** — they come only from the server's wear log.

### `GET /api/social/library` 🔒
Full restore payload for the signed-in user (used when a wiped device signs back in). Collection items carry server-verified `wearCount` / `lastWornOn`.

### `POST /api/social/wear` 🔒
Body `{ slug }`. Logs one wear. **Server-authoritative: max once per fragrance per calendar day** (a second try returns 409). Returns `{ wearCount, lastWornOn }`.

### `GET /api/social/wears` 🔒
The user's full wear history (`[{ slug, wornOn }]`) — used for the wear graphs and account restore.

### `GET /api/social/me` 🔒
The signed-in user's own public profile (showcase, currently wearing, stats).

### `GET /api/social/users?limit=&offset=` 🔒
Paginated community directory (name/picture, bottle count, top fragrance, currently wearing). `limit` 1–50 (default 30). Response: `{ users, page: { limit, offset, total, hasMore } }`.

### `GET /api/social/users/:id` 🔒
One user's full public profile.

---

## Legal (`routes/legal.ts`)

### `GET /privacy`
The privacy policy as a styled HTML page. Linked from all clients. (Not under `/api`.)

### `GET /api/legal/privacy`
Machine-readable policy: `{ version, effectiveDate, minimumAge, sections }`. See [privacy-and-age-gate.md](privacy-and-age-gate.md).

---

## Health

### `GET /health`
Returns `{ status: "ok" }`. (Not under `/api`.)
