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
}

export interface ScrapedSeller {
  name: string;
  price: string;
  url: string;
  credibilityScore: number;
  isTrusted: boolean;
}

// Matches the client's ScentDetails interface
export interface ScentDetails {
  name: string;
  brand: string;
  overview: string;
  notes: {
    top: string[];
    middle: string[];
    base: string[];
  };
  onlineSellers: {
    name: string;
    price: string;
    url: string;
    credibilityScore: number;
    isTrusted: boolean;
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
