
import React from 'react';
import { ChevronLeft, Hammer, Sparkles, Clock } from 'lucide-react';

interface FeatureNotReadyProps {
  featureName: string;
  onBack: () => void;
}

const FeatureNotReady: React.FC<FeatureNotReadyProps> = ({ featureName, onBack }) => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20 text-center animate-results">
      <div className="inline-flex items-center justify-center w-24 h-24 bg-amber-50 text-amber-700 rounded-[2rem] mb-8 animate-pulse">
        <Hammer className="w-10 h-10" />
      </div>
      
      <h1 className="serif text-5xl text-amber-900 mb-6">Scent still maturing...</h1>
      <p className="text-amber-800/60 max-w-lg mx-auto text-lg mb-12">
        We're currently distilling the <strong>{featureName}</strong> feature. Like a fine fragrance, the best things take time to perfect.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 text-left">
        {[
          { icon: <Clock />, title: "Distilling", desc: "Refining the core logic" },
          { icon: <Sparkles />, title: "Polishing", desc: "Perfecting the interface" },
          { icon: <Hammer />, title: "Building", desc: "Strengthening the backend" }
        ].map((item, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-amber-100/50">
            <div className="text-amber-700 mb-3">{item.icon}</div>
            <h4 className="font-bold text-amber-900 mb-1">{item.title}</h4>
            <p className="text-sm text-amber-900/40">{item.desc}</p>
          </div>
        ))}
      </div>

      <button 
        onClick={onBack}
        className="inline-flex items-center gap-3 bg-amber-900 text-amber-50 px-8 py-4 rounded-2xl hover:bg-amber-800 transition-all font-bold uppercase text-xs tracking-widest shadow-xl"
      >
        <ChevronLeft className="w-4 h-4" />
        Return to Home
      </button>
    </div>
  );
};

export default FeatureNotReady;
