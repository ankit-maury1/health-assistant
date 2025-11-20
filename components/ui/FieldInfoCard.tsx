'use client';

import React, { useState } from 'react';

interface FieldInfoCardProps {
  title: string;
  info: string;
  icon?: React.ReactNode;
}

export const FieldInfoCard = ({ title, info, icon }: FieldInfoCardProps) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div 
      className="group relative h-full transition-shadow duration-700 cursor-default"
      onMouseMove={handleMouseMove}
    >
      {/* Glow effect on hover - background */}
      <div className="absolute -inset-2 bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400 rounded-3xl opacity-0 group-hover:opacity-40 blur-2xl transition-all duration-700"></div>
      
      <div className="relative h-full bg-linear-to-br from-indigo-50/95 via-purple-50/95 to-pink-50/95 dark:from-indigo-900/30 dark:via-purple-900/30 dark:to-pink-900/30 backdrop-blur-xl rounded-2xl border-2 border-indigo-200/50 dark:border-indigo-700/40 p-6 shadow-lg hover:shadow-2xl transition-all duration-700 overflow-hidden">
        {/* Cursor glow effect */}
        <div 
          className="absolute w-64 h-64 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, rgba(168,85,247,0.2) 30%, rgba(236,72,153,0.1) 50%, transparent 70%)',
            left: `${mousePosition.x}px`,
            top: `${mousePosition.y}px`,
            transform: 'translate(-50%, -50%)',
            transition: 'opacity 500ms ease-out',
          }}
        />
        
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-linear-to-br from-indigo-100/30 via-purple-100/30 to-pink-100/30 dark:from-indigo-800/20 dark:via-purple-800/20 dark:to-pink-800/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
        
        {/* Content */}
        <div className="relative flex items-start gap-4">
          {icon && (
            <div className="shrink-0 text-indigo-600 dark:text-indigo-400 transform transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 group-hover:text-purple-600 dark:group-hover:text-purple-400">
              {icon}
            </div>
          )}
          <div className="flex-1 space-y-2">
            <h4 className="font-bold text-lg bg-linear-to-r from-indigo-900 to-purple-900 dark:from-indigo-100 dark:to-purple-100 bg-clip-text text-transparent transition-all duration-500 group-hover:from-purple-900 group-hover:to-pink-900 dark:group-hover:from-purple-100 dark:group-hover:to-pink-100">
              {title}
            </h4>
            <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed font-medium opacity-90 group-hover:opacity-100 transition-opacity duration-500">
              {info}
            </p>
          </div>
        </div>

        {/* Decorative corner element */}
        <div className="absolute top-0 right-0 w-20 h-20 bg-linear-to-br from-purple-400/20 to-pink-400/20 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
      </div>
    </div>
  );
};
