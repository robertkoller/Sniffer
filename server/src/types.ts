export interface CologneRow {
  id: number;
  slug: string;
  name: string;
  brand: string;
  overview: string | null;
  notes_top: string;
  notes_middle: string;
  notes_base: string;
  fragrantica_url: string | null;
  image_url: string | null;
  note_images: string | null; // JSON map of note name → image URL
  last_scraped_at: number | null;
  created_at: number;
}

export interface SellerRow {
  id: number;
  cologne_id: number;
  name: string;
  price: string;
  url: string;
  credibility_score: number;
  is_trusted: number; // SQLite stores booleans as 0/1
  size_oz: number | null; // detected bottle size in oz; null = size unknown (Bing truncates)
  updated_at: number;
}

export interface StoreRow {
  id: number;
  cologne_id: number;
  name: string;
  location: string | null;
  url: string | null;
}

export interface ScrapedCologne {
  name: string;
  brand: string;
  overview: string;
  notes: {
    top: string[];
    middle: string[];
    base: string[];
  };
  url: string;
  imageUrl?: string;
  noteImages?: Record<string, string>;
}

// User taste profile — per-account when signed in, else a legacy single-user
// record in the settings table. Drives search ordering and taste matching.
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

export const DEFAULT_PROFILE: UserProfile = {
  genderPreference: 'all',
  scentFamilies: [],
};

export interface ScrapedSeller {
  name: string;
  price: string;
  url: string;
  credibilityScore: number;
  isTrusted: boolean;
  sizeOz?: number | null; // detected bottle size in oz; null/undefined = size unknown
}

// Matches the client's ScentDetails interface
export interface ScentDetails {
  name: string;
  brand: string;
  overview: string;
  imageUrl?: string;
  notes: {
    top: string[];
    middle: string[];
    base: string[];
  };
  noteImages?: Record<string, string>;
  onlineSellers: {
    name: string;
    price: string;
    url: string;
    credibilityScore: number;
    isTrusted: boolean;
    sizeOz?: number | null;
  }[];
  physicalStores: {
    name: string;
    location?: string;
    url: string;
  }[];
  imagePrompt: string;
  exists: boolean;
  isUncertain: boolean;
  uncertaintyWarning?: string;
}
