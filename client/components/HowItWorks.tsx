
import React from 'react';
import { Search, ShieldCheck, TrendingDown, MapPin, ChevronLeft, Sparkles, Zap, CheckCircle2 } from 'lucide-react';
import { HoverShift, IconAnim } from './MicroInteractions';

interface HowItWorksProps {
  onBack: () => void;
}

const HowItWorks: React.FC<HowItWorksProps> = ({ onBack }) => {
  const steps = [
    {
      icon: <Search className="w-8 h-8" />,
      title: "Deep Search",
      description: "Our AI scours the web for the exact scent you're looking for, bypassing generic ads to find actual listings."
    },
    {
      icon: <TrendingDown className="w-8 h-8" />,
      title: "Price Comparison",
      description: "We compare prices across 12-15 different retailers, from giant department stores to hidden niche discounters."
    },
    {
      icon: <ShieldCheck className="w-8 h-8" />,
      title: "Trust Verification",
      description: "Every seller is assigned a credibility score based on their history and user reviews, so you can shop with confidence."
    },
    {
      icon: <MapPin className="w-8 h-8" />,
      title: "Try Before Buy",
      description: "We locate physical stores nearby that offer testers, so you don't have to blind-buy your next signature scent."
    }
  ];

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

      <div className="text-center mb-20">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 rounded-full text-amber-700 text-[10px] font-black uppercase tracking-widest mb-6">
          <Sparkles className="w-3 h-3" />
          The Science of Scent Search
        </div>
        <h1 className="serif text-6xl text-amber-900 mb-6">How Sniffer Works</h1>
        <p className="text-amber-800/60 max-w-2xl mx-auto text-lg leading-relaxed">
          We use advanced AI grounding to bridge the gap between your desire for a luxury fragrance and the messy reality of online pricing.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-20">
        {steps.map((step, i) => (
          <HoverShift key={i} className="bg-white p-10 border border-amber-100/50 shadow-sm hover:shadow-xl group">
            <div className="w-16 h-16 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:rotate-6">
              {step.icon}
            </div>
            <h3 className="serif text-3xl text-amber-900 mb-4">{step.title}</h3>
            <p className="text-amber-900/60 leading-relaxed font-medium">
              {step.description}
            </p>
          </HoverShift>
        ))}
      </div>

      <div className="bg-amber-900 rounded-[3rem] p-12 md:p-20 text-amber-50 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5">
          <Zap className="w-64 h-64" />
        </div>
        
        <div className="relative z-10 max-w-2xl">
          <h2 className="serif text-4xl mb-8">Why trust us?</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <CheckCircle2 className="w-6 h-6 text-amber-400 shrink-0" />
              <p className="text-amber-100/80 leading-relaxed">
                <strong>Unbiased Data:</strong> Unlike comparison sites that are paid to list retailers, we use real-time search results to find the actual best prices.
              </p>
            </div>
            <div className="flex gap-4">
              <CheckCircle2 className="w-6 h-6 text-amber-400 shrink-0" />
              <p className="text-amber-100/80 leading-relaxed">
                <strong>Safe Shopping:</strong> Our credibility engine flags "gray market" sellers so you know exactly what you're getting.
              </p>
            </div>
            <div className="flex gap-4">
              <CheckCircle2 className="w-6 h-6 text-amber-400 shrink-0" />
              <p className="text-amber-100/80 leading-relaxed">
                <strong>No Hidden Fees:</strong> Sniffer is a free tool for fragrance enthusiasts. We just want you to smell amazing without overpaying.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
