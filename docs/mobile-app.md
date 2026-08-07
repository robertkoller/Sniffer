# Sniffy — Mobile App

React Native + Expo (SDK 55), TypeScript, file-based routing via Expo Router. Lives in `mobile/`. It's a thin client over the shared server (see [architecture.md](architecture.md)) — plus a lot of local state for the collection/social features.

## Screens (`mobile/app/`)

Expo Router turns files into tab routes. `_layout.tsx` defines the tab bar and wraps everything in the context providers.

| File | Tab | What it does |
|------|-----|--------------|
| `_layout.tsx` | — | Tab navigator + provider tree + onboarding |
| `index.tsx` | Discover | Search (`/api/suggest` → pick → `/api/info`), recent searches |
| `collection.tsx` | Collection | Your owned bottles, sections, sort/filter |
| `wishlist.tsx` | Wishlist | Bottles you want |
| `rankings.tsx` | Rankings | Your collection ranked by rating (podium) |
| `profile.tsx` | Profile | Stats, showcase, currently wearing, wear/compliment charts, Settings sheet |

## State — three React Contexts (`mobile/context/`)

State is deliberately centralized so the tabs stay in sync (an early bug was each tab holding its own copy).

- **`LibraryContext.tsx`** — the collection, wishlist, sections, showcase, currently-wearing, wear log, and compliment log. Persists to AsyncStorage and exposes add/remove/rate/log actions. Also handles `hydrateFromServer` for account restore.
- **`AuthContext.tsx`** — session token + user, Google sign-in (`signInWithGoogle`), dev login, deep-link token capture, and the debounced library sync to the server.
- **`ProfileContext.tsx`** — the taste profile (gender + scent families), synced with `/api/profile`.

## Components (`mobile/components/`)

| Component | Role |
|-----------|------|
| `FragranceCard.tsx` | Hero card for a fragrance (image, notes, actions, "See prices on Sniffer") |
| `FragranceDetailSheet.tsx` | Bottom sheet: rating, seasons/occasions, wear log, compliments, review, section |
| `NotesPyramid.tsx` | Notes as image chips (top/heart/base) |
| `LibraryRow.tsx` | A row in collection/wishlist/rankings lists |
| `AddFragranceModal.tsx` | Search-and-add from any list |
| `SectionManager.tsx` | Create/delete sections, auto-sort by scent type |
| `RatingSlider.tsx` | Decimal 0–10 rating control + badge |
| `SocialCards.tsx` | Account card, currently-wearing, showcase shelf |
| `WearCharts.tsx` | Wear frequency bars, 14-day timeline, tri-state compliments grid |
| `Onboarding.tsx` | First-launch flow (taste questions → account prompt) |
| `TagPills.tsx`, `EmptyState.tsx`, `ScreenHeader.tsx`, `FadeInView.tsx` | Small shared UI |

## Services / utils / theme

- `services/api.ts` — all server calls (`suggestFragrances`, `fetchFragranceInfo` + 30-day cache, auth, profile, social) and the `BASE_URL` / `SNIFFER_WEB_URL` config.
- `utils/slug.ts` — canonical slug for a fragrance (must match the server's).
- `utils/taste.ts` — maps notes → scent families (the "your taste" badge, auto-sort).
- `constants/theme.ts` — the dark-gold design system (colors, radii, type).

## Local persistence (AsyncStorage keys)

`sniffy:collection`, `sniffy:wishlist`, `sniffy:sections`, `sniffy:showcase`, `sniffy:currentlyWearing`, `sniffy:wearLog`, `sniffy:complimentLog`, `sniffy:profile`, `sniffy:recentSearches`, `sniffy:onboarded`, `sniffy:authToken`, `sniffy:authUser`.

When signed in, the library is also pushed to the server so it can be restored on a fresh device.

## Running & shipping

- Dev: `npx expo start` (see [getting-started.md](getting-started.md)).
- On a physical device or TestFlight, `BASE_URL` must be a reachable server URL (LAN IP or deployed), and Google sign-in needs the server reachable too (see [authentication.md](authentication.md)).
- It's a real native app via Expo — shipping is `eas build` + `eas submit` to TestFlight. No Swift/migration needed.

## Note on `mobile/CLAUDE.md` and `mobile/.claude/`

Those are **claude-flow boilerplate**, not project docs — ignore them. This `docs/` folder is the real documentation.
