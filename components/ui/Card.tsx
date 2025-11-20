'use client';

import React, { useState } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export const Card = ({ children, className = "", title, description, style, ...props }: CardProps) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    props.onMouseMove?.(e);
  };

  return (
    <div 
      className={`group relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 dark:border-slate-700/40 transition-shadow duration-700 ease-out hover:shadow-[0_20px_60px_-15px_rgba(99,102,241,0.3)] p-8 cursor-default ${className}`}
      onMouseMove={handleMouseMove}
      style={style}
      {...props}
    >
      {/* Background effects container - clipped */}
      <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
        {/* Cursor glow effect - internal - diffused with no visible circle */}
        <div 
          className="absolute inset-0 opacity-0 dark:group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0"
          style={{
            background: `radial-gradient(circle 350px at ${mousePosition.x}px ${mousePosition.y}px, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.08) 35%, transparent 75%)`,
            transition: 'opacity 500ms ease-out',
          }}
        />
        
        {/* Animated gradient border effect - background glow */}
        <div className="absolute -inset-2 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-linear-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30 blur-2xl -z-10"></div>
        
        {/* Subtle shimmer effect on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-3000">
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
        </div>
      </div>

      <div className="relative z-10">
        {(title || description) && (
          <div className="relative mb-6 border-b border-slate-200/60 dark:border-slate-700/60 pb-5">
            {title && (
              <h3 className="text-2xl font-bold bg-linear-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-200 bg-clip-text text-transparent tracking-tight mb-1 transition-all duration-500 group-hover:from-indigo-600 group-hover:to-purple-600 dark:group-hover:from-indigo-400 dark:group-hover:to-purple-400">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm font-medium tracking-wide">
                {description}
              </p>
            )}
          </div>
        )}
        
        {children}
      </div>
    </div>
  );
};
