
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

export interface PopularScent {
  id: string;
  name: string;
  brand: string;
  image: string;
}
