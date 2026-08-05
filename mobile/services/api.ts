import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FragranceResult, FragranceSuggestion, FragranceInfo, UserProfile } from '../types';

// When running on a real device, point these to your server's local network IP.
// When running in the iOS Simulator, localhost works fine.
const BASE_URL = __DEV__
  ? 'http://localhost:3001'
  : 'https://your-production-api.com'; // TODO: replace when deployed

// The Sniffer website (price comparison) — used for "see prices" links
export const SNIFFER_WEB_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://your-production-site.com'; // TODO: replace when deployed

export { type FragranceResult, type FragranceSuggestion, type FragranceInfo, type UserProfile };

// Fast multi-result search: identity, year, and image only (~10s uncached, instant
// cached). Pass the auth token so results are ordered by the account's profile.
export async function suggestFragrances(query: string, token?: string): Promise<FragranceSuggestion[]> {
  const response = await fetch(`${BASE_URL}/api/suggest?q=${encodeURIComponent(query)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? 'Search failed');
  }
  return (json.suggestions ?? []) as FragranceSuggestion[];
}

// Lightweight fragrance info: notes, overview, image — NO seller scraping.
// When called with a suggestion's url/brand/name, the server skips the search
// step and only reads the fragrance page (~5s uncached, instant cached).
export async function fetchFragranceInfo(params: {
  query?: string;
  name?: string;
  brand?: string;
  url?: string;
  imageUrl?: string;
}): Promise<FragranceInfo> {
  const searchParams = new URLSearchParams();
  if (params.query) {
    searchParams.set('q', params.query);
  }
  if (params.url && params.brand && params.name) {
    searchParams.set('url', params.url);
    searchParams.set('brand', params.brand);
    searchParams.set('name', params.name);
    if (params.imageUrl) {
      searchParams.set('image', params.imageUrl);
    }
  }
  const response = await fetch(`${BASE_URL}/api/info?${searchParams.toString()}`);
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? 'Could not load fragrance info');
  }
  return json as FragranceInfo;
}

// Client-side info cache: previously viewed fragrances open instantly and
// work offline. Keyed by brand+name, 30-day TTL.
const INFO_CACHE_PREFIX = 'sniffy:infoCache:';
const INFO_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function fetchFragranceInfoCached(params: {
  query?: string;
  name?: string;
  brand?: string;
  url?: string;
  imageUrl?: string;
}): Promise<FragranceInfo> {
  const cacheKey = `${INFO_CACHE_PREFIX}${(params.brand ?? '')}|${(params.name ?? params.query ?? '')}`.toLowerCase();
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      const cached = JSON.parse(raw) as { savedAt: number; info: FragranceInfo };
      if (Date.now() - cached.savedAt < INFO_CACHE_TTL_MS) {
        return cached.info;
      }
    }
  } catch {}
  const info = await fetchFragranceInfo(params);
  AsyncStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), info })).catch(() => {});
  return info;
}

export async function getProfile(token?: string): Promise<UserProfile> {
  const response = await fetch(`${BASE_URL}/api/profile`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? 'Could not load profile');
  }
  return json.profile as UserProfile;
}

export async function saveProfile(profile: UserProfile, token?: string): Promise<UserProfile> {
  const response = await fetch(`${BASE_URL}/api/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(profile),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? 'Could not save profile');
  }
  return json.profile as UserProfile;
}

export function snifferPageUrl(brand: string, name: string): string {
  return `${SNIFFER_WEB_URL}/?q=${encodeURIComponent(`${brand} ${name}`)}`;
}

// Auth & social

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture: string | null;
}

export interface SocialProfileItem {
  slug: string;
  name: string;
  brand: string;
  imageUrl?: string;
  rating?: number;
  wearCount?: number;
}

export interface SocialProfile {
  user: { id: number; name: string; picture: string | null };
  showcase: SocialProfileItem[];
  showcaseIsCurated: boolean;
  currentlyWearing: SocialProfileItem | null;
  stats: {
    bottles: number;
    wishlistCount: number;
    totalWears: number;
    averageRating: number;
  };
}

export function googleSignInUrl(returnUrl: string): string {
  return `${BASE_URL}/api/auth/google/start?return=${encodeURIComponent(returnUrl)}`;
}

export async function devSignIn(email: string, name: string): Promise<{ token: string; user: AuthUser }> {
  const response = await fetch(`${BASE_URL}/api/auth/dev`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? 'Sign-in failed');
  }
  return json as { token: string; user: AuthUser };
}

export async function fetchMe(token: string): Promise<AuthUser> {
  const response = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? 'Session expired');
  }
  return json.user as AuthUser;
}

export async function signOutServer(token: string): Promise<void> {
  await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

export async function pushLibrarySnapshot(
  token: string,
  payload: {
    collection: unknown[];
    wishlist: unknown[];
    currentlyWearingSlug: string | null;
    showcaseSlugs: string[];
    sections: unknown[];
    complimentLog: unknown[];
  },
): Promise<void> {
  await fetch(`${BASE_URL}/api/social/library`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

// Pull the server copy of the library (used to restore after sign-in).
// Collection items carry server-verified wearCount and lastWornOn.
export async function fetchLibrarySnapshot(token: string): Promise<{
  collection: Array<Record<string, unknown> & { wearCount?: number; lastWornOn?: string }>;
  wishlist: Array<Record<string, unknown>>;
  currentlyWearingSlug?: string | null;
  showcaseSlugs?: string[];
  sections?: Array<{ id: string; name: string }>;
  complimentLog?: Array<{ slug: string; date: string; count: number }>;
}> {
  const response = await fetch(`${BASE_URL}/api/social/library`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? 'Could not load library');
  }
  return json.library;
}

// Full wear history from the server (dates per bottle, for graphs/restore)
export async function fetchWearHistory(token: string): Promise<Array<{ slug: string; wornOn: string }>> {
  const response = await fetch(`${BASE_URL}/api/social/wears`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? 'Could not load wear history');
  }
  return json.wears;
}

// Server-authoritative wear logging — rejects a second wear on the same day
export async function logWearOnServer(
  token: string,
  slug: string,
): Promise<{ wearCount: number; lastWornOn?: string }> {
  const response = await fetch(`${BASE_URL}/api/social/wear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ slug }),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? 'Could not log wear');
  }
  return json as { wearCount: number; lastWornOn?: string };
}

export async function fetchMySocialProfile(token: string): Promise<SocialProfile> {
  const response = await fetch(`${BASE_URL}/api/social/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? 'Could not load profile');
  }
  return json.profile as SocialProfile;
}
