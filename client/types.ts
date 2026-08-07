
export interface GroundingSource {
  title?: string;
  url: string;
}

export interface Seller {
  name: string;
  price: string;
  url: string;
  credibilityScore: number; // 0-100
  isTrusted: boolean;
}

export interface Store {
  name: string;
  location?: string;
  url: string;
}

export interface ScentDetails {
  name: string;
  brand: string;
  overview: string;
  notes: {
    top: string[];
    middle: string[];
    base: string[];
  };
  onlineSellers: Seller[];
  physicalStores: Store[];
  imagePrompt: string;
  groundingSources?: GroundingSource[];
  // New safety fields
  exists: boolean;
  isUncertain: boolean;
  uncertaintyWarning?: string;
}

// Fast fragrance info from /api/info — notes/overview/image, NO sellers. Lets
// the results page render immediately while prices load separately.
export interface FragranceInfo {
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
}

// A single match from the fast /api/suggest endpoint. Users pick one of these
// before we run the slow price scrape. Shape mirrors the server + mobile app.
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

export interface NearbyStore {
  name: string;
  address: string;
  distance: number; // miles
  lat: number;
  lng: number;
  stockLikelihood: 'likely' | 'uncertain';
}

export interface PopularScent {
  id: string;
  name: string;
  brand: string;
  image: string;
}
