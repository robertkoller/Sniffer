# Social Features, Library Sync & Taste Profile

These power Sniffy's "Letterboxd for cologne" side and the website's personalized search. Server code: `server/src/routes/social.ts` and `server/src/routes/profile.ts`.

## Taste profile (`routes/profile.ts`)

Each user has a taste profile: `{ genderPreference: 'men'|'women'|'all', scentFamilies: string[] }`.

- **Per-account** when signed in (stored in `user_profiles`); anonymous requests fall back to a legacy single-user profile in the `settings` table.
- `GET /api/profile` → `{ profile, scentFamilyOptions }` (the 10 families: fresh, citrus, aquatic, warm & spicy, woody, sweet & gourmand, floral, powdery, leather, green).
- `PUT /api/profile` → saves it.
- **`genderPreference` drives search ordering**: `/api/suggest` puts the preferred gender first, unisex next, opposite last. `scentFamilies` are stored and used by the mobile app's "your taste" matching (keyword map in `mobile/utils/taste.ts`); they don't affect search ordering yet.

Where you set it:
- **App:** Profile tab → Settings sheet.
- **Website:** click your name/avatar (top-right, when signed in) → Settings page.

## Library sync (`routes/social.ts`)

The app keeps the user's library locally (AsyncStorage) and **pushes a snapshot** to the server so it survives a reinstall and feeds public profiles.

- `PUT /api/social/library` (debounced ~2s after any change in `mobile/context/AuthContext.tsx`) sends `{ collection, wishlist, currentlyWearingSlug, showcaseSlugs, sections, complimentLog }`.
- `GET /api/social/library` returns the full snapshot for **account restore** — when a signed-in user has an empty local library, the app hydrates from this.
- **Security note:** wear counts sent in the snapshot are ignored. Wear counts come only from the server's `wear_logs`.

## Wear logging — server-authoritative (`POST /api/social/wear`)

Logging that you wore a fragrance is enforced by the server so it can't be faked:
- One wear per fragrance **per calendar day** (the `wear_logs` composite primary key). A second attempt the same day returns **409**.
- `GET /api/social/wears` returns the full history (`[{ slug, wornOn }]`) — used for the wear graphs and restore.
- In the app, the "Wore it today" button (and the compliments tracker, which requires a wear that day) drive this.

## Public profiles

- `GET /api/social/me` — your own public profile: showcase (up to 10 curated bottles, or top-rated as a fallback), currently wearing, and stats (bottles, wishlist count, total wears, total compliments, average rating).
- `GET /api/social/users` — a community directory of everyone.
- `GET /api/social/users/:id` — one user's public profile.

The compliments log is client-tracked and synced in the library payload; wear counts in these responses are always the server-verified ones.

## Ratings & other library concepts

- **Ratings** are decimal 0–10 (migrated from an old 1–5 star scale on the mobile side).
- **Sections** are user-defined shelves inside the collection; bottles carry a `sectionId`. The app can auto-sort by scent family.
- **Showcase** is a hand-picked set of up to 10 bottles shown on the profile.
- **Currently wearing** is a single slug; logging a wear sets it.

All of this lives in the app UI (see [mobile-app.md](mobile-app.md)) and is persisted both locally and in the synced snapshot.
