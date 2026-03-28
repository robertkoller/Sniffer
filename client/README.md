# Sniffer — Client

React + TypeScript frontend. Runs on port 3000 via Vite. Talks to the backend at `http://localhost:3001`.

## Source files

```
client/
  index.tsx           Entry point — mounts the React app
  App.tsx             Root component — manages search state and routing between views
  apiService.ts       All server communication (replaces the old Gemini AI service)
  types.ts            Shared TypeScript types (ScentDetails, OnlineSeller, etc.)
  vite.config.ts      Vite dev server config
  .env.local          Local environment variables (not committed)
  components/
    SearchHeader.tsx  Search bar + photo upload button
    ResultsView.tsx   Main results display — notes, description, sellers
    TrustedSellers.tsx Seller list with trust score badges
    PopularScents.tsx  Landing page popular fragrance suggestions
    HowItWorks.tsx    Landing page explainer section
    MicroInteractions.tsx Animation helpers
    FeatureNotReady.tsx Placeholder for unbuilt features
```

## How a search works (frontend perspective)

1. User types a query or uploads a photo in `SearchHeader`.
2. **Photo upload** → `identifyCologneFromImage(base64)` → `POST /api/identify` → server uses Google Lens → returns a name string → passed into the normal search.
3. **Text search** → `searchCologne(query)` → `GET /api/search?q=<query>` → server returns a `ScentDetails` object.
4. `App.tsx` stores the result and renders `ResultsView`.

## API service (`apiService.ts`)

Two functions, both calling the local backend:

```ts
searchCologne(query: string): Promise<ScentDetails>
// GET /api/search?q=<query>
// Returns full fragrance data including sellers and trust scores.

identifyCologneFromImage(base64Image: string): Promise<string>
// POST /api/identify  { image: "<base64>" }
// Returns the identified fragrance name as a string.
```

## Data shape (`ScentDetails`)

```ts
{
  name: string           // e.g. "Aventus"
  brand: string          // e.g. "Creed"
  overview: string       // description paragraph
  notes: {
    top: string[]
    middle: string[]
    base: string[]
  }
  onlineSellers: [{
    name: string         // e.g. "Sephora"
    price: string        // e.g. "$285.00"
    url: string          // direct link to product listing
    credibilityScore: number  // 0–100 (see TRUST_SCORE.md)
    isTrusted: boolean   // true if score ≥ 80
  }]
  physicalStores: [...]  // reserved, not currently populated
}
```

## Trust score display

`TrustedSellers.tsx` renders sellers sorted by `credibilityScore`. The badge colour indicates trust level — see [TRUST_SCORE.md](../TRUST_SCORE.md) for how scores are calculated.

## Running

```bash
npm run dev   # starts Vite dev server on port 3000
```

Requires the backend (`server/`) to be running on port 3001.
