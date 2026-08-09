
import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import SearchHeader from './components/SearchHeader';
import PopularScents from './components/PopularScents';
import ResultsView from './components/ResultsView';
import SuggestionList from './components/SuggestionList';
import HowItWorks from './components/HowItWorks';
import TrustedSellers from './components/TrustedSellers';
import FeatureNotReady from './components/FeatureNotReady';
import Settings from './components/Settings';
import { searchCologne, suggestCologne, fetchFragranceInfo, fetchPrices, identifyCologneFromImage, googleSignInUrl, fetchMe, signOutServer, clearSuggestionCache, AUTH_TOKEN_KEY, PRIVACY_POLICY_URL, AuthUser } from './apiService';
import { ScentDetails, FragranceSuggestion, FragranceInfo } from './types';

// Build a partial ScentDetails from fast /api/info data — sellers fill in later.
function infoToScentDetails(info: FragranceInfo): ScentDetails {
  return {
    name: info.name,
    brand: info.brand,
    overview: info.overview,
    notes: info.notes,
    onlineSellers: [],
    physicalStores: [],
    imagePrompt: `${info.brand} ${info.name}`,
    exists: true,
    isUncertain: false,
  };
}

type ViewState = 'home' | 'suggestions' | 'results' | 'how-it-works' | 'trusted-sellers' | 'feature-not-ready' | 'settings';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [activeFeatureName, setActiveFeatureName] = useState('');
  const [results, setResults] = useState<ScentDetails | null>(null);
  const [suggestions, setSuggestions] = useState<FragranceSuggestion[]>([]);
  const [lastQuery, setLastQuery] = useState('');
  const [loadingSuggestionId, setLoadingSuggestionId] = useState<string | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState<boolean>(() => !!localStorage.getItem('sniffer:ageConfirmed'));

  const confirmAge = () => {
    localStorage.setItem('sniffer:ageConfirmed', '1');
    setAgeConfirmed(true);
  };

  // Session restore + capture the token coming back from the Google flow.
  // The server returns it in the URL fragment (#token=) so it never hits a
  // server log or Referer header; we still read ?token= for backward-compat.
  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);
    const incomingToken = hashParams.get('token') ?? queryParams.get('token');
    if (incomingToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, incomingToken);
      hashParams.delete('token');
      queryParams.delete('token');
      const remainingQuery = queryParams.toString();
      const remainingHash = hashParams.toString();
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (remainingQuery ? `?${remainingQuery}` : '') + (remainingHash ? `#${remainingHash}` : ''),
      );
    }
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetchMe(token)
        .then(user => {
          setAuthUser(user);
          // Re-fetch searches with this account's ordering, not any logged-out order
          clearSuggestionCache();
        })
        .catch(() => localStorage.removeItem(AUTH_TOKEN_KEY));
    }
  }, []);

  const handleSignOut = () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      signOutServer(token);
    }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthUser(null);
    clearSuggestionCache();
  };

  // Step 1: fast fuzzy search — show a list of matching colognes to pick from.
  const handleSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    setIsLoading(true);
    setError(null);
    setStatusMessage("Sniffing around...");
    setLastQuery(trimmed);
    try {
      const matches = await suggestCologne(trimmed);
      if (matches.length > 0) {
        setSuggestions(matches);
        setCurrentView('suggestions');
      } else {
        setError("Could not find any scents matching that. Try something else!");
      }
    } catch (e) {
      setError("Something went wrong. Please try again later.");
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  // Step 2: user picked a cologne. Render the page from fast /api/info (notes +
  // overview, ~3-5s) while the seller prices load separately in the background —
  // so the results page appears almost immediately instead of after a ~45s scrape.
  const handleSelectSuggestion = async (suggestion: FragranceSuggestion) => {
    setLoadingSuggestionId(suggestion.id);
    setError(null);

    // Kick off the price scrape immediately, in parallel — don't block render on it.
    const pricesPromise = fetchPrices(suggestion.brand, suggestion.name).catch(() => null);

    try {
      const info = await fetchFragranceInfo(suggestion);
      setResults(infoToScentDetails(info));
      setPricesLoading(true);
      setCurrentView('results');

      // Stream sellers in when the scrape finishes (attached after results is set,
      // so the functional update always merges onto the rendered cologne).
      pricesPromise.then(sellers => {
        if (sellers) {
          setResults(prev => (prev ? { ...prev, onlineSellers: sellers } : prev));
        }
        setPricesLoading(false);
      });
    } catch (e) {
      // Info scrape failed — fall back to the full (slower) search, which returns
      // everything including sellers, so the pick still works.
      try {
        const data = await searchCologne(`${suggestion.brand} ${suggestion.name}`);
        if (data) {
          setResults(data);
          setPricesLoading(false);
          setCurrentView('results');
        } else {
          setError("Could not load that scent. Try another match.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoadingSuggestionId(null);
    }
  };

  const handleImageSearch = async (base64: string) => {
    setIsLoading(true);
    setError(null);
    setStatusMessage("Identifying bottle...");
    try {
      const identifiedName = await identifyCologneFromImage(base64);
      if (identifiedName) {
        setStatusMessage(`Found: ${identifiedName}`);
        await handleSearch(identifiedName);
      } else {
        setError("Could not identify the bottle. Please try a clearer photo.");
        setIsLoading(false);
        setStatusMessage(null);
      }
    } catch (e) {
      setError("Image identification failed. Try searching by name.");
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  const navigateToHome = () => {
    setResults(null);
    setSuggestions([]);
    setLastQuery('');
    setError(null);
    setPricesLoading(false);
    setCurrentView('home');
  };

  // Back from the full price view to the list of matches the user was choosing from
  const navigateToSuggestions = () => {
    setError(null);
    setCurrentView(suggestions.length > 0 ? 'suggestions' : 'home');
  };

  const triggerFeatureNotReady = (name: string) => {
    setActiveFeatureName(name);
    setCurrentView('feature-not-ready');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'suggestions':
        return (
          <>
            <SuggestionList
              query={lastQuery}
              suggestions={suggestions}
              onSelect={handleSelectSuggestion}
              onBack={navigateToHome}
              loadingId={loadingSuggestionId}
            />
            {(error || loadingSuggestionId) && (
              <div className="max-w-4xl mx-auto px-6 pb-8 flex justify-center">
                {loadingSuggestionId && !error ? (
                  <div className="flex items-center gap-3 px-6 py-2 bg-amber-50 border border-amber-100 rounded-full text-amber-900/60 text-xs font-bold uppercase tracking-widest animate-pulse">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                    Fetching live prices — first look can take up to a minute
                  </div>
                ) : error ? (
                  <p className="text-rose-500 font-bold uppercase text-[10px] tracking-widest">{error}</p>
                ) : null}
              </div>
            )}
          </>
        );

      case 'results':
        return results ? (
          <ResultsView
            data={results}
            onBack={navigateToSuggestions}
            pricesLoading={pricesLoading}
          />
        ) : null;

      case 'how-it-works':
        return <HowItWorks onBack={navigateToHome} />;

      case 'trusted-sellers':
        return <TrustedSellers onBack={navigateToHome} />;
      
      case 'feature-not-ready':
        return <FeatureNotReady featureName={activeFeatureName} onBack={navigateToHome} />;

      case 'settings':
        return authUser ? (
          <Settings
            user={authUser}
            onBack={navigateToHome}
            onSignOut={() => { handleSignOut(); navigateToHome(); }}
            onProfileChange={clearSuggestionCache}
          />
        ) : null;

      case 'home':
      default:
        return (
          <div className="text-center px-4 animate-in fade-in duration-1000">
            <h1 className="serif text-5xl md:text-7xl text-amber-900 mb-6 leading-tight">
              Sniff out the best <br /> prices on <span className="italic text-amber-700">fragrance.</span>
            </h1>
            <p className="text-amber-800/60 max-w-xl mx-auto text-lg mb-12">
              Sniffer helps you identify scents from photos, find the lowest prices online, and locate stores nearby.
            </p>
            
            <SearchHeader 
              onSearch={handleSearch} 
              onImageUpload={handleImageSearch}
              isLoading={isLoading} 
            />
            
            {(error || statusMessage) && (
              <div className="mt-8 flex flex-col items-center gap-2">
                {statusMessage && !error && (
                  <div className="flex items-center gap-3 px-6 py-2 bg-amber-50 border border-amber-100 rounded-full text-amber-900/60 text-xs font-bold uppercase tracking-widest animate-pulse">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                    {statusMessage}
                  </div>
                )}
                {error && (
                  <p className="text-rose-500 font-bold uppercase text-[10px] tracking-widest">{error}</p>
                )}
              </div>
            )}

            <PopularScents onSelect={handleSearch} />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] relative overflow-x-hidden">
      {/* Age gate (COPPA): block first use until the visitor confirms 13+. */}
      {!ageConfirmed && (
        <div className="fixed inset-0 z-[100] bg-amber-950/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#FFFDF9] border border-amber-100 rounded-3xl max-w-md w-full p-8 shadow-2xl text-center">
            <p className="text-amber-700 font-bold uppercase text-[10px] tracking-[0.3em] mb-3">Before we start</p>
            <h2 className="serif text-3xl text-amber-900 mb-3">A quick check</h2>
            <p className="text-amber-900/60 text-sm mb-6 leading-relaxed">
              Sniffer is intended for people aged 13 and older. Please confirm your age. See our{' '}
              <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className="underline text-amber-700 hover:text-amber-900">Privacy Policy</a>{' '}
              for how your data is handled.
            </p>
            <button
              onClick={confirmAge}
              className="w-full py-3 bg-amber-900 text-white rounded-full font-bold uppercase text-[11px] tracking-widest hover:bg-amber-800 transition-colors"
            >
              I'm 13 or older — continue
            </button>
          </div>
        </div>
      )}

      {/* Background elements */}
      <div className="fixed inset-0 pointer-events-none opacity-10">
        <img 
          src="https://picsum.photos/seed/vanilla-bean/1920/1080?grayscale" 
          className="w-full h-full object-cover blur-sm"
          alt=""
        />
      </div>
      <div className="fixed -top-24 -right-24 w-96 h-96 bg-amber-100/30 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-24 -left-24 w-96 h-96 bg-orange-100/30 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-50 px-6 py-6 flex items-center justify-between max-w-7xl mx-auto">
        <div 
          className="flex items-center gap-2 cursor-pointer group"
          onClick={navigateToHome}
        >
          <div className="w-10 h-10 bg-amber-900 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-12">
            <Search className="text-white w-5 h-5" />
          </div>
          <span className="serif text-2xl font-bold text-amber-900 tracking-tight">sniffer</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-amber-900/60 font-medium text-sm">
          <button 
            onClick={() => setCurrentView('how-it-works')}
            className={`hover:text-amber-900 transition-colors ${currentView === 'how-it-works' ? 'text-amber-900 font-bold' : ''}`}
          >
            How it works
          </button>
          <button 
            onClick={() => setCurrentView('trusted-sellers')}
            className={`hover:text-amber-900 transition-colors ${currentView === 'trusted-sellers' ? 'text-amber-900 font-bold' : ''}`}
          >
            Trusted Sellers
          </button>
          {authUser ? (
            <button
              onClick={() => setCurrentView('settings')}
              title="Settings"
              className={`flex items-center gap-3 group ${currentView === 'settings' ? 'opacity-100' : ''}`}
            >
              {authUser.picture ? (
                <img src={authUser.picture} alt={authUser.name} className="w-8 h-8 rounded-full border border-amber-200 group-hover:border-amber-400 transition-colors" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-900 text-white flex items-center justify-center text-xs font-bold">
                  {authUser.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className={`font-bold text-sm transition-colors ${currentView === 'settings' ? 'text-amber-900' : 'text-amber-900/70 group-hover:text-amber-900'}`}>{authUser.name}</span>
            </button>
          ) : (
            <button
              onClick={() => { window.location.href = googleSignInUrl(); }}
              className="px-5 py-2 bg-amber-50 text-amber-900 rounded-full hover:bg-amber-100 transition-colors font-bold uppercase text-[10px] tracking-widest"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      <main className="relative z-10 pt-12">
        {renderContent()}
      </main>

      <footer className="relative z-10 py-20 px-6 border-t border-amber-50 mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-amber-900 rounded-lg flex items-center justify-center">
                <Search className="text-white w-3 h-3" />
              </div>
              <span className="serif text-xl font-bold text-amber-900">sniffer</span>
            </div>
            <p className="text-amber-900/30 text-[10px] font-bold uppercase tracking-widest">© 2025 Sniffer Fragrance Search. All scents intended for discovery.</p>
          </div>
          <div className="flex gap-12">
            <div className="space-y-4">
              <h5 className="font-bold text-amber-900 text-[10px] uppercase tracking-[0.3em]">Product</h5>
              <ul className="text-amber-900/60 text-xs space-y-2">
                <li><button onClick={() => setCurrentView('how-it-works')} className="hover:text-amber-900 transition-colors text-left">How it works</button></li>
                <li><button onClick={() => triggerFeatureNotReady('Seller API')} className="hover:text-amber-900 transition-colors text-left">Seller API</button></li>
                <li><button onClick={() => triggerFeatureNotReady('Store Locator')} className="hover:text-amber-900 transition-colors text-left">Store Locator</button></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h5 className="font-bold text-amber-900 text-[10px] uppercase tracking-[0.3em]">Legal</h5>
              <ul className="text-amber-900/60 text-xs space-y-2">
                <li><a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className="hover:text-amber-900 transition-colors text-left block">Privacy Policy</a></li>
                <li><button onClick={() => triggerFeatureNotReady('Terms of Use')} className="hover:text-amber-900 transition-colors text-left">Terms of Use</button></li>
                <li><button onClick={() => setCurrentView('trusted-sellers')} className="hover:text-amber-900 transition-colors text-left">Trust Center</button></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
