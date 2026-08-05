export interface OnlineSeller {
  name: string;
  price: string;
  url: string;
  credibilityScore: number;
  isTrusted: boolean;
}

export interface FragranceNotes {
  top: string[];
  middle: string[];
  base: string[];
}

// Map of note name → thumbnail image URL (from Fragrantica's CDN)
export type NoteImages = Record<string, string>;

export interface FragranceResult {
  name: string;
  brand: string;
  overview: string;
  imageUrl?: string;
  notes: FragranceNotes;
  noteImages?: NoteImages;
  onlineSellers: OnlineSeller[];
}

// Lightweight info from /api/info — everything Sniffy needs, no sellers
export interface FragranceInfo {
  name: string;
  brand: string;
  overview: string;
  imageUrl?: string;
  notes: FragranceNotes;
  noteImages?: NoteImages;
}

// User taste profile, stored on the server (shared with Sniffer)
export const SCENT_FAMILIES = [
  'fresh', 'citrus', 'aquatic', 'warm & spicy', 'woody',
  'sweet & gourmand', 'floral', 'powdery', 'leather', 'green',
] as const;
export type ScentFamily = (typeof SCENT_FAMILIES)[number];

export type GenderPreference = 'men' | 'women' | 'all';

export interface UserProfile {
  genderPreference: GenderPreference;
  scentFamilies: ScentFamily[];
}

// One row from /api/suggest — a fragrance identity straight from the search index
export interface FragranceSuggestion {
  id: string;
  name: string;
  brand: string;
  year?: number;
  gender?: string;
  thumbnail?: string;
  imageUrl?: string;
  url: string;
}

export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const OCCASIONS = ['daily', 'office', 'night out', 'date', 'formal', 'sport'] as const;
export type Occasion = (typeof OCCASIONS)[number];

// A user-defined shelf inside the collection ("Woody", "Summer rotation", …)
export interface CollectionSection {
  id: string;
  name: string;
}

// One day a fragrance was worn (dates are YYYY-MM-DD)
export interface WearEvent {
  slug: string;
  date: string;
}

// Compliments received for a fragrance on a given day
export interface ComplimentEvent {
  slug: string;
  date: string;
  count: number;
}

// A fragrance saved by the user (collection or wishlist).
// Older persisted items only carry slug/name/brand/rating/addedAt —
// every newer field must stay optional for backward compatibility.
export interface SavedFragrance {
  slug: string;
  name: string;
  brand: string;
  addedAt: number;
  imageUrl?: string;
  rating?: number;         // 1–5; in the wishlist this reads as "want it" priority
  review?: string;
  seasons?: Season[];
  occasions?: Occasion[];
  notes?: FragranceNotes;  // snapshot taken when saved from search
  noteImages?: NoteImages; // note-name → thumbnail, snapshot from search
  overview?: string;
  lowestPrice?: string;    // cached at time of save
  wearCount?: number;
  lastWornAt?: number;
  sectionId?: string;      // collection section this bottle lives in
}

export type CollectionItem = SavedFragrance;
export type WishlistItem = SavedFragrance;
