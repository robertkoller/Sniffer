
import React, { useState, useRef } from 'react';

export const HoverShift: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return (
    <div className={`transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(251,191,36,0.15)] rounded-3xl ${className}`}>
      {children}
    </div>
  );
};

export const ProximityCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;
    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  return (
    <div 
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
        transition: 'transform 0.1s ease-out'
      }}
      className={className}
    >
      {children}
    </div>
  );
};

export const IconAnim: React.FC<{ children: React.ReactElement<any> }> = ({ children }) => {
  return React.cloneElement(children, {
    className: `${children.props.className || ''} transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12`
  });
};
