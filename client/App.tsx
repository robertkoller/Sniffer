
import React, { useState } from 'react';
import { Sparkles, ShoppingBag, MapPin, Search } from 'lucide-react';
import SearchHeader from './components/SearchHeader';
import PopularScents from './components/PopularScents';
import ResultsView from './components/ResultsView';
import HowItWorks from './components/HowItWorks';
import TrustedSellers from './components/TrustedSellers';
import FeatureNotReady from './components/FeatureNotReady';
import { searchCologne } from './geminiService';
import { ScentDetails } from './types';

type ViewState = 'home' | 'results' | 'how-it-works' | 'trusted-sellers' | 'feature-not-ready';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [activeFeatureName, setActiveFeatureName] = useState('');
  const [results, setResults] = useState<ScentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await searchCologne(query);
      if (data) {
        setResults(data);
        setCurrentView('results');
      } else {
        setError("Could not find details for that scent. Try something else!");
      }
    } catch (e) {
      setError("Something went wrong. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToHome = () => {
    setResults(null);
    setError(null);
    setCurrentView('home');
  };

  const triggerFeatureNotReady = (name: string) => {
    setActiveFeatureName(name);
    setCurrentView('feature-not-ready');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'results':
        return results ? (
          <ResultsView 
            data={results} 
            onBack={navigateToHome} 
          />
        ) : null;
      
      case 'how-it-works':
        return <HowItWorks onBack={navigateToHome} />;

      case 'trusted-sellers':
        return <TrustedSellers onBack={navigateToHome} />;
      
      case 'feature-not-ready':
        return <FeatureNotReady featureName={activeFeatureName} onBack={navigateToHome} />;

      case 'home':
      default:
        return (
          <div className="text-center px-4 animate-in fade-in duration-1000">
            <h1 className="serif text-5xl md:text-7xl text-amber-900 mb-6 leading-tight">
              Sniff out the best <br /> prices on <span className="italic text-amber-700">fragrance.</span>
            </h1>
            <p className="text-amber-800/60 max-w-xl mx-auto text-lg mb-12">
              Sniffer helps you find the lowest prices online, identify trusted sellers, and locate stores where you can try scents in person.
            </p>
            
            <SearchHeader onSearch={handleSearch} isLoading={isLoading} />
            
            {error && (
              <p className="mt-4 text-red-500 font-medium">{error}</p>
            )}

            <PopularScents onSelect={handleSearch} />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] relative overflow-x-hidden">
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
          <button 
            onClick={() => triggerFeatureNotReady('Sign In')}
            className="px-5 py-2 bg-amber-50 text-amber-900 rounded-full hover:bg-amber-100 transition-colors"
          >
            Sign In
          </button>
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
            <p className="text-amber-900/30 text-sm">© 2025 Sniffer Fragrance Search. All scents intended for discovery.</p>
          </div>
          <div className="flex gap-12">
            <div className="space-y-4">
              <h5 className="font-bold text-amber-900 text-sm uppercase tracking-widest">Product</h5>
              <ul className="text-amber-900/60 text-sm space-y-2">
                <li><button onClick={() => setCurrentView('how-it-works')} className="hover:text-amber-900 transition-colors text-left">How it works</button></li>
                <li><button onClick={() => triggerFeatureNotReady('Seller API')} className="hover:text-amber-900 transition-colors text-left">Seller API</button></li>
                <li><button onClick={() => triggerFeatureNotReady('Store Locator')} className="hover:text-amber-900 transition-colors text-left">Store Locator</button></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h5 className="font-bold text-amber-900 text-sm uppercase tracking-widest">Legal</h5>
              <ul className="text-amber-900/60 text-sm space-y-2">
                <li><button onClick={() => triggerFeatureNotReady('Privacy Policy')} className="hover:text-amber-900 transition-colors text-left">Privacy Policy</button></li>
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
