import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CollectionItem, WishlistItem, SavedFragrance, CollectionSection, WearEvent, ComplimentEvent } from '../types';

const COLLECTION_KEY = 'sniffy:collection';
const WISHLIST_KEY = 'sniffy:wishlist';
const WEARING_KEY = 'sniffy:currentlyWearing';
const SHOWCASE_KEY = 'sniffy:showcase';
const SECTIONS_KEY = 'sniffy:sections';
const WEAR_LOG_KEY = 'sniffy:wearLog';
const COMPLIMENT_LOG_KEY = 'sniffy:complimentLog';
const RATING_SCALE_KEY = 'sniffy:ratingsV2'; // set once ratings are on the 0–10 scale

function todayString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Everything the server stores for a signed-in user, used for full restore
export interface LibrarySnapshot {
  collection: CollectionItem[];
  wishlist: WishlistItem[];
  currentlyWearingSlug?: string | null;
  showcaseSlugs?: string[];
  sections?: CollectionSection[];
  complimentLog?: ComplimentEvent[];
}

// Legacy ratings were 1–5 stars; the app now uses 0–10 with one decimal
function migrateRatings<T extends SavedFragrance>(items: T[]): T[] {
  return items.map(item =>
    item.rating !== undefined ? { ...item, rating: Math.min(item.rating * 2, 10) } : item,
  );
}

interface LibraryContextValue {
  collection: CollectionItem[];
  wishlist: WishlistItem[];
  currentlyWearing: string | null; // slug of a collection item
  setCurrentlyWearing: (slug: string | null) => void;
  showcaseSlugs: string[];         // user-curated display shelf (max 10)
  toggleShowcase: (slug: string) => void;
  sections: CollectionSection[];
  addSection: (name: string) => void;
  removeSection: (id: string) => void;
  setSections: (sections: CollectionSection[]) => void;
  wearLog: WearEvent[];
  replaceWearLog: (events: WearEvent[]) => void;
  complimentLog: ComplimentEvent[];
  addCompliment: (slug: string) => void;
  hydrateFromServer: (snapshot: LibrarySnapshot) => void;
  loaded: boolean;

  addToCollection: (item: Omit<SavedFragrance, 'addedAt'>) => void;
  removeFromCollection: (slug: string) => void;
  updateCollectionItem: (slug: string, patch: Partial<SavedFragrance>) => void;
  logWear: (slug: string) => void;

  addToWishlist: (item: Omit<SavedFragrance, 'addedAt'>) => void;
  removeFromWishlist: (slug: string) => void;
  updateWishlistItem: (slug: string, patch: Partial<SavedFragrance>) => void;
  moveToCollection: (slug: string) => void;

  isInCollection: (slug: string) => boolean;
  isInWishlist: (slug: string) => boolean;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [currentlyWearing, setCurrentlyWearingState] = useState<string | null>(null);
  const [showcaseSlugs, setShowcaseSlugs] = useState<string[]>([]);
  const [sections, setSectionsState] = useState<CollectionSection[]>([]);
  const [wearLog, setWearLog] = useState<WearEvent[]>([]);
  const [complimentLog, setComplimentLog] = useState<ComplimentEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(COLLECTION_KEY),
      AsyncStorage.getItem(WISHLIST_KEY),
      AsyncStorage.getItem(WEARING_KEY),
      AsyncStorage.getItem(SHOWCASE_KEY),
      AsyncStorage.getItem(SECTIONS_KEY),
      AsyncStorage.getItem(RATING_SCALE_KEY),
    ]).then(([rawCollection, rawWishlist, rawWearing, rawShowcase, rawSections, ratingScaleFlag]) => {
      const needsRatingMigration = !ratingScaleFlag;
      if (rawCollection) {
        try {
          let items = JSON.parse(rawCollection) as CollectionItem[];
          if (needsRatingMigration) {
            items = migrateRatings(items);
            AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(items));
          }
          setCollection(items);
        } catch {}
      }
      if (rawWishlist) {
        try {
          let items = JSON.parse(rawWishlist) as WishlistItem[];
          if (needsRatingMigration) {
            items = migrateRatings(items);
            AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
          }
          setWishlist(items);
        } catch {}
      }
      if (needsRatingMigration) {
        AsyncStorage.setItem(RATING_SCALE_KEY, '1');
      }
      if (rawWearing) {
        setCurrentlyWearingState(rawWearing);
      }
      if (rawShowcase) {
        try {
          setShowcaseSlugs(JSON.parse(rawShowcase));
        } catch {}
      }
      if (rawSections) {
        try {
          setSectionsState(JSON.parse(rawSections));
        } catch {}
      }
      AsyncStorage.getItem(WEAR_LOG_KEY).then(raw => {
        if (raw) {
          try {
            setWearLog(JSON.parse(raw));
          } catch {}
        }
      });
      AsyncStorage.getItem(COMPLIMENT_LOG_KEY).then(raw => {
        if (raw) {
          try {
            setComplimentLog(JSON.parse(raw));
          } catch {}
        }
      });
      setLoaded(true);
    });
  }, []);

  // Used after sign-in to adopt the server's authoritative wear history
  const replaceWearLog = useCallback((events: WearEvent[]) => {
    setWearLog(events);
    AsyncStorage.setItem(WEAR_LOG_KEY, JSON.stringify(events));
  }, []);

  const addCompliment = useCallback((slug: string) => {
    setComplimentLog(current => {
      const today = todayString();
      const existingIndex = current.findIndex(entry => entry.slug === slug && entry.date === today);
      const next = existingIndex >= 0
        ? current.map((entry, index) =>
            index === existingIndex ? { ...entry, count: entry.count + 1 } : entry)
        : [...current, { slug, date: today, count: 1 }];
      AsyncStorage.setItem(COMPLIMENT_LOG_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setSections = useCallback((next: CollectionSection[]) => {
    setSectionsState(next);
    AsyncStorage.setItem(SECTIONS_KEY, JSON.stringify(next));
  }, []);

  const addSection = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setSectionsState(current => {
      if (current.some(section => section.name.toLowerCase() === trimmed.toLowerCase()) || current.length >= 30) {
        return current;
      }
      const next = [...current, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: trimmed }];
      AsyncStorage.setItem(SECTIONS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeSection = useCallback((id: string) => {
    setSectionsState(current => {
      const next = current.filter(section => section.id !== id);
      AsyncStorage.setItem(SECTIONS_KEY, JSON.stringify(next));
      return next;
    });
    // Items in the deleted section fall back to unsectioned
    setCollection(current => {
      const next = current.map(item => (item.sectionId === id ? { ...item, sectionId: undefined } : item));
      AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Full restore from the server copy (after sign-in on a fresh install)
  const hydrateFromServer = useCallback((snapshot: LibrarySnapshot) => {
    const collectionItems = (snapshot.collection ?? []).map(item => ({
      ...item,
      addedAt: item.addedAt ?? Date.now(),
    }));
    const wishlistItems = (snapshot.wishlist ?? []).map(item => ({
      ...item,
      addedAt: item.addedAt ?? Date.now(),
    }));
    setCollection(collectionItems);
    setWishlist(wishlistItems);
    setShowcaseSlugs(snapshot.showcaseSlugs ?? []);
    setSectionsState(snapshot.sections ?? []);
    setComplimentLog(snapshot.complimentLog ?? []);
    setCurrentlyWearingState(snapshot.currentlyWearingSlug ?? null);
    AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(collectionItems));
    AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlistItems));
    AsyncStorage.setItem(SHOWCASE_KEY, JSON.stringify(snapshot.showcaseSlugs ?? []));
    AsyncStorage.setItem(SECTIONS_KEY, JSON.stringify(snapshot.sections ?? []));
    AsyncStorage.setItem(COMPLIMENT_LOG_KEY, JSON.stringify(snapshot.complimentLog ?? []));
    if (snapshot.currentlyWearingSlug) {
      AsyncStorage.setItem(WEARING_KEY, snapshot.currentlyWearingSlug);
    } else {
      AsyncStorage.removeItem(WEARING_KEY);
    }
  }, []);

  const toggleShowcase = useCallback((slug: string) => {
    setShowcaseSlugs(current => {
      const next = current.includes(slug)
        ? current.filter(existing => existing !== slug)
        : current.length < 10
          ? [...current, slug]
          : current;
      AsyncStorage.setItem(SHOWCASE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setCurrentlyWearing = useCallback((slug: string | null) => {
    setCurrentlyWearingState(slug);
    if (slug) {
      AsyncStorage.setItem(WEARING_KEY, slug);
    } else {
      AsyncStorage.removeItem(WEARING_KEY);
    }
  }, []);

  const persistCollection = useCallback((next: CollectionItem[]) => {
    setCollection(next);
    AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(next));
  }, []);

  const persistWishlist = useCallback((next: WishlistItem[]) => {
    setWishlist(next);
    AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
  }, []);

  const addToCollection = useCallback((item: Omit<SavedFragrance, 'addedAt'>) => {
    setCollection(current => {
      if (current.some(existing => existing.slug === item.slug)) {
        return current;
      }
      const next = [{ ...item, addedAt: Date.now() }, ...current];
      AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeFromCollection = useCallback((slug: string) => {
    setCollection(current => {
      const next = current.filter(item => item.slug !== slug);
      AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(next));
      return next;
    });
    // Keep showcase and currently-wearing consistent with the collection
    setShowcaseSlugs(current => {
      if (!current.includes(slug)) {
        return current;
      }
      const next = current.filter(existing => existing !== slug);
      AsyncStorage.setItem(SHOWCASE_KEY, JSON.stringify(next));
      return next;
    });
    setCurrentlyWearingState(current => {
      if (current !== slug) {
        return current;
      }
      AsyncStorage.removeItem(WEARING_KEY);
      return null;
    });
  }, []);

  const updateCollectionItem = useCallback((slug: string, patch: Partial<SavedFragrance>) => {
    setCollection(current => {
      const next = current.map(item => (item.slug === slug ? { ...item, ...patch } : item));
      AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const logWear = useCallback((slug: string) => {
    setCollection(current => {
      const next = current.map(item =>
        item.slug === slug
          ? { ...item, wearCount: (item.wearCount ?? 0) + 1, lastWornAt: Date.now() }
          : item,
      );
      AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(next));
      return next;
    });
    // Logging a wear also makes it today's scent and records the date for graphs
    setCurrentlyWearing(slug);
    setWearLog(current => {
      const today = todayString();
      if (current.some(event => event.slug === slug && event.date === today)) {
        return current;
      }
      const next = [...current, { slug, date: today }];
      AsyncStorage.setItem(WEAR_LOG_KEY, JSON.stringify(next));
      return next;
    });
  }, [setCurrentlyWearing]);

  const addToWishlist = useCallback((item: Omit<SavedFragrance, 'addedAt'>) => {
    setWishlist(current => {
      if (current.some(existing => existing.slug === item.slug)) {
        return current;
      }
      const next = [{ ...item, addedAt: Date.now() }, ...current];
      AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeFromWishlist = useCallback((slug: string) => {
    setWishlist(current => {
      const next = current.filter(item => item.slug !== slug);
      AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateWishlistItem = useCallback((slug: string, patch: Partial<SavedFragrance>) => {
    setWishlist(current => {
      const next = current.map(item => (item.slug === slug ? { ...item, ...patch } : item));
      AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // "Got it" — a wishlist fragrance was purchased; carry its data into the collection.
  const moveToCollection = useCallback(
    (slug: string) => {
      const entry = wishlist.find(item => item.slug === slug);
      if (entry && !collection.some(existing => existing.slug === slug)) {
        const moved: CollectionItem = {
          ...entry,
          rating: undefined, // wishlist rating meant "want it", not quality
          addedAt: Date.now(),
        };
        persistCollection([moved, ...collection]);
      }
      persistWishlist(wishlist.filter(item => item.slug !== slug));
    },
    [wishlist, collection, persistCollection, persistWishlist],
  );

  const isInCollection = useCallback(
    (slug: string) => collection.some(item => item.slug === slug),
    [collection],
  );

  const isInWishlist = useCallback(
    (slug: string) => wishlist.some(item => item.slug === slug),
    [wishlist],
  );

  return (
    <LibraryContext.Provider
      value={{
        collection,
        wishlist,
        currentlyWearing,
        setCurrentlyWearing,
        showcaseSlugs,
        toggleShowcase,
        sections,
        addSection,
        removeSection,
        setSections,
        wearLog,
        replaceWearLog,
        complimentLog,
        addCompliment,
        hydrateFromServer,
        loaded,
        addToCollection,
        removeFromCollection,
        updateCollectionItem,
        logWear,
        addToWishlist,
        removeFromWishlist,
        updateWishlistItem,
        moveToCollection,
        isInCollection,
        isInWishlist,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used inside a LibraryProvider');
  }
  return context;
}
