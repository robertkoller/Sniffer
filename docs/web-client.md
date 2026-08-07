# Sniffer — Web Client

React 19 + Vite + Tailwind CSS, TypeScript. Lives in `client/`. A single-page app whose whole job is price comparison. Dev server runs on port 3000.

## Entry & state

- `index.tsx` — mounts `App`.
- `App.tsx` — the whole app is one component with a **view-state machine**. `currentView` is one of: `home`, `suggestions`, `results`, `settings`, `how-it-works`, `trusted-sellers`, `feature-not-ready`. `renderContent()` switches on it. It also holds auth state and the search/pick handlers.
- `apiService.ts` — every server call, the `SERVER_URL` config, auth token helpers, and the per-session in-memory caches (`suggestionCache`, `searchCache`, `infoCache`, `priceCache`).
- `types.ts` — shared types (`ScentDetails`, `FragranceSuggestion`, `FragranceInfo`, `UserProfile`, etc.).

## The search flow in the UI

See [search-flow.md](search-flow.md) for the full story. In the client:
1. `handleSearch` → `suggestCologne` → `suggestions` view.
2. `handleSelectSuggestion` → renders `ResultsView` from fast `/api/info`, and merges `/api/prices` sellers in the background (`pricesLoading`).

## Components (`client/components/`)

| Component | Role |
|-----------|------|
| `SearchHeader.tsx` | The search bar + photo-upload button (home) |
| `SuggestionList.tsx` | The multi-result picker (image, brand, name, year/gender) |
| `ResultsView.tsx` | The price-comparison page: fragrance profile + sorted sellers + physical stores. Handles the `pricesLoading` skeleton. |
| `Settings.tsx` | Account + taste profile editor (shown when signed in) |
| `PopularScents.tsx` | Home-page quick picks |
| `HowItWorks.tsx`, `TrustedSellers.tsx` | Static info pages |
| `FeatureNotReady.tsx` | Placeholder for unbuilt footer links |
| `MicroInteractions.tsx` | Small animation helpers |

## Auth & personalization

- Sign-in is Google only (nav "Sign In" → `googleSignInUrl()`), token captured from the `?token=` redirect into `localStorage` (`sniffer:authToken`).
- When signed in, the nav shows your avatar/name → **Settings** (`Settings.tsx`), where you set gender preference + scent families. Sign Out lives there.
- Signed-in searches send the token, so `/api/suggest` results are **gender-sorted**. The suggestion cache is cleared on sign-in/out and profile change so orderings don't leak.

See [social-and-profiles.md](social-and-profiles.md) and [authentication.md](authentication.md).

## Config

- `VITE_SERVER_URL` (in `client/.env.local`) points the client at the API; defaults to `http://localhost:3001`.
- `vite.config.ts` sets the dev port (3000) and the `@` path alias. (It no longer defines any Gemini/AI keys — that was removed.)

## Build

```bash
cd client
npm run dev      # dev server, port 3000, hot-reload
npm run build    # production build to dist/
npm run preview  # preview the production build
```

## Removed: the footer AI/WHOIS toggles

The website used to have "AI Search" and "WHOIS" toggle buttons in the footer. Both were removed: the AI-search feature is gone entirely, and WHOIS is now a server env var (`WHOIS_ENABLED`). See [whois-and-trust.md](whois-and-trust.md).
