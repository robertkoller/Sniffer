
import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface SearchHeaderProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

const SearchHeader: React.FC<SearchHeaderProps> = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-12 px-4">
      <form onSubmit={handleSubmit} className="relative group">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sniff out a cologne..."
          disabled={isLoading}
          className="w-full py-4 pl-6 pr-14 bg-white border border-amber-200 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-600 transition-all text-lg text-amber-900 placeholder-amber-800/30"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="absolute right-2 top-2 bottom-2 px-4 bg-amber-800 text-white rounded-full hover:bg-amber-900 transition-colors flex items-center justify-center disabled:bg-amber-200 group"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Search className="w-5 h-5 transition-transform group-hover:scale-110" />
          )}
        </button>
      </form>
      <p className="mt-4 text-center text-amber-800/40 text-sm">
        Try "Tom Ford Tobacco Vanille" or "Bleu de Chanel"
      </p>
    </div>
  );
};

export default SearchHeader;
