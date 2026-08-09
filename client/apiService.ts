import { ScentDetails, NearbyStore, FragranceSuggestion, FragranceInfo, Seller } from './types';

export const SERVER_URL = import.meta.env.VITE_SERVER_URL as string ?? 'http://localhost:3001';

// Where the session token lives (set after Google sign-in). Shared with App.tsx.
export const AUTH_TOKEN_KEY = 'sniffer:authToken';

// Canonical privacy policy, served by the API server (see server routes/legal.ts)
export const PRIVACY_POLICY_URL = `${SERVER_URL}/privacy`;

function storedToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = storedToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Session-lifetime in-memory caches. The server already caches suggestions
// (30 min) and search/info/prices (DB by slug); these just avoid re-fetching
// within a single browser session so re-searching a term or re-opening a picked
// cologne is instant. Cleared on page reload — no persistence needed.
const suggestionCache = new Map<string, FragranceSuggestion[]>();
const searchCache = new Map<string, ScentDetails>();
const infoCache = new Map<string, FragranceInfo>();
const priceCache = new Map<string, Seller[]>();

function cacheKey(query: string): string {
  return query.trim().toLowerCase();
}

// Auth (shared with the Sniffy mobile app)

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture: string | null;
}

export function googleSignInUrl(): string {
  return `${SERVER_URL}/api/auth/google/start?return=${encodeURIComponent(window.location.origin + '/')}`;
}

export async function fetchMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${SERVER_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Session expired');
  const json = await res.json() as { user: AuthUser };
  return json.user;
}

export async function signOutServer(token: string): Promise<void> {
  await fetch(`${SERVER_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

// Taste profile — per account when signed in (drives gender-sorted search).

export interface UserProfile {
  genderPreference: 'men' | 'women' | 'all';
  scentFamilies: string[];
}

export async function getProfile(): Promise<{ profile: UserProfile; scentFamilyOptions: string[] }> {
  const res = await fetch(`${SERVER_URL}/api/profile`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error('Could not load profile');
  }
  return res.json() as Promise<{ profile: UserProfile; scentFamilyOptions: string[] }>;
}

export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  const res = await fetch(`${SERVER_URL}/api/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    throw new Error('Could not save profile');
  }
  const json = await res.json() as { profile: UserProfile };
  // Search ordering depends on the profile — drop cached suggestion orderings.
  suggestionCache.clear();
  return json.profile;
}

// Called on sign-in / sign-out so cached suggestion orderings don't leak across
// accounts (a logged-out order shouldn't persist after signing in, etc.).
export function clearSuggestionCache(): void {
  suggestionCache.clear();
}

// Fast multi-result search. Returns the list the user picks from before we run
// the slow price scrape. Cached in-memory for the session.
export async function suggestCologne(query: string): Promise<FragranceSuggestion[]> {
  const key = cacheKey(query);
  const cached = suggestionCache.get(key);
  if (cached) {
    return cached;
  }
  // Send the auth token so the server orders results by the user's gender
  // preference (preferred gender first, then unisex, then the rest).
  const res = await fetch(`${SERVER_URL}/api/suggest?q=${encodeURIComponent(query)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Server error ${res.status}`);
  }
  const json = await res.json() as { suggestions?: FragranceSuggestion[] };
  const suggestions = json.suggestions ?? [];
  suggestionCache.set(key, suggestions);
  return suggestions;
}

// Fast fragrance info (notes/overview/image, NO sellers). Uses the suggestion's
// known Fragrantica URL so the server skips its search step (~3-5s uncached,
// instant once cached). Lets the results page render before prices arrive.
export async function fetchFragranceInfo(suggestion: FragranceSuggestion): Promise<FragranceInfo> {
  const key = cacheKey(`${suggestion.brand} ${suggestion.name}`);
  const cached = infoCache.get(key);
  if (cached) {
    return cached;
  }
  const params = new URLSearchParams({
    url: suggestion.url,
    brand: suggestion.brand,
    name: suggestion.name,
  });
  if (suggestion.imageUrl) {
    params.set('image', suggestion.imageUrl);
  }
  const res = await fetch(`${SERVER_URL}/api/info?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Server error ${res.status}`);
  }
  const info = await res.json() as FragranceInfo;
  infoCache.set(key, info);
  return info;
}

// Sellers only for an already-identified cologne (Bing, fast). Runs in the
// background after the page renders. Warm-cached server-side + here per session.
export async function fetchPrices(brand: string, name: string): Promise<Seller[]> {
  const key = cacheKey(`${brand} ${name}`);
  const cached = priceCache.get(key);
  if (cached) {
    return cached;
  }
  const params = new URLSearchParams({ brand, name });
  const res = await fetch(`${SERVER_URL}/api/prices?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Server error ${res.status}`);
  }
  const json = await res.json() as { onlineSellers?: Seller[] };
  const sellers = json.onlineSellers ?? [];
  priceCache.set(key, sellers);
  return sellers;
}

// Full price-comparison payload (sellers, notes, images). Slow on first scrape,
// DB-cached server-side by slug; also cached in-memory here for the session.
export async function searchCologne(query: string): Promise<ScentDetails | null> {
  const key = cacheKey(query);
  const cached = searchCache.get(key);
  if (cached) {
    return cached;
  }
  const res = await fetch(`${SERVER_URL}/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Server error ${res.status}`);
  }
  const data = await res.json() as ScentDetails;
  searchCache.set(key, data);
  return data;
}

export async function getNearbyStores(lat: number, lng: number, brand: string): Promise<NearbyStore[]> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), brand });
  const res = await fetch(`${SERVER_URL}/api/stores/nearby?${params}`);
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json() as Promise<NearbyStore[]>;
}

export async function identifyCologneFromImage(base64Image: string): Promise<string> {
  const res = await fetch(`${SERVER_URL}/api/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Server error ${res.status}`);
  }
  const data = await res.json() as { name: string };
  return data.name;
}
