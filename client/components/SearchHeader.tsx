
import React, { useState, useRef } from 'react';
import { Search, Camera, Image as ImageIcon } from 'lucide-react';

interface SearchHeaderProps {
  onSearch: (query: string) => void;
  onImageUpload: (base64: string) => void;
  isLoading: boolean;
}

const SearchHeader: React.FC<SearchHeaderProps> = ({ onSearch, onImageUpload, isLoading }) => {
  const [query, setQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
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
          className="w-full py-5 pl-14 pr-32 bg-white border border-amber-200 rounded-[2rem] shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-900/10 focus:border-amber-600 transition-all text-lg text-amber-900 placeholder-amber-800/30"
        />
        
        {/* Left Search Icon */}
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-amber-400">
          <Search className="w-5 h-5" />
        </div>

        <div className="absolute right-2 top-2 bottom-2 flex gap-1.5">
          {/* Visual Search Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="px-4 bg-amber-50 text-amber-700 rounded-2xl hover:bg-amber-100 transition-all flex items-center justify-center disabled:opacity-50"
            title="Search with photo"
          >
            <Camera className="w-5 h-5" />
          </button>

          <button
            type="submit"
            disabled={isLoading}
            className="px-6 bg-amber-900 text-white rounded-2xl hover:bg-black transition-all flex items-center justify-center disabled:bg-amber-200"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="font-bold text-xs uppercase tracking-widest">Find</span>
            )}
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
          capture="environment"
        />
      </form>
      <p className="mt-4 text-center text-amber-800/40 text-[10px] font-bold uppercase tracking-[0.2em]">
        Type a name or <span className="text-amber-600">upload a photo</span> to identify
      </p>
    </div>
  );
};

export default SearchHeader;
