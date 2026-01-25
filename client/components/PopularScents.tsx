
import React from 'react';
import { HoverShift } from './MicroInteractions';

const POPULAR_SCENTS = [
  { 
    id: '1', 
    name: 'Tobacco Vanille', 
    brand: 'Tom Ford', 
    image: '/images/tobacco-vanille.jpg' 
  },
  { 
    id: '2', 
    name: 'Aventus', 
    brand: 'Creed', 
    image: '/images/aventus.jpg' 
  },
  { 
    id: '3', 
    name: 'Sauvage', 
    brand: 'Dior', 
    image: '/images/sauvage.jpg' 
  },
  { 
    id: '4', 
    name: 'Baccarat Rouge 540', 
    brand: 'MFK', 
    image: '/images/baccarat-rouge.jpg' 
  },
];

const PopularScents: React.FC<{ onSelect: (name: string) => void }> = ({ onSelect }) => {
  return (
    <div className="mt-20 px-4 max-w-6xl mx-auto pb-20">
      <h3 className="serif text-2xl text-amber-900 mb-8 font-semibold">Currently Sniffing</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {POPULAR_SCENTS.map((scent) => (
          <button 
            key={scent.id} 
            onClick={() => onSelect(`${scent.brand} ${scent.name}`)}
            className="group text-left focus:outline-none"
          >
            <HoverShift className="bg-white overflow-hidden border border-amber-50">
              <div className="aspect-[4/5] relative">
                <img 
                  src={scent.image} 
                  alt={scent.name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-amber-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-600/70 mb-1">{scent.brand}</p>
                <h4 className="serif text-lg text-amber-900 group-hover:text-amber-700 transition-colors">{scent.name}</h4>
              </div>
            </HoverShift>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PopularScents;
