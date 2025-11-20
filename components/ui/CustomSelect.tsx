"use client";

import { useState, useRef, useEffect } from "react";

interface Option {
  label: string;
  value: string | number;
}

interface CustomSelectProps {
  label: string;
  name: string;
  value: string | number;
  options: Option[];
  onChange: (e: { target: { name: string; value: string | number } }) => void;
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
}

export default function CustomSelect({
  label,
  name,
  value,
  options,
  onChange,
  placeholder = "Select an option",
  required = false,
  icon,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value.toString() === value.toString());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string | number) => {
    onChange({ target: { name, value: optionValue } });
    setIsOpen(false);
  };

  return (
    <div className="group relative" ref={containerRef}>
      <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 transition-colors group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">
        <span className="flex items-center gap-2">
          {icon}
          {label}
          {required && <span className="text-red-500">*</span>}
        </span>
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-5 py-3.5 pr-10 text-left rounded-xl border-2 
            ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500 bg-white dark:bg-gray-700' : 'border-gray-300/50 dark:border-gray-600/50 bg-white/90 dark:bg-gray-800/90'} 
            backdrop-blur-sm text-gray-900 dark:text-white 
            hover:border-indigo-400 dark:hover:border-indigo-600 
            transition-all duration-300 outline-none shadow-lg font-medium flex items-center justify-between`}
        >
          <span className={!selectedOption ? "text-gray-500 dark:text-gray-400" : ""}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180 text-indigo-500" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        <div
          className={`absolute z-50 w-full mt-2 overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl transition-all duration-200 origin-top
            ${isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"}`}
        >
          <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
            {options.map((option) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`px-5 py-3 cursor-pointer transition-colors duration-150 flex items-center justify-between
                  ${value.toString() === option.value.toString() 
                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 font-semibold" 
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-indigo-600 dark:hover:text-indigo-300"
                  }`}
              >
                {option.label}
                {value.toString() === option.value.toString() && (
                  <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
