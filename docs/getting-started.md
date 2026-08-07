# Getting Started (local development)

Three processes can run: the **server**, the **website**, and the **app**. You always need the server; run whichever front end you're working on.

## Prerequisites

- Node.js (v18+ recommended)
- One-time: install the headless browser the scrapers use — from `server/`, run `npm run setup` (installs Playwright's Chromium).

## 1. Server (required)

```bash
cd server
npm install
npm run setup     # one-time: installs Playwright Chromium
npm run dev       # starts on http://localhost:3001
```

- The SQLite database auto-creates at `db/sniffer.db` on first run (tables + migrations run automatically).
- **IMPORTANT:** the dev server uses `ts-node`, which does **not** hot-reload. After you change any server file, **stop it (Ctrl-C) and re-run `npm run dev`**, or your changes won't take effect. (This has bitten us — a stale server is the #1 "why is it broken" cause.)

## 2. Website (Sniffer)

```bash
cd client
npm install
npm run dev       # starts on http://localhost:3000 (Vite hot-reloads)
```

## 3. App (Sniffy)

```bash
cd mobile
npm install
npx expo start    # press i for iOS Simulator, or scan the QR with Expo Go
```

- On the **iOS Simulator**, `localhost:3001` works (it shares your Mac's network).
- On a **physical device**, `localhost` is the phone — you must point the app's `BASE_URL` (`mobile/services/api.ts`) at your Mac's LAN IP or a deployed/tunnel URL. See [configuration.md](configuration.md).

## Handy server scripts (`server/`)

| Command | What it does |
|---------|--------------|
| `npm run dev` | Run the API (ts-node) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run the compiled build (`dist/index.js`) |
| `npm run setup` | Install Playwright Chromium (one-time) |
| `npm run list-colognes` | Print every cologne cached in the DB |
| `npm run delete-cologne <slug>` | Delete one cached cologne (e.g. to force a fresh scrape) |
| `npm run clear-db` | Wipe cached colognes/sellers/stores |
| `npx ts-node src/testScrapers.ts` | Smoke-test the scrapers directly |

## Testing the server on a scratch port

To poke the API without disturbing your main dev server:

```bash
PORT=3999 npx ts-node src/index.ts
```

## Common gotcha: empty/stale cache

Failed scrapes that return 0 sellers still get cached. If a cologne is stuck showing no sellers, delete its row and search again:

```bash
npm run delete-cologne dior-sauvage
```

(`/api/search` also auto-re-scrapes sellers when a cached cologne has info but zero sellers — see [search-flow.md](search-flow.md).)
