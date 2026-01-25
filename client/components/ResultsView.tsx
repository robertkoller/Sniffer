
import React from 'react';
import { ScentDetails, Seller, Store } from '../types';
import { ShieldCheck, MapPin, Sparkles, ShoppingBag, ExternalLink, ChevronLeft, Droplets, Info, TrendingDown, CheckCircle2 } from 'lucide-react';
import { HoverShift, IconAnim } from './MicroInteractions';

interface ResultsViewProps {
  data: ScentDetails;
  onBack: () => void;
}

const CredibilityBadge: React.FC<{ score: number }> = ({ score }) => {
  const isHigh = score > 85;
  const isMed = score > 70;
  const colorClass = isHigh ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : isMed ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-rose-700 bg-rose-50 border-rose-100';
  
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${colorClass} transition-all hover:scale-105 cursor-help shadow-sm`}>
      <ShieldCheck className="w-3 h-3" />
      <span>{score}% Trust</span>
    </div>
  );
};

const ResultsView: React.FC<ResultsViewProps> = ({ data, onBack }) => {
  const bestPriceSeller = [...data.onlineSellers].sort((a, b) => 
    parseFloat(a.price.replace(/[^0-9.]/g, '')) - parseFloat(b.price.replace(/[^0-9.]/g, ''))
  )[0];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 animate-results">
      {/* Header Bar */}
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
        
        <div className="flex items-center gap-4 bg-white border border-amber-100 px-6 py-3 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <TrendingDown className="w-5 h-5 text-emerald-500 animate-pulse" />
          <p className="text-sm font-medium text-amber-900/80">
            Lowest Price found: <span className="font-black text-amber-900 text-lg">{bestPriceSeller?.price || 'N/A'}</span>
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-10">
        {/* Profile Card - Fixed stable container */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-white p-12 rounded-[3rem] border border-amber-100/40 shadow-xl relative overflow-hidden group transition-all duration-500 hover:shadow-2xl">
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
                    {Object.entries(data.notes).map(([key, notes]) => (
                      <div key={key} className="flex flex-col gap-3 group/note">
                        <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">{key} Notes</p>
                        <div className="flex flex-wrap gap-2">
                          {notes.map(n => (
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

          {/* Try It Out Card */}
          <HoverShift className="bg-amber-900 text-amber-50 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform">
              <MapPin className="w-20 h-20" />
            </div>
            <h3 className="serif text-3xl mb-4">Sniff it in person</h3>
            <p className="text-amber-100/60 text-sm mb-8 leading-relaxed">
              Find testers and samples at these nearby trusted retailers to see how it reacts with your skin chemistry.
            </p>
            <div className="space-y-3">
              {data.physicalStores.map((store, i) => (
                <a 
                  key={i}
                  href={store.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/15 hover:border-white/30 transition-all group/store"
                >
                  <span className="font-bold text-amber-50 group-hover/store:translate-x-2 transition-transform">{store.name}</span>
                  <ExternalLink className="w-4 h-4 opacity-40 group-hover/store:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </HoverShift>
        </div>

        {/* Sellers Section */}
        <div className="lg:col-span-7">
          <div className="flex items-center justify-between mb-10">
            <h2 className="serif text-4xl text-amber-900 flex items-center gap-4">
              <IconAnim><ShoppingBag className="w-8 h-8 text-amber-700" /></IconAnim>
              Price Sniffer
            </h2>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest">
              <CheckCircle2 className="w-4 h-4" />
              Real-time Market Data
            </div>
          </div>

          <div className="grid gap-6">
            {data.onlineSellers.map((seller, i) => {
              const isBestDeal = seller === bestPriceSeller;
              return (
                <a 
                  key={i}
                  href={seller.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group block relative ${isBestDeal ? 'border-beam' : ''}`}
                >
                  <div className={`bg-white p-8 rounded-3xl border transition-all duration-500 flex flex-col sm:flex-row items-center justify-between gap-6 hover:shadow-2xl ${isBestDeal ? 'border-amber-400 shadow-xl sm:-translate-x-2' : 'border-amber-100/50 hover:border-amber-200'}`}>
                    {isBestDeal && (
                      <div className="absolute -top-3 left-8 px-4 py-1 bg-amber-400 text-amber-900 font-black text-[9px] uppercase tracking-[0.2em] rounded-full shadow-lg">
                        Best Scored Deal
                      </div>
                    )}
                    
                    <div className="flex items-center gap-6 w-full sm:w-auto">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 ${isBestDeal ? 'bg-amber-100 text-amber-900 rotate-3' : 'bg-amber-50 text-amber-700 group-hover:rotate-6'}`}>
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-amber-900 mb-1">{seller.name}</h4>
                        <div className="flex items-center gap-3">
                          <CredibilityBadge score={seller.credibilityScore} />
                          {seller.isTrusted && (
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Verified</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-6 sm:pt-0 border-amber-50">
                      <div className="text-right">
                        <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest mb-1">Price</p>
                        <p className="text-4xl serif text-amber-900 font-black tracking-tight">{seller.price}</p>
                      </div>
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 ${isBestDeal ? 'bg-amber-900 text-white group-hover:scale-110 group-hover:rotate-45' : 'bg-amber-50 text-amber-900 hover:bg-amber-100 group-hover:rotate-12'}`}>
                        <ExternalLink className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>

          <div className="mt-12 p-12 rounded-[3rem] bg-gradient-to-br from-white to-amber-50/50 border border-amber-100 relative overflow-hidden group shadow-inner">
            <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldCheck className="w-32 h-32 text-amber-900" />
            </div>
            <div className="max-w-xl">
              <h4 className="serif text-3xl text-amber-900 mb-4 italic">The Sniffer Guarantee</h4>
              <p className="text-amber-900/60 text-sm leading-relaxed font-medium">
                Our algorithm cross-references price, shipping speed, and seller history. A credibility score above 80% indicates a highly reputable vendor with consistent service and genuine inventory.
              </p>
            </div>
          </div>

          {/* Grounding Sources */}
          {data.groundingSources && data.groundingSources.length > 0 && (
            <div className="mt-12 pt-12 border-t border-amber-100">
              <h3 className="text-amber-900 font-black text-[11px] uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                <IconAnim><ExternalLink className="w-4 h-4 text-amber-400" /></IconAnim>
                Information Sources
              </h3>
              <div className="flex flex-wrap gap-4">
                {data.groundingSources.map((source, idx) => (
                  <a 
                    key={idx}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-white border border-amber-100 rounded-full text-xs text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <span className="max-w-[150px] truncate">{source.title || 'View Source'}</span>
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsView;
