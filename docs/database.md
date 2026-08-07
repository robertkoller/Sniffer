# Database

SQLite, via `better-sqlite3`. The file lives at `db/sniffer.db` (WAL mode). All schema and access code is in **`server/src/db.ts`**. Tables and column migrations run automatically on server startup in `initDatabase()`.

The DB file is **gitignored** — it's a runtime cache/store, recreated on first run.

## Tables

### `colognes`
One row per fragrance (the cache of scraped info).
- `id`, `slug` (unique), `name`, `brand`, `overview`
- `notes_top`, `notes_middle`, `notes_base` — JSON arrays of note names
- `fragrantica_url`
- `image_url` — bottle image (added via migration)
- `note_images` — JSON map of note name → thumbnail URL (added via migration)
- `last_scraped_at`, `created_at`

### `sellers`
Online sellers for a cologne (price comparison rows).
- `id`, `cologne_id` (FK), `name`, `price`, `url`
- `credibility_score`, `is_trusted` (0/1), `updated_at`
- Replaced wholesale each time a cologne's prices are scraped.

### `stores`
Physical store rows for a cologne (`id`, `cologne_id`, `name`, `location`, `url`).

### `settings`
Key/value store. Now only holds the **legacy single-user taste profile** (key `user_profile`). The old `whois_enabled` / `ai_search_enabled` keys were removed — WHOIS is env-controlled and AI was deleted.

### `domain_age_cache`
Caches WHOIS/RDAP domain-age lookups so we don't re-query per search.
- `domain` (PK), `age_days` (null = lookup failed), `checked_at`
- 30-day TTL. See [whois-and-trust.md](whois-and-trust.md).

### `users`
User accounts.
- `id`, `google_sub` (unique, nullable), `email` (unique), `name`, `picture`, `created_at`
- Created/updated by `upsertUser()` on sign-in.

### `sessions`
Bearer-token sessions.
- `token` (PK), `user_id` (FK), `created_at`, `expires_at`
- 90-day TTL. `getUserByToken()` joins this to `users` and checks expiry.

### `user_libraries`
The app's synced library snapshot, one row per user.
- `user_id` (PK), `payload` (JSON string of collection/wishlist/sections/etc.), `updated_at`

### `user_profiles`
Per-account taste profile (gender preference + scent families), one row per user.
- `user_id` (PK), `payload` (JSON), `updated_at`
- Signed-in users use this; anonymous requests fall back to the legacy `settings` key.

### `wear_logs`
Server-authoritative wear history — the source of truth for wear counts.
- `(user_id, slug, worn_on)` composite PK — enforces **one wear per fragrance per day**.
- `worn_on` is `YYYY-MM-DD` (server date). `created_at`.

## Migrations

There's no migration framework. `initDatabase()`:
1. `CREATE TABLE IF NOT EXISTS` for every table.
2. Checks `PRAGMA table_info(colognes)` and `ALTER TABLE` to add `image_url` / `note_images` if missing.

So adding a column = add an `IF NOT EXISTS`-style check in `initDatabase()`. Adding a table = add another `CREATE TABLE IF NOT EXISTS`.

## Useful DB access helpers (in `db.ts`)

- Colognes: `getCologneBySlug`, `getCologneRowBySlug`, `saveCologneWithSellers`, `updateSellersForCologne`, `getAllColognes`, `deleteCologne`, `clearDatabase`
- Settings: `getSetting`, `setSetting`
- Domain age: `getCachedDomainAge`, `cacheDomainAge`
- Users/sessions: `upsertUser`, `createSession`, `getUserByToken`, `deleteSession`
- Social: `saveUserLibrary`, `getUserLibrary`, `listUsersWithLibraries`, `saveUserProfile`, `getUserProfile`
- Wears: `logWearForUser`, `getWearStatsForUser`, `getWearHistoryForUser`

## Inspecting / editing

- `npm run list-colognes` — list cached colognes
- `npm run delete-cologne <slug>` — remove one
- `npm run clear-db` — wipe the cologne/seller/store cache (leaves users/social intact)
