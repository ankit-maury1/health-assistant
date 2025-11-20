"use client";

import { useState, useEffect, FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { FieldInfoCard } from "@/components/ui/FieldInfoCard";
import CustomSelect from "@/components/ui/CustomSelect";

interface Suggestion {
  title: string;
  priority: string;
  rationale: string;
  actionable_steps: string[];
  measurable_goal: string;
  precautions: string | null;
  resources: string[] | null;
  estimated_timeframe: string;
}

interface PredictionResult {
  prediction: string;
  probability: number;
  advice: {
    risk_level: string;
    score: number;
    suggestions: {
      suggestions: Suggestion[];
      note: string;
    };
  };
}

export default function Diabetes() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [formData, setFormData] = useState({
    gender: "",
    age: "",
    height: "",
    weight: "",
    hypertension: false,
    heartDisease: false,
    smokingHistory: "-1",
    bmi: "",
    hbA1cLevel: "",
    bloodGlucoseLevel: "",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isBackendReady, setIsBackendReady] = useState(true);

  // Check backend health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) setIsBackendReady(false);
      } catch {
        setIsBackendReady(false);
      }
    };
    checkHealth();
  }, []);

  // Dark theme detection
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkTheme(document.documentElement.classList.contains('dark'));
    };
    
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Auto-calculate BMI
  useEffect(() => {
    if (formData.height && formData.weight) {
      const heightInMeters = parseFloat(formData.height) / 100;
      const weightInKg = parseFloat(formData.weight);
      if (heightInMeters > 0 && weightInKg > 0) {
        const calculatedBmi = (weightInKg / (heightInMeters * heightInMeters)).toFixed(1);
        setFormData((prev) => ({ ...prev, bmi: calculatedBmi }));
      }
    }
  }, [formData.height, formData.weight]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const payload = {
        gender: parseInt(formData.gender),
        age: parseFloat(formData.age),
        hypertension: formData.hypertension ? 1 : 0,
        heartDisease: formData.heartDisease ? 1 : 0,
        smokingHistory: parseInt(formData.smokingHistory),
        bmi: parseFloat(formData.bmi),
        hbA1cLevel: parseFloat(formData.hbA1cLevel),
        bloodGlucoseLevel: parseFloat(formData.bloodGlucoseLevel),
        height: parseFloat(formData.height),
        weight: parseFloat(formData.weight),
      };

      const response = await fetch("/api/predict-diabetes", {
        method: "post",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to get prediction");

      const data = await response.json();
      setResult(data);
    } catch {
      setError("An error occurred while processing your request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string | number } }) => {
    // Handle both native events and custom component events
    const target = e.target as HTMLInputElement; // Type assertion for easier access to checked
    const name = target.name;
    const value = target.value;
    
    // Check if it's a checkbox (only possible with native input event)
    const isCheckbox = 'type' in target && target.type === "checkbox";
    const checked = isCheckbox ? target.checked : false;

    // Validation logic
    if ('getAttribute' in target && !isCheckbox) {
      const min = target.getAttribute('min');
      const max = target.getAttribute('max');
      
      if (min || max) {
        const numValue = parseFloat(value.toString());
        const minVal = min ? parseFloat(min) : Number.NEGATIVE_INFINITY;
        const maxVal = max ? parseFloat(max) : Number.POSITIVE_INFINITY;

        if (!isNaN(numValue)) {
          if (numValue < minVal) {
            setFieldErrors(prev => ({ ...prev, [name]: `Value must be at least ${minVal}` }));
          } else if (numValue > maxVal) {
            setFieldErrors(prev => ({ ...prev, [name]: `Value must be at most ${maxVal}` }));
          } else {
            setFieldErrors(prev => {
              const newErrors = { ...prev };
              delete newErrors[name];
              return newErrors;
            });
          }
        } else {
           setFieldErrors(prev => {
              const newErrors = { ...prev };
              delete newErrors[name];
              return newErrors;
            });
        }
      }
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: isCheckbox ? checked : value,
    }));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setMousePosition({
      x: e.clientX,
      y: e.clientY,
    });
  };

  return (
    <div 
      className="relative min-h-screen overflow-hidden bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-950 dark:via-purple-950 dark:to-pink-950 py-12 px-4 sm:px-6 lg:px-8"
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
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl animate-float delay-300"></div>
        <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-indigo-400/15 rounded-full blur-3xl animate-pulse-slow"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-8">
        <div className="text-center mb-12 animate-fade-in-down">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-white/10 backdrop-blur-xl border border-white/20">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-sm font-semibold text-white/90">AI Health Assessment</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-4 tracking-tight drop-shadow-2xl">
            Diabetes Risk <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-200 via-purple-200 to-pink-200 animate-gradient">Prediction</span>
          </h1>
          <p className="text-indigo-100 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">Advanced AI-powered health analysis for a better tomorrow.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form Area */}
          <div className="lg:col-span-2 space-y-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              <Card title="Personal Details" description="Basic information about yourself" className="animate-fade-in-up delay-100 z-30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <CustomSelect
                    label="Gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    placeholder="Select Gender"
                    icon={
                      <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    }
                    options={[
                      { label: "Female", value: "0" },
                      { label: "Male", value: "1" }
                    ]}
                  />

                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 transition-colors group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">Age</label>
                    <input
                      type="number"
                      name="age"
                      required
                      min="0"
                      value={formData.age}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-300/50 dark:border-gray-600/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-300 outline-none shadow-lg font-medium"
                      placeholder="Enter your age"
                    />
                    {fieldErrors.age && <p className="text-red-500 text-xs mt-1 ml-1">{fieldErrors.age}</p>}
                  </div>

                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 transition-colors group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">Height (cm)</label>
                    <input
                      type="number"
                      name="height"
                      required
                      min="90"
                      value={formData.height}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-300/50 dark:border-gray-600/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-300 outline-none shadow-lg font-medium"
                      placeholder="in centimeters"
                    />
                    {fieldErrors.height && <p className="text-red-500 text-xs mt-1 ml-1">{fieldErrors.height}</p>}
                  </div>
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 transition-colors group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">Weight (kg)</label>
                    <input
                      type="number"
                      name="weight"
                      required
                      min="0"
                      value={formData.weight}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-300/50 dark:border-gray-600/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-300 outline-none shadow-lg font-medium"
                      placeholder="in kilograms"
                    />
                    {fieldErrors.weight && <p className="text-red-500 text-xs mt-1 ml-1">{fieldErrors.weight}</p>}
                  </div>
                </div>
              </Card>

              <Card title="Medical History" description="Your past and current health status" className="animate-fade-in-up delay-200 z-20">
                <div className="space-y-6">
                  <CustomSelect
                    label="Smoking History"
                    name="smokingHistory"
                    value={formData.smokingHistory}
                    onChange={handleChange}
                    placeholder="Select Status"
                    icon={
                      <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    }
                    options={[
                      { label: "Never Smoked", value: "0" },
                      { label: "Former Smoker", value: "1" },
                      { label: "Current Smoker", value: "2" },
                      { label: "Unknown", value: "-1" }
                    ]}
                  />

                  <div className="flex flex-wrap gap-6 pt-2">
                    <label className="flex items-center space-x-3 cursor-pointer group bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm px-6 py-4 rounded-xl border-2 border-transparent hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-300 shadow-lg">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          name="hypertension"
                          checked={formData.hypertension}
                          onChange={handleChange}
                          className="peer sr-only"
                        />
                        <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-md peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all duration-200"></div>
                        <svg className="absolute w-4 h-4 text-white top-1 left-1 opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-gray-700 dark:text-gray-200 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Hypertension</span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer group bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm px-6 py-4 rounded-xl border-2 border-transparent hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-300 shadow-lg hover:scale-105">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          name="heartDisease"
                          checked={formData.heartDisease}
                          onChange={handleChange}
                          className="peer sr-only"
                        />
                        <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-md peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all duration-200"></div>
                        <svg className="absolute w-4 h-4 text-white top-1 left-1 opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-gray-700 dark:text-gray-200 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Heart Disease</span>
                    </label>
                  </div>
                </div>
              </Card>

              <Card title="Clinical Metrics" description="Recent lab results and measurements" className="animate-fade-in-up delay-300 z-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 transition-colors group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">BMI</label>
                    <input
                      type="number"
                      name="bmi"
                      step="0.1"
                      min="5"
                      value={formData.bmi}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-300/40 dark:border-gray-600/40 bg-gray-100/80 dark:bg-gray-800/60 backdrop-blur-sm text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300 outline-none cursor-not-allowed font-mono shadow-inner"
                      readOnly
                      placeholder="Auto-calculated"
                    />
                  </div>
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 transition-colors group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">Hemoglobin A1c Level</label>
                    <input
                      type="number"
                      name="hbA1cLevel"
                      step="0.1"
                      min="3"
                      max="15"
                      required
                      value={formData.hbA1cLevel}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-300/50 dark:border-gray-600/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-300 outline-none shadow-lg font-medium"
                      placeholder="3.0 - 15.0"
                    />
                    {fieldErrors.hbA1cLevel && <p className="text-red-500 text-xs mt-1 ml-1">{fieldErrors.hbA1cLevel}</p>}
                  </div>
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 transition-colors group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">Blood Glucose</label>
                    <input
                      type="number"
                      name="bloodGlucoseLevel"
                      step="1"
                      min="50"
                      max="500"
                      required
                      value={formData.bloodGlucoseLevel}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-300/50 dark:border-gray-600/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-300 outline-none shadow-lg font-medium"
                      placeholder="50 - 500 mg/dL"
                    />
                    {fieldErrors.bloodGlucoseLevel && <p className="text-red-500 text-xs mt-1 ml-1">{fieldErrors.bloodGlucoseLevel}</p>}
                  </div>
                </div>
              </Card>

              <div className="pt-6 animate-fade-in-up delay-400">
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full overflow-hidden bg-white hover:bg-linear-to-r hover:from-indigo-50 hover:to-purple-50 text-indigo-600 py-5 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-[0_20px_60px_-15px_rgba(99,102,241,0.5)]  active:translate-y-0 active:scale-100 transition-all duration-500 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100 flex justify-center items-center gap-3 cursor-pointer "
                >
                  {/* Animated gradient background on hover */}
                  <div className="absolute inset-0 bg-linear-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Shine effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-linear-to-r from-transparent via-white/40 to-transparent"></div>

                  {loading ? (
                    <>
                      <svg className="animate-spin h-7 w-7 text-indigo-600 relative z-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="relative z-10">Analyzing Health Data...</span>
                    </>
                  ) : (
                    <>
                      <span className="relative z-10">Predict Health Risk</span>
                      <svg className="relative z-10 w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>

            {error && (
              <div className="group mt-8 p-6 bg-red-50/95 dark:bg-red-900/40 backdrop-blur-xl border-2 border-red-200/60 dark:border-red-800/60 text-red-700 dark:text-red-300 rounded-2xl text-center animate-fade-in shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-bold text-lg">Error</span>
                </div>
                <p className="font-medium">{error}</p>
              </div>
            )}

            {result && (() => {
              const hue = Math.max(0, 120 - (result.probability * 1.2));
              const colorBase = `hsl(${hue}, 100%, 50%)`;
              const colorBorder = `hsl(${hue}, 85%, 45%)`;
              const colorBg = `hsl(${hue}, 90%, 60%)`;
              const colorText = `hsl(${hue}, 90%, 35%)`;
              const colorTextDark = `hsl(${hue}, 90%, 60%)`;

              return (
              <div className="mt-10 animate-fade-in-up">
                <Card 
                  className="relative overflow-hidden border-l-[6px]"
                  style={{
                    borderColor: colorBorder,
                    boxShadow: `0 0 40px -10px ${colorBase}66`
                  }}
                >
                  {/* Animated glow effect */}
                  <div 
                    className="absolute inset-0 opacity-20 blur-2xl"
                    style={{ backgroundColor: colorBg }}
                  ></div>

                  <div className="relative z-10 flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 gap-6">
                    <div>
                      <h2 className="text-3xl md:text-4xl font-extrabold bg-linear-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-200 bg-clip-text text-transparent tracking-tight mb-2 text-center md:text-left">Prediction Result</h2>
                      <p className="text-gray-600 dark:text-gray-400 mt-2 font-medium text-sm md:text-base text-center md:text-left">Based on your provided health metrics</p>
                    </div>
                    <div 
                      className="text-center bg-linear-to-br backdrop-blur-sm px-6 py-4 md:px-8 md:py-5 rounded-2xl shadow-xl border-2 w-full md:w-auto"
                      style={{
                        borderColor: `${colorBorder}40`,
                        background: `linear-gradient(to bottom right, ${colorBase}15, ${colorBase}25)`
                      }}
                    >
                      <div 
                        className="text-4xl md:text-5xl font-extrabold mb-2 transition-colors duration-300"
                        style={{ color: isDarkTheme ? colorTextDark : colorText }}
                      >
                        {result.prediction}
                      </div>
                      <div className="text-xs md:text-sm font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">
                        {result.probability.toFixed(1)}% Probability
                      </div>
                    </div>
                  </div>

                  <div className="relative bg-linear-to-br from-indigo-50/80 via-purple-50/80 to-pink-50/80 dark:from-indigo-900/30 dark:via-purple-900/30 dark:to-pink-900/30 backdrop-blur-sm rounded-3xl p-5 md:p-8 border border-indigo-200/40 dark:border-indigo-700/40 shadow-inner">
                    <h3 className="font-extrabold text-xl md:text-2xl bg-linear-to-r from-indigo-700 to-purple-700 dark:from-indigo-300 dark:to-purple-300 bg-clip-text text-transparent mb-6 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-purple-500 text-white shadow-lg shrink-0">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </span>
                      Health Recommendations
                    </h3>
                    <div className="space-y-4">
                      {result.advice.suggestions.suggestions.map((suggestion, index) => (
                        <div key={index} className="group bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-5 rounded-2xl shadow-md border-2 border-gray-100/50 dark:border-gray-700/50 hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                              {suggestion.title}
                            </h4>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              suggestion.priority === 'High' 
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' 
                                : suggestion.priority === 'Medium'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            }`}>
                              {suggestion.priority} Priority
                            </span>
                          </div>
                          
                          <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 italic">
                            "{suggestion.rationale}"
                          </p>

                          <div className="space-y-3">
                            <div>
                              <h5 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Actionable Steps</h5>
                              <ul className="space-y-2">
                                {suggestion.actionable_steps.map((step, stepIndex) => (
                                  <li key={stepIndex} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                                    <svg className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4" />
                                    </svg>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                              <div>
                                <h5 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Goal</h5>
                                <p className="text-sm text-gray-700 dark:text-gray-200">{suggestion.measurable_goal}</p>
                              </div>
                              <div>
                                <h5 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Timeline</h5>
                                <p className="text-sm text-gray-700 dark:text-gray-200">{suggestion.estimated_timeframe}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {result.advice.suggestions.note && (
                        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-xl">
                          <div className="flex gap-3">
                            <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                              {result.advice.suggestions.note}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
                <div className="mt-8 p-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl">
                  <p className="text-center text-sm text-indigo-100 font-medium">
                    <svg className="inline w-5 h-5 mr-2 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Disclaimer: This is an AI-powered prediction tool and should not replace professional medical diagnosis.
                  </p>
                </div>
              </div>
              );
            })()}
          </div>

          {/* Info Sidebar */}
          <div className="space-y-6 animate-fade-in-right delay-500">
            <div className="sticky top-8 space-y-6">
              <h3 className="text-2xl font-extrabold text-white mb-6 pl-2 flex items-center gap-3 drop-shadow-lg">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md border border-white/30 shadow-lg">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="bg-clip-text text-shadow-transparent bg-linear-to-r from-white to-indigo-100 ">Information</span>
              </h3>
              <FieldInfoCard 
                title="Hemoglobin A1c  Level" 
                info="Hemoglobin A1c (HbA1c) test measures your average blood sugar level over the past two to three months by checking the percentage of your red blood cells that are coated with glucose. Normal is below 5.7%."
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                }
              />
              <FieldInfoCard 
                title="BMI (Body Mass Index)" 
                info="Body Mass Index (BMI) is a simple numerical value that uses a person's weight and height to estimate whether they are at a healthy weight. 18.5-24.9 is considered healthy."
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                }
              />
              <FieldInfoCard 
                title="Blood Glucose" 
                info="Blood glucose is the main sugar found in your blood and is the body's primary source of energy. It comes from the food you eat, which is broken down into glucose and released into your bloodstream. Fasting levels should be under 100 mg/dL."
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
              />
              <FieldInfoCard 
                title="Hypertension" 
                info="Hypertension (High Blood Pressure): Have you ever been clinically diagnosed with high blood pressure? Select if Yes ."
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



