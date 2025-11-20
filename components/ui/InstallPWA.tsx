'use client';

import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPWA() {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e as BeforeInstallPromptEvent);
    };
    
    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setTimeout(() => setIsInstalled(true), 0);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const onInstallClick = async (evt: React.MouseEvent) => {
    evt.preventDefault();
    if (!promptInstall) {
      return;
    }
    promptInstall.prompt();
    const { outcome } = await promptInstall.userChoice;
    if (outcome === 'accepted') {
      setSupportsPWA(false);
    }
  };

  const onDismiss = () => {
    setSupportsPWA(false);
  };

  if (!supportsPWA || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-auto max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-indigo-500/20 dark:border-indigo-400/20 rounded-full shadow-2xl p-2 pr-6 flex items-center gap-4">
        <div className="bg-indigo-500/10 dark:bg-indigo-400/10 p-3 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400">
            <rect width="20" height="20" x="2" y="2" rx="2" ry="2"/>
            <path d="M12 12v6"/>
            <path d="m15 15-3 3-3-3"/>
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Install App</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Add to home screen</span>
        </div>
        <div className="flex gap-2 ml-2">
          <button 
            onClick={onDismiss}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
            aria-label="Dismiss"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
          <button 
            onClick={onInstallClick}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-full transition-colors shadow-lg shadow-indigo-500/25"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
