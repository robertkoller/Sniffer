
import React from 'react';
import { FragranceSuggestion } from '../types';
import { ChevronLeft, ChevronRight, FlaskConical, Sparkles } from 'lucide-react';

interface SuggestionListProps {
  query: string;
  suggestions: FragranceSuggestion[];
  onSelect: (suggestion: FragranceSuggestion) => void;
  onBack: () => void;
  // id of the suggestion currently being loaded into the full price view
  loadingId: string | null;
}

const SuggestionList: React.FC<SuggestionListProps> = ({
  query,
  suggestions,
  onSelect,
  onBack,
  loadingId,
}) => {
  const isBusy = loadingId !== null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
        <button
          onClick={onBack}
          disabled={isBusy}
          className="inline-flex items-center gap-3 text-amber-900/60 hover:text-amber-900 transition-all group font-bold uppercase text-xs tracking-widest disabled:opacity-40 disabled:pointer-events-none"
        >
          <div className="w-10 h-10 rounded-full border border-amber-900/10 flex items-center justify-center transition-all group-hover:bg-amber-900 group-hover:text-white">
            <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          </div>
          <span>New Search</span>
        </button>

        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-full border border-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest self-start sm:self-auto">
          <Sparkles className="w-4 h-4" />
          {suggestions.length} {suggestions.length === 1 ? 'Match' : 'Matches'}
        </div>
      </div>

      <div className="mb-8">
        <p className="text-amber-800/40 text-[10px] font-bold uppercase tracking-[0.3em] mb-2">
          Results for
        </p>
        <h2 className="serif text-4xl text-amber-900">
          <span className="italic text-amber-700">“{query}”</span>
        </h2>
        <p className="text-amber-800/60 text-sm mt-3">
          Pick the exact fragrance to see live prices from trusted sellers.
        </p>
      </div>

      <ul className="grid gap-4">
        {suggestions.map((suggestion) => {
          const isLoadingThis = loadingId === suggestion.id;
          const imageSource = suggestion.thumbnail ?? suggestion.imageUrl;
          const meta = [suggestion.year, suggestion.gender].filter(Boolean).join(' · ');

          return (
            <li key={suggestion.id}>
              <button
                type="button"
                onClick={() => onSelect(suggestion)}
                disabled={isBusy}
                aria-busy={isLoadingThis}
                className={`group w-full text-left flex items-center gap-5 p-4 sm:p-5 bg-white border rounded-3xl shadow-sm transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:border-amber-600 ${
                  isLoadingThis
                    ? 'border-amber-400 shadow-lg'
                    : 'border-amber-100/70 hover:border-amber-300 hover:shadow-lg hover:-translate-y-0.5'
                } ${isBusy && !isLoadingThis ? 'opacity-40 pointer-events-none' : ''}`}
              >
                {/* Bottle image with graceful fallback */}
                <div className="w-16 h-20 shrink-0 rounded-2xl bg-amber-50/60 border border-amber-100/60 overflow-hidden flex items-center justify-center">
                  {imageSource ? (
                    <img
                      src={imageSource}
                      alt={`${suggestion.brand} ${suggestion.name}`}
                      loading="lazy"
                      className="w-full h-full object-contain"
                      onError={(event) => {
                        // Hide the broken image and reveal the flask fallback beside it
                        const target = event.currentTarget;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <FlaskConical
                    className={`w-6 h-6 text-amber-300 ${imageSource ? 'hidden' : ''}`}
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600/70 mb-1 truncate">
                    {suggestion.brand}
                  </p>
                  <h3 className="serif text-xl text-amber-900 leading-tight group-hover:text-amber-700 transition-colors truncate">
                    {suggestion.name}
                  </h3>
                  {meta ? (
                    <p className="text-amber-800/50 text-xs mt-1 capitalize">{meta}</p>
                  ) : null}
                </div>

                <div className="shrink-0">
                  {isLoadingThis ? (
                    <div className="w-11 h-11 rounded-full bg-amber-900 text-white flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-900 flex items-center justify-center transition-all group-hover:bg-amber-900 group-hover:text-white">
                      <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SuggestionList;
