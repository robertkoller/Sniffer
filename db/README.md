# Database

Sniffer uses SQLite via `better-sqlite3`. The database file lives at `db/sniffer.db`.

## Why SQLite?

- Zero configuration — no server to run, no connection string.
- Single file, easy to back up or delete.
- Fast for read-heavy workloads (most requests are cache hits).
- WAL mode enabled for better concurrent read performance.

## Schema

### `colognes`
Stores fragrance metadata scraped from Fragrantica.

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `slug` | TEXT UNIQUE | Cache key derived from the search query or brand+name |
| `name` | TEXT | Fragrance name (e.g. "Aventus") |
| `brand` | TEXT | Brand name (e.g. "Creed") |
| `overview` | TEXT | Description paragraph from Fragrantica |
| `notes_top` | TEXT | JSON array of top notes |
| `notes_middle` | TEXT | JSON array of middle/heart notes |
| `notes_base` | TEXT | JSON array of base notes |
| `fragrantica_url` | TEXT | Source URL on Fragrantica |
| `last_scraped_at` | INTEGER | Unix timestamp of last scrape |
| `created_at` | INTEGER | Unix timestamp of first insert |

### `sellers`
Stores current pricing data scraped from Bing Shopping. Linked to a cologne by `cologne_id`.

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `cologne_id` | INTEGER FK | References `colognes.id` |
| `name` | TEXT | Seller name (e.g. "Sephora") |
| `price` | TEXT | Price string as scraped (e.g. "$285.00") |
| `url` | TEXT | Link to the specific product listing |
| `credibility_score` | INTEGER | Trust score 0–100 (see TRUST_SCORE.md) |
| `is_trusted` | INTEGER | 1 if score ≥ 80, else 0 |
| `updated_at` | INTEGER | Unix timestamp of last price update |

### `stores`
Reserved for physical store locations. Not currently populated (future feature).

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `cologne_id` | INTEGER FK | References `colognes.id` |
| `name` | TEXT | Store name |
| `location` | TEXT | Address or city |
| `url` | TEXT | Store URL |

## How slugs work

When you search "Creed Aventus", two slugs are stored:
1. **Query slug** — `creed-aventus` (from the raw search string)
2. **Canonical slug** — `creed-aventus` (from brand + name after Fragrantica confirms them)

If both are the same, only one row is written. If they differ (e.g. you searched a nickname), both point to the same data so either query hits the cache.

## Cache behaviour

- **First search** — both slugs are missing → Fragrantica + Bing are scraped → data saved.
- **Repeat search** — slug found → data returned instantly, no scraping.
- **Nightly refresh** — the cron job at 3 AM re-scrapes Bing Shopping for every cologne in the database and updates seller prices.

## Auxiliary files

| File | Purpose |
|---|---|
| `sniffer.db` | Main database file |
| `sniffer.db-wal` | Write-Ahead Log — active writes go here first. Merged back on clean shutdown. Safe to ignore while the server is running. |
| `sniffer.db-shm` | Shared memory index used alongside WAL. Also safe to ignore. |

## Management commands

Run these from `server/`:

```bash
npm run list-colognes                    # show all cached fragrances
npm run delete-cologne <slug>            # remove one fragrance (forces re-scrape on next search)
npm run clear-db                         # wipe everything
```
