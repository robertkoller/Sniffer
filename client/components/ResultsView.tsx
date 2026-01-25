
import React, { useState, useEffect } from 'react';
import { ScentDetails, Seller, Store } from '../types';
import { ShieldCheck, MapPin, Sparkles, ShoppingBag, ExternalLink, ChevronLeft, Droplets, Info, TrendingDown, CheckCircle2, ChevronDown, ChevronUp, AlertTriangle, Navigation, LocateFixed, Store as StoreIcon } from 'lucide-react';
import { HoverShift, IconAnim } from './MicroInteractions';

interface ResultsViewProps {
  data: ScentDetails;
  onBack: () => void;
}

const CredibilityBadge: React.FC<{ score: number }> = ({ score }) => {
  const displayScore = score <= 1 ? Math.round(score * 100) : Math.round(score);
  const isHigh = displayScore > 85;
  const isMed = displayScore > 70;
  const colorClass = isHigh ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : isMed ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-rose-700 bg-rose-50 border-rose-100';

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${colorClass} transition-all hover:scale-105 cursor-help shadow-sm`}>
      <ShieldCheck className="w-3 h-3" />
      <span>{displayScore}% Trust</span>
    </div>
  );
};

const ResultsView: React.FC<ResultsViewProps> = ({ data, onBack }) => {
  const [showAllSellers, setShowAllSellers] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const requestLocation = () => {
    setIsLocating(true);
    setLocationError(null);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setIsLocating(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationError("Location access denied. Using general area.");
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationError("Geolocation not supported by your browser.");
      setIsLocating(false);
    }
  };

  const getMapsUrl = (storeName: string) => {
    const destination = encodeURIComponent(storeName);
    if (userCoords) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${destination}&travelmode=driving`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${destination}`;
  };

  const getPrice = (p: string) =>
    p ? parseFloat(p.replace(/[^0-9.]/g, '')) : Infinity;

  const sellers = data.onlineSellers || [];

  const prices = sellers
    .map(s => getPrice(s.price))
    .filter(p => isFinite(p));

  const maxPrice = prices.length > 0 ? Math.max(...prices) : 1;

  const scoredSellers = sellers.map(seller => {
    const price = getPrice(seller.price);
    const priceScore = isFinite(price) ? 1 - (price / maxPrice) : 0;
    const rawTrust = Number(seller.credibilityScore ?? 50);
    const trustScore = rawTrust <= 1 ? rawTrust : rawTrust / 100;

    return {
      ...seller,
      score: (priceScore * 0.6) + (trustScore * 0.4)
    };
  });

  const sortedSellers = [...scoredSellers].sort((a, b) => b.score - a.score);
  const bestScoredSeller = sortedSellers[0];
  const displayedSellers = showAllSellers ? sortedSellers : sortedSellers.slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 animate-results overflow-visible">
      {/* Uncertainty Warning */}
      {data.isUncertain && (
        <div className="mb-12 p-6 bg-rose-50 border border-rose-100 rounded-[2rem] flex items-start gap-6 animate-pulse">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-rose-900 mb-1 tracking-tight">Potentially Unreliable Results</h4>
            <p className="text-sm text-rose-900/60 leading-relaxed">
              {data.uncertaintyWarning || "This product is rare, discontinued, or has mixed search results. Prices and availability may not be accurate."}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-3 text-amber-900/60 hover:text-amber-900 transition-all group font-bold uppercase text-xs tracking-widest"
        >
          <div className="w-10 h-10 rounded-full border border-amber-900/10 flex items-center justify-center transition-all group-hover:bg-amber-900 group-hover:text-white">
            <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          </div>
          <span>Back to Search</span>
        </button>

        {bestScoredSeller && (
          <div className="flex items-center gap-4 bg-white border border-amber-100 px-6 py-3 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <TrendingDown className="w-5 h-5 text-emerald-500 animate-pulse" />
            <p className="text-sm font-medium text-amber-900/80">
              Best Price found: <span className="font-black text-amber-900 text-lg">{bestScoredSeller.price}</span>
            </p>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-10 overflow-visible">
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-white p-12 rounded-[3rem] border border-amber-100/40 shadow-xl relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 opacity-[0.05] transition-transform duration-1000 group-hover:rotate-45 group-hover:scale-150">
              <Sparkles className="w-64 h-64 text-amber-900" />
            </div>

            <div className="relative">
              <span className="inline-block px-4 py-1.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                {data.brand}
              </span>
              <h1 className="serif text-6xl text-amber-900 mb-8 leading-tight">{data.name}</h1>

              <div className="space-y-10">
                <div className="group/item">
                  <h3 className="text-amber-900 font-black text-[11px] uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                    <IconAnim><Info className="w-4 h-4 text-amber-400" /></IconAnim>
                    Fragrance Profile
                  </h3>
                  <p className="text-amber-900/70 leading-relaxed text-lg font-medium italic border-l-2 border-amber-200 pl-6">
                    "{data.overview}"
                  </p>
                </div>

                <div className="space-y-8">
                  <h3 className="text-amber-900 font-black text-[11px] uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                    <IconAnim><Droplets className="w-4 h-4 text-amber-500" /></IconAnim>
                    Scent Pyramid
                  </h3>

                  <div className="space-y-6">
                    {Object.entries(data.notes || {}).map(([key, notes]) => (
                      <div key={key} className="flex flex-col gap-3 group/note">
                        <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">{key} Notes</p>
                        <div className="flex flex-wrap gap-2">
                          {(notes as string[]).map(n => (
                            <span key={n} className="note-item px-4 py-2 bg-amber-50/50 border border-amber-100/50 text-amber-900 rounded-xl text-xs font-bold">
                              {n}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <HoverShift className="bg-amber-900 text-amber-50 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform">
              <MapPin className="w-20 h-20" />
            </div>
            <h3 className="serif text-3xl mb-4">Sniff it in person</h3>
            <p className="text-amber-100/60 text-sm mb-6 leading-relaxed">
              Find testers at these boutiques nearby. We'll give you directions so you can try it on your skin before you buy.
            </p>

            <div className="mb-6">
              {!userCoords ? (
                <button 
                  onClick={requestLocation}
                  disabled={isLocating}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-white/10 border border-white/20 rounded-2xl hover:bg-white/20 transition-all font-bold text-xs uppercase tracking-widest"
                >
                  {isLocating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <LocateFixed className="w-4 h-4" />
                  )}
                  {isLocating ? 'Locating...' : 'Enable Location for Directions'}
                </button>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-300 text-[10px] font-black uppercase tracking-widest">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Location Enabled: Precise Directions Ready
                </div>
              )}
              {locationError && (
                <p className="mt-2 text-[10px] text-rose-300 font-bold uppercase tracking-widest">{locationError}</p>
              )}
            </div>

            <div className="space-y-3">
              
              {/* Nordstrom Button - Harmonized Style */}
              <a
              
                href={getMapsUrl("Nordstrom")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/15 hover:border-white/30 transition-all group/store shadow-sm mb-2"
              >
                <div className="flex flex-col">
                  <span className="font-bold text-amber-50 group-hover/store:translate-x-1 transition-transform">Nordstrom</span>
                  <span className="text-[9px] text-amber-100/40 uppercase tracking-widest mt-1">
                    {userCoords ? 'Open Directions' : 'Search Nearby'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Navigation className="w-4 h-4 text-amber-400 opacity-0 group-hover/store:opacity-100 transition-all group-hover/store:translate-x-0 -translate-x-2" />
                  <ExternalLink className="w-4 h-4 opacity-40 group-hover/store:opacity-100 transition-opacity" />
                </div>
              </a>
              
              {(data.physicalStores || [])
                .filter(s => s.name.toLowerCase() !== 'nordstrom')
                .map((store, i) => (
                <a
                  key={i}
                  href={getMapsUrl(store.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/15 hover:border-white/30 transition-all group/store shadow-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-amber-50 group-hover/store:translate-x-1 transition-transform">{store.name}</span>
                    <span className="text-[9px] text-amber-100/40 uppercase tracking-widest mt-1">
                      {userCoords ? 'Open Directions' : 'Search Nearby'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Navigation className="w-4 h-4 text-amber-400 opacity-0 group-hover/store:opacity-100 transition-all group-hover/store:translate-x-0 -translate-x-2" />
                    <ExternalLink className="w-4 h-4 opacity-40 group-hover/store:opacity-100 transition-opacity" />
                  </div>
                </a>
              ))}
            </div>
          </HoverShift>
        </div>

        <div className="lg:col-span-7 overflow-visible">
          <div className="flex items-center justify-between mb-10">
            <h2 className="serif text-4xl text-amber-900 flex items-center gap-4">
              <IconAnim><ShoppingBag className="w-8 h-8 text-amber-700" /></IconAnim>
              Price Sniffer
            </h2>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest">
              <CheckCircle2 className="w-4 h-4" />
              Showing {sortedSellers.length} Sellers
            </div>
          </div>

          <div className="grid gap-6 overflow-visible">
            {displayedSellers.map((seller, i) => {
              const isBestDeal = seller === bestScoredSeller;
              return (
                <div key={i} className="relative pt-8 overflow-visible">
                  {isBestDeal && (
                    <div className="absolute -top-1 left-8 z-50 px-5 py-2 bg-amber-400 text-amber-900 font-black text-[10px] uppercase tracking-[0.2em] rounded-full shadow-xl border-2 border-white animate-bounce">
                      Best Overall Score
                    </div>
                  )}
                  <a
                    href={seller.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group block relative p-1 rounded-[2.5rem] ${isBestDeal ? 'bg-gradient-to-br from-amber-400/20 to-amber-200/20 border-beam' : ''}`}
                  >
                    <div className={`bg-white p-7 rounded-[2.2rem] border transition-all duration-500 flex flex-col sm:flex-row items-center justify-between gap-6 hover:shadow-2xl relative z-10 ${isBestDeal ? 'border-amber-400 shadow-xl' : 'border-amber-100/50 hover:border-amber-200'}`}>
                      <div className="flex items-center gap-6 w-full sm:w-auto">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 ${isBestDeal ? 'bg-amber-100 text-amber-900 rotate-3' : 'bg-amber-50 text-amber-700 group-hover:rotate-6'}`}>
                          <ShoppingBag className="w-8 h-8" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-amber-900 mb-1 leading-tight">{seller.name}</h4>
                          <div className="flex flex-wrap items-center gap-3">
                            <CredibilityBadge score={seller.credibilityScore} />
                            {seller.isTrusted && (
                              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Verified Seller</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-4 sm:pt-0 border-amber-50">
                        <div className="text-right">
                          <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest mb-1">Price</p>
                          <p className="text-3xl serif text-amber-900 font-black tracking-tight">{seller.price}</p>
                        </div>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 shrink-0 ${isBestDeal ? 'bg-amber-900 text-white group-hover:scale-110 group-hover:rotate-45' : 'bg-amber-50 text-amber-900 hover:bg-amber-100 group-hover:rotate-12'}`}>
                          <ExternalLink className="w-6 h-6" />
                        </div>
                      </div>
                    </div>
                  </a>
                </div>
              );
            })}
          </div>

          {sortedSellers.length > 4 && (
            <div className="mt-12 flex justify-center">
              <button
                onClick={() => setShowAllSellers(!showAllSellers)}
                className="flex items-center gap-2 px-10 py-5 bg-white border border-amber-200 rounded-[2rem] text-amber-900 font-black text-xs uppercase tracking-[0.2em] hover:bg-amber-50 hover:border-amber-400 transition-all shadow-sm group"
              >
                {showAllSellers ? (
                  <>
                    <ChevronUp className="w-4 h-4 transition-transform group-hover:-translate-y-1" />
                    <span>Collapse Results</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-1" />
                    <span>Show {sortedSellers.length - 4} More Retailers</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="mt-12 p-12 rounded-[3rem] bg-gradient-to-br from-white to-amber-50/50 border border-amber-100 relative overflow-hidden group shadow-inner">
            <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldCheck className="w-32 h-32 text-amber-900" />
            </div>
            <div className="max-w-xl">
              <h4 className="serif text-3xl text-amber-900 mb-4 italic">The Sniffer Guarantee</h4>
              <p className="text-amber-900/60 text-sm leading-relaxed font-medium">
                Our algorithm highlights verified retailers first. A credibility score above 80% indicates a highly reputable vendor. We include smaller discounters to ensure you find the absolute lowest price on the market.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;
