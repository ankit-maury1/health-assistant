"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import PredictionForm from "./components/PredictionForm";


export default function Home() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let retryCount = 0;
    const MAX_RETRY_DELAY = 60000; // Max 60 seconds between retries
    const BASE_DELAY = 5000; // Start with 5 seconds

    const getRetryDelay = (attempt: number): number => {
      // Exponential backoff: 5s, 10s, 20s, 40s, 60s (max)
      const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_RETRY_DELAY);
      return delay;
    };

    const checkServer = async () => {
      const controller = new AbortController();
      const startTime = Date.now();
      const abortTimeoutId = setTimeout(() => controller.abort("health-check-timeout"), 2000);
      
      try {
        // Attempt to connect to the Backend via Next.js API proxy
        const response = await fetch('/api/health', { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });
        
        clearTimeout(abortTimeoutId);
        const elapsedTime = Date.now() - startTime;

        if (response.ok) {
          // If response came back quickly, wait to show at least 2 seconds of "checking"
          const remainingTime = Math.max(0, 2000 - elapsedTime);
          
          if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
          }
          
          setServerStatus('online');
          
          // Reset retry count on successful connection
          retryCount = 0;
          
          // Clear any pending retry timeout
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        } else {
          setServerStatus('offline');
          
          // Schedule next retry with exponential backoff
          const delay = getRetryDelay(retryCount);
          retryCount++;
          
          timeoutId = setTimeout(checkServer, delay);
        }
      } catch (error) {
        const isAbortError = error instanceof DOMException && error.name === "AbortError";
        if (!isAbortError) {
          console.error(error);
        }
        // If connection fails (e.g. server not running or took > 2 seconds)
        const elapsedTime = Date.now() - startTime;
        
        // If it took more than 2 seconds (timeout), immediately show online
        if (elapsedTime >= 2000) {
          setServerStatus('online');
          
          // Reset retry count
          retryCount = 0;
          
          // Clear any pending retry timeout
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        } else {
          setServerStatus('offline');
          
          // Schedule next retry with exponential backoff
          const delay = getRetryDelay(retryCount);
          retryCount++;
          
          timeoutId = setTimeout(checkServer, delay);
        }
      } finally {
        clearTimeout(abortTimeoutId);
      }
    };

    // Initial check
    checkServer();

    // Browser online/offline event listeners for immediate detection
    const handleOnline = () => {
      // When browser detects network is back, immediately retry
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      retryCount = 0; // Reset backoff
      checkServer(); // Immediate check
    };

    const handleOffline = () => {
      // Browser detected network is offline
      setServerStatus('offline');
    };

    // Listen to browser's network status changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also listen for visibility changes - check when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && serverStatus === 'offline') {
        // User returned to tab and server was offline, do immediate check
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        retryCount = 0;
        checkServer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [serverStatus]);

  useEffect(() => {
    // Check initial theme
    const checkTheme = () => {
      setIsDarkTheme(document.documentElement.classList.contains('dark'));
    };
    
    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setMousePosition({
      x: e.clientX,
      y: e.clientY,
    });
  };

  const getStatusConfig = () => {
    switch (serverStatus) {
      case 'online':
        return {
          ping: 'bg-green-400',
          dot: 'bg-green-500',
          text: 'AI System Online'
        };
      case 'checking':
        return {
          ping: 'bg-yellow-400',
          dot: 'bg-yellow-500',
          text: 'Connecting to AI...'
        };
      case 'offline':
        return {
          ping: 'bg-red-400',
          dot: 'bg-red-500',
          text: 'AI System Offline'
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div 
      className="relative min-h-screen overflow-hidden bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-950 dark:via-purple-950 dark:to-pink-950 flex flex-col items-center justify-center text-white p-4"
      onMouseMove={handleMouseMove}
    >
      {/* Global cursor glow effect - dark theme only */}
      {isDarkTheme && (
        <div 
          className="fixed inset-0 pointer-events-none z-30 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle 450px at ${mousePosition.x}px ${mousePosition.y}px, rgba(168,85,247,0.15) 0%, rgba(99,102,241,0.08) 35%, transparent 75%)`,
            opacity: 0.7,
          }}
        />
      )}
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating gradient orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-400/30 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-400/30 rounded-full blur-3xl animate-float delay-200"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl animate-pulse-slow"></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-size-[50px_50px] mask-[radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_110%)]"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-4xl text-center space-y-8 md:space-y-10 transition-all duration-1000 opacity-100 translate-y-0">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 animate-fade-in-down">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusConfig.ping} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${statusConfig.dot}`}></span>
          </span>
          <span className="text-sm font-semibold text-white/90">{statusConfig.text}</span>
        </div>

        {/* Main heading */}
        <h1 className="text-4xl sm:text-5xl md:text-8xl font-extrabold tracking-tight drop-shadow-2xl animate-fade-in-down delay-100">
          <span className="block mb-3 md:mb-4 bg-clip-text text-transparent bg-linear-to-r from-white via-purple-100 to-pink-100">
            Health Prediction
          </span>
          <span className="block text-3xl sm:text-4xl md:text-7xl bg-clip-text text-transparent bg-linear-to-r from-indigo-200 via-purple-200 to-pink-200 animate-gradient">
            Powered by AI
          </span>
        </h1>

        {/* Description */}
        <p className="text-base sm:text-lg md:text-2xl text-indigo-100/90 max-w-2xl mx-auto leading-relaxed font-medium animate-fade-in-up delay-200 backdrop-blur-sm px-2">
          Advanced machine learning algorithms to assess your health risks
          <span className="block mt-2 text-purple-200 font-semibold">instantly and securely</span>
        </p>

    
  

        {/* CTA Buttons */}
        <div className="pt-8 animate-fade-in-up delay-400 flex flex-col sm:flex-row gap-6 justify-center items-center">
          <Link 
            href="/diabetes" 
            className="group relative inline-flex w-full sm:w-auto items-center justify-center gap-2 sm:gap-3 bg-white text-indigo-600 px-7 sm:px-10 py-4 sm:py-5 rounded-2xl font-bold text-base sm:text-xl shadow-2xl hover:shadow-[0_20px_60px_-15px_rgba(255,255,255,0.5)] hover:scale-[1.03] active:scale-[1.01] transition-all duration-500 overflow-hidden"
          >
            {/* Button glow effect */}
            <div className="absolute inset-0 bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl"></div>
            
            <svg className="relative z-10 w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="relative z-10">Diabetes Risk</span>
            
            <svg className="relative z-10 w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>

            {/* Shine effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-linear-to-r from-transparent via-white/30 to-transparent skew-x-12"></div>
          </Link>

          <Link 
            href="/heart-disease" 
            className="group relative inline-flex w-full sm:w-auto items-center justify-center gap-2 sm:gap-3 bg-white text-red-600 px-7 sm:px-10 py-4 sm:py-5 rounded-2xl font-bold text-base sm:text-xl shadow-2xl hover:shadow-[0_20px_60px_-15px_rgba(239,68,68,0.5)] hover:scale-[1.03] active:scale-[1.01] transition-all duration-500 overflow-hidden"
          >
            {/* Button glow effect */}
            <div className="absolute inset-0 bg-linear-to-r from-red-600 via-pink-600 to-rose-600 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl"></div>
            
            <svg className="relative z-10 w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="relative z-10">Heart Disease Risk</span>
            
            <svg className="relative z-10 w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>

            {/* Shine effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-linear-to-r from-transparent via-white/30 to-transparent skew-x-12"></div>
          </Link>
        </div>
        {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-3 animate-fade-in-up delay-300">
          {['Fast & Accurate', 'Privacy First', 'Expert Backed'].map((feature, idx) => (
            <div key={idx} className="px-5 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm font-semibold hover:bg-white/20 hover:scale-105 transition-all duration-300 cursor-default">
              {feature}
            </div>
          ))}
        </div>

        {/* Quick prediction form component */}
        {/* <div className="mt-10 w-full bg-white/90 rounded-xl shadow-xl p-6 backdrop-blur">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Quick Prediction (Guest + Logged In)</h2>
          <PredictionForm />
        </div> */}

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center items-center gap-8 pt-8 text-indigo-200/70 text-sm animate-fade-in delay-500">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">LLM</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" />
            </svg>
            <span className="font-medium">Trusted by us</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Instant Results</span>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-indigo-900/50 to-transparent"></div>
    </div>
  );
}
