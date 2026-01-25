
import React from 'react';
import { ShieldCheck, ChevronLeft, TrendingDown, Scale, CheckCircle2, AlertTriangle, Search } from 'lucide-react';
import { HoverShift } from './MicroInteractions';

interface TrustedSellersProps {
  onBack: () => void;
}

const TrustedSellers: React.FC<TrustedSellersProps> = ({ onBack }) => {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 animate-results">
      <button 
        onClick={onBack}
        className="inline-flex items-center gap-3 text-amber-900/60 hover:text-amber-900 transition-all group font-bold uppercase text-xs tracking-widest mb-12"
      >
        <div className="w-10 h-10 rounded-full border border-amber-900/10 flex items-center justify-center transition-all group-hover:bg-amber-900 group-hover:text-white">
          <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
        </div>
        <span>Back to Sniffing</span>
      </button>

      <div className="mb-20">
        <h1 className="serif text-6xl text-amber-900 mb-8">Trust in the Hunt</h1>
        <p className="text-amber-800/60 text-xl leading-relaxed max-w-3xl">
          The fragrance world is split between luxury boutiques and the "Gray Market." We believe you deserve to see both sides of the coin to find the absolute lowest price.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-12 mb-20">
        <div className="space-y-8">
          <div className="flex items-start gap-6 p-8 bg-emerald-50/50 border border-emerald-100 rounded-[2.5rem]">
            <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h3 className="serif text-2xl text-amber-900 mb-3">Authorized Retailers</h3>
              <p className="text-amber-900/60 leading-relaxed">
                Stores like <strong>Nordstrom</strong> or <strong>Sephora</strong> purchase directly from the brand. They have the highest trust (90%+), but almost always sell at the MSRP (Full Price).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-6 p-8 bg-amber-50/50 border border-amber-100 rounded-[2.5rem]">
            <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center shrink-0">
              <TrendingDown className="w-7 h-7" />
            </div>
            <div>
              <h3 className="serif text-2xl text-amber-900 mb-3">The "Gray Market"</h3>
              <p className="text-amber-900/60 leading-relaxed">
                Reputable discounters like <strong>FragranceNet</strong> buy overstock from around the world. These are authentic bottles, but since they aren't "authorized" by the brand, their scores range from 70% to 85%.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-900 text-amber-50 p-12 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 opacity-10">
            <Scale className="w-48 h-48" />
          </div>
          <h2 className="serif text-4xl mb-6 italic">Why expand the search?</h2>
          <div className="space-y-6 text-amber-100/70">
            <p>
              Most comparison sites only show you stores that pay them for a spot. We don't take money from retailers.
            </p>
            <p>
              By extending our search to include smaller discounters and international sellers, we often find prices <strong>40-60% lower</strong> than department stores.
            </p>
            <div className="pt-6 border-t border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="w-5 h-5 text-amber-400" />
                <span className="text-amber-50 font-bold">Real-time Scrutiny</span>
              </div>
              <p className="text-sm">
                Our AI analyzes recent customer sentiment and technical site metrics to generate the Credibility Score you see on every listing.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-amber-100 rounded-[3rem] p-12 md:p-16 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-6" />
        <h3 className="serif text-3xl text-amber-900 mb-4">A Note on Safety</h3>
        <p className="text-amber-900/50 max-w-2xl mx-auto leading-relaxed">
          If a seller has a score below 60%, we flag them as "Risky." While their price might be tempting, we always recommend sticking to sellers with our "Verified" badge for your peace of mind.
        </p>
      </div>
    </div>
  );
};

export default TrustedSellers;
