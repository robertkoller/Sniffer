# Sniffer

Sniffer helps you sniff out the lowest prices on cologne, find trusted sellers, and see where you can try scents in person.

## How it works

- Search by name or upload a photo — Sniffer identifies the fragrance and finds current prices across the web.
- Prices are scraped from Bing Shopping and filtered to **3.4 oz / 100 ml** bottles only (samples, travel sizes, and gift sets are excluded).
- Sellers are scored for trust: known retailers (Sephora, Nordstrom, etc.) score 90, large marketplaces (Amazon, eBay) score 65, unknown sites use a heuristic.
- Fragrance notes and descriptions come from Fragrantica.
- Photo identification uses Google Lens.
- Results are cached in a local SQLite database. The first search scrapes live; subsequent searches return the cached result. Prices are automatically refreshed every night at 3 AM.

## Setup

You need Node.js installed. Run each of these once:

```bash
# Install server dependencies and Playwright browser
cd server
npm install
npm run setup

# Install client dependencies
cd ../client
npm install
```

## Running locally

From the **root** directory, one command starts both:

```bash
npm start
```

Server runs on port 3001, client on port 3000. Both print color-coded logs in the same terminal. To restart, stop with `Ctrl+C` and run `npm start` again.

Then open [http://localhost:3000](http://localhost:3000).

## Useful commands

**From the root directory:**

| Command | What it does |
|---|---|
| `npm start` | Start both server and client together |
| `npm restart` | Alias for `npm start` |

**From the `server/` directory:**

| Command | What it does |
|---|---|
| `npm run dev` | Start the backend server only |
| `npm run setup` | Install Playwright's Chromium browser (run once) |
| `npm run list-colognes` | Print all colognes currently cached in the database |
| `npm run delete-cologne <slug>` | Remove a single cologne (and its sellers) from the database |
| `npm run clear-db` | Wipe all cached cologne data so next search re-scrapes fresh |

**Example — delete a specific cologne:**
```bash
npm run list-colognes          # see slugs
npm run delete-cologne creed-aventus
```

## Database files

The database lives at `server/db/sniffer.db`. You may also see two sibling files:

- **`sniffer.db-wal`** — Write-Ahead Log. SQLite writes new data here first before committing it to the main file. If the server is running, this file is active. It is safe to leave it alone.
- **`sniffer.db-shm`** — Shared Memory index. A small coordination file used alongside the WAL. Also safe to leave alone.

Both files are automatically cleaned up (merged back into `sniffer.db`) when the database is closed cleanly. You can delete them if the server is not running and you want a clean slate, but running `npm run clear-db` is the safer way to reset.
