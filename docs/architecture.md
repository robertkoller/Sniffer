# Architecture

## The three pieces

```
                         ┌─────────────────────────────┐
                         │        server/ (Node)        │
   Sniffer website ───►  │  Express API + SQLite +      │  ◄─── Sniffy app
   client/ (React)       │  Playwright scrapers + auth  │       mobile/ (Expo)
                         └──────────────┬──────────────┘
                                        │ scrapes
                          Fragrantica · Bing Shopping ·
                          FragranceNet · FragranceX
```

- **`server/`** owns all the "truth": the scraping pipeline, the SQLite cache of colognes/sellers, user accounts, sessions, taste profiles, and social data. It never renders UI.
- **`client/`** (Sniffer website) is a React SPA. Its job is price comparison: search → pick a cologne → see sellers/prices.
- **`mobile/`** (Sniffy app) is a React Native/Expo app. Its job is the personal collection + social layer. It fetches fragrance *info* from the server but sends users to the website for actual prices.

Both front ends are **thin clients** — they hold almost no business logic. They call the API and render the results.

## Tech stack

| Layer | Tech |
|-------|------|
| Language (everywhere) | TypeScript |
| Server | Node.js, Express, better-sqlite3 (SQLite), Playwright (headless Chromium) |
| Web client | React 19, Vite, Tailwind CSS, lucide-react icons |
| Mobile | React Native, Expo (SDK 55), Expo Router, AsyncStorage, expo-image |
| Auth | Google OAuth 2.0 / OpenID Connect (server-side code flow), opaque bearer tokens |

## How the apps reach the server

- The web client uses `SERVER_URL` (`client/apiService.ts`), default `http://localhost:3001`, overridable via `VITE_SERVER_URL`.
- The mobile app uses `BASE_URL` (`mobile/services/api.ts`), default `http://localhost:3001` in dev.
- CORS on the server allows the web client's origin (`CLIENT_ORIGIN`, default `http://localhost:3000`); in dev it allows any origin. The mobile app is not a browser, so CORS doesn't apply to it.

## Data flow, in one sentence each

- **Search (website):** website → `/api/suggest` (fast list) → user picks → `/api/info` (fast page) + `/api/prices` (sellers, background). See [search-flow.md](search-flow.md).
- **Search (app):** app → `/api/suggest` → user picks → `/api/info` (notes/image only); "See prices" opens the website.
- **Accounts:** either app → Google OAuth via the server → server issues a bearer token both apps store and send on every request.
- **Social:** the app pushes the user's library to `/api/social/library`; public profiles are read from `/api/social/*`.

## Key cross-cutting systems

- **Caching** — multiple layers (SQLite by slug, in-memory suggest cache, per-session client caches). See [search-flow.md](search-flow.md).
- **Trust scoring + WHOIS** — sellers are ranked by trust; WHOIS domain-age checking is on by default. See [whois-and-trust.md](whois-and-trust.md).
- **A daily job** (`server/src/jobs/dailyUpdate.ts`) re-scrapes prices for every known cologne at 3 AM so popular ones stay warm.
