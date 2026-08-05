import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoLinking from 'expo-linking';
import {
  devSignIn,
  fetchMe,
  signOutServer,
  googleSignInUrl,
  pushLibrarySnapshot,
  fetchLibrarySnapshot,
  fetchWearHistory,
  type AuthUser,
} from '../services/api';
import { useLibrary, type LibrarySnapshot } from './LibraryContext';
import type { CollectionItem } from '../types';

const TOKEN_KEY = 'sniffy:authToken';
const USER_KEY = 'sniffy:authUser';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  signInWithGoogle: () => void;
  signInDev: (email: string, name: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const {
    collection,
    wishlist,
    currentlyWearing,
    showcaseSlugs,
    sections,
    complimentLog,
    loaded,
    hydrateFromServer,
    replaceWearLog,
  } = useLibrary();
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep latest local library in a ref so adoptSession can decide
  // restore-vs-push without stale closures. `loaded` guards against a race
  // where AsyncStorage hasn't been read yet and local looks falsely empty.
  const libraryRef = useRef({ collection, wishlist, loaded });
  libraryRef.current = { collection, wishlist, loaded };

  const adoptSession = useCallback((nextToken: string, nextUser: AuthUser) => {
    setToken(nextToken);
    setUser(nextUser);
    AsyncStorage.setItem(TOKEN_KEY, nextToken);
    AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));

    // Wear dates are server-authoritative — adopt the account's history
    fetchWearHistory(nextToken)
      .then(wears => {
        if (wears.length > 0) {
          replaceWearLog(wears.map(wear => ({ slug: wear.slug, date: wear.wornOn })));
        }
      })
      .catch(() => {});

    // Account restore: if this device has no library but the account does,
    // pull the server copy so the app comes back exactly as it was.
    const local = libraryRef.current;
    if (local.loaded && local.collection.length === 0 && local.wishlist.length === 0) {
      fetchLibrarySnapshot(nextToken)
        .then(snapshot => {
          if ((snapshot.collection?.length ?? 0) === 0 && (snapshot.wishlist?.length ?? 0) === 0) {
            return;
          }
          const collectionItems = (snapshot.collection ?? []).map(item => {
            const { lastWornOn, ...rest } = item;
            const restored = rest as unknown as CollectionItem;
            if (typeof lastWornOn === 'string') {
              restored.lastWornAt = new Date(`${lastWornOn}T12:00:00`).getTime();
            }
            return restored;
          });
          hydrateFromServer({
            ...snapshot,
            collection: collectionItems,
            wishlist: (snapshot.wishlist ?? []) as unknown as LibrarySnapshot['wishlist'],
          });
        })
        .catch(() => {});
    }
  }, [hydrateFromServer, replaceWearLog]);

  // Restore the session, then re-validate against the server
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(TOKEN_KEY), AsyncStorage.getItem(USER_KEY)]).then(
      ([storedToken, storedUser]) => {
        if (!storedToken) {
          return;
        }
        setToken(storedToken);
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch {}
        }
        fetchMe(storedToken)
          .then(freshUser => adoptSession(storedToken, freshUser))
          .catch(() => {
            // Token invalid/expired — clear the session
            setToken(null);
            setUser(null);
            AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
          });
      },
    );
  }, [adoptSession]);

  // Handle the Google flow's deep link back into the app: sniffy://auth?token=…
  useEffect(() => {
    function handleUrl(url: string | null) {
      if (!url) {
        return;
      }
      const parsed = ExpoLinking.parse(url);
      const deepLinkToken = parsed.queryParams?.token;
      if (typeof deepLinkToken === 'string' && deepLinkToken.length > 0) {
        fetchMe(deepLinkToken)
          .then(freshUser => adoptSession(deepLinkToken, freshUser))
          .catch(() => {});
      }
    }
    const subscription = Linking.addEventListener('url', event => handleUrl(event.url));
    Linking.getInitialURL().then(handleUrl);
    return () => subscription.remove();
  }, [adoptSession]);

  const signInWithGoogle = useCallback(() => {
    const returnUrl = ExpoLinking.createURL('auth');
    Linking.openURL(googleSignInUrl(returnUrl)).catch(() => {});
  }, []);

  const signInDev = useCallback(async (email: string, name: string) => {
    const session = await devSignIn(email, name);
    adoptSession(session.token, session.user);
  }, [adoptSession]);

  const signOut = useCallback(() => {
    if (token) {
      signOutServer(token);
    }
    setToken(null);
    setUser(null);
    AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  }, [token]);

  // Keep the server copy of the library fresh (drives the social profile).
  // Debounced so rapid edits (ratings, wears) collapse into one push.
  useEffect(() => {
    if (!token || !loaded) {
      return;
    }
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
    }
    syncTimer.current = setTimeout(() => {
      pushLibrarySnapshot(token, {
        collection,
        wishlist,
        currentlyWearingSlug: currentlyWearing,
        showcaseSlugs,
        sections,
        complimentLog,
      }).catch(() => {});
    }, 2000);
    return () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
      }
    };
  }, [token, loaded, collection, wishlist, currentlyWearing, showcaseSlugs, sections, complimentLog]);

  return (
    <AuthContext.Provider value={{ user, token, signInWithGoogle, signInDev, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
