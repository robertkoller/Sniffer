import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfile, saveProfile } from '../services/api';
import { useAuth } from './AuthContext';
import type { UserProfile } from '../types';

const PROFILE_KEY = 'sniffy:profile';

const DEFAULT_PROFILE: UserProfile = {
  genderPreference: 'all',
  scentFamilies: [],
};

interface ProfileContextValue {
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const { token } = useAuth();

  // Local cache loads instantly; the server copy (per-account when signed in)
  // overwrites it when reachable. Re-runs on sign-in/out so account
  // preferences follow the account.
  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then(raw => {
      if (raw) {
        try {
          setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(raw) });
        } catch {}
      }
    });
    getProfile(token ?? undefined)
      .then(serverProfile => {
        setProfile(serverProfile);
        AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(serverProfile));
      })
      .catch(() => {});
  }, [token]);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile(current => {
      const next = { ...current, ...patch };
      AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      saveProfile(next, token ?? undefined).catch(() => {});
      return next;
    });
  }, [token]);

  return (
    <ProfileContext.Provider value={{ profile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used inside a ProfileProvider');
  }
  return context;
}
