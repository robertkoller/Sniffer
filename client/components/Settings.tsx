import React, { useEffect, useState } from 'react';
import { ChevronLeft, User, SlidersHorizontal, Check, LogOut, Sparkles } from 'lucide-react';
import { getProfile, saveProfile, UserProfile, AuthUser } from '../apiService';

interface SettingsProps {
  user: AuthUser;
  onBack: () => void;
  onSignOut: () => void;
  onProfileChange?: () => void;
}

const GENDER_OPTIONS: { value: UserProfile['genderPreference']; label: string; caption: string }[] = [
  { value: 'men', label: "Men's", caption: 'Show masculine scents first' },
  { value: 'women', label: "Women's", caption: 'Show feminine scents first' },
  { value: 'all', label: 'Everything', caption: 'No preference' },
];

const Settings: React.FC<SettingsProps> = ({ user, onBack, onSignOut, onProfileChange }) => {
  const [profile, setProfile] = useState<UserProfile>({ genderPreference: 'all', scentFamilies: [] });
  const [familyOptions, setFamilyOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    getProfile()
      .then(({ profile: p, scentFamilyOptions }) => {
        setProfile(p);
        setFamilyOptions(scentFamilyOptions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Persist the whole profile, optimistic. The server reorders search by it, so
  // we tell the parent to refresh any cached ordering.
  const persist = async (next: UserProfile) => {
    setProfile(next);
    try {
      await saveProfile(next);
      setSavedAt(Date.now());
      onProfileChange?.();
    } catch {
      // Non-fatal — the local state still reflects the choice for this session
    }
  };

  const setGender = (genderPreference: UserProfile['genderPreference']) => {
    persist({ ...profile, genderPreference });
  };

  const toggleFamily = (family: string) => {
    const next = profile.scentFamilies.includes(family)
      ? profile.scentFamilies.filter(f => f !== family)
      : [...profile.scentFamilies, family];
    persist({ ...profile, scentFamilies: next });
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 animate-in fade-in duration-500">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-3 text-amber-900/60 hover:text-amber-900 transition-all group font-bold uppercase text-xs tracking-widest mb-10"
      >
        <div className="w-10 h-10 rounded-full border border-amber-900/10 flex items-center justify-center transition-all group-hover:bg-amber-900 group-hover:text-white">
          <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
        </div>
        <span>Back to Search</span>
      </button>

      <h1 className="serif text-5xl text-amber-900 mb-2">Settings</h1>
      <p className="text-amber-900/50 mb-12 font-medium">Tune your account and how Sniffer sorts your searches.</p>

      {/* Account */}
      <section className="bg-white border border-amber-100 rounded-[2rem] p-8 shadow-sm mb-8">
        <div className="flex items-center gap-2 mb-6 text-amber-700">
          <User className="w-4 h-4" />
          <h2 className="text-[11px] font-black uppercase tracking-[0.25em]">Account</h2>
        </div>
        <div className="flex items-center gap-5">
          {user.picture ? (
            <img src={user.picture} alt={user.name} className="w-14 h-14 rounded-full border border-amber-200" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-amber-900 text-white flex items-center justify-center text-xl font-bold serif">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <p className="serif text-2xl text-amber-900 font-bold leading-tight">{user.name}</p>
            <p className="text-amber-900/50 text-sm">{user.email}</p>
          </div>
          <button
            onClick={onSignOut}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-900 rounded-full hover:bg-amber-100 transition-colors font-bold uppercase text-[10px] tracking-widest"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </section>

      {/* Taste profile */}
      <section className="bg-white border border-amber-100 rounded-[2rem] p-8 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-amber-700">
            <SlidersHorizontal className="w-4 h-4" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em]">Taste Profile</h2>
          </div>
          {savedAt && (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
        <p className="text-amber-900/50 text-sm mb-8">Sniffer uses this to sort your search results — your side of the counter comes first.</p>

        {loading ? (
          <p className="text-amber-900/40 text-sm animate-pulse">Loading your profile…</p>
        ) : (
          <>
            <h3 className="text-amber-900 font-bold text-sm mb-4">What do you wear?</h3>
            <div className="grid sm:grid-cols-3 gap-3 mb-10">
              {GENDER_OPTIONS.map(option => {
                const active = profile.genderPreference === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setGender(option.value)}
                    className={`text-left p-5 rounded-2xl border transition-all cursor-pointer ${
                      active
                        ? 'bg-amber-50 border-amber-400 shadow-sm'
                        : 'bg-white border-amber-100 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="serif text-lg font-bold text-amber-900">{option.label}</span>
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${active ? 'border-amber-600 bg-amber-600' : 'border-amber-200'}`}>
                        {active && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                    </div>
                    <span className="text-amber-900/50 text-xs">{option.caption}</span>
                  </button>
                );
              })}
            </div>

            <h3 className="text-amber-900 font-bold text-sm mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> Scents you like
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {familyOptions.map(family => {
                const active = profile.scentFamilies.includes(family);
                return (
                  <button
                    key={family}
                    onClick={() => toggleFamily(family)}
                    className={`px-4 py-2.5 rounded-full border text-sm font-bold capitalize transition-all cursor-pointer ${
                      active
                        ? 'bg-amber-700 text-white border-amber-700'
                        : 'bg-white text-amber-900/60 border-amber-100 hover:border-amber-300 hover:text-amber-900'
                    }`}
                  >
                    {family}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default Settings;
