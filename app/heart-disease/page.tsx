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
  precautions: string;
  resources: string[];
  estimated_timeframe: string;
}

interface PredictionResult {
  prediction: string;
  probability: number;
  advice: {
    risk_level: string;
    score: number;
    error?: string;
    suggestions: {
      suggestions: Suggestion[];
      note: string;
    } | null;
  };
}

export default function HeartDisease() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [formData, setFormData] = useState({
    age: "",
    sex: "",
    chest_pain_type: "",
    resting_bp: "",
    cholesterol: "",
    fasting_blood_sugar: "",
    resting_ecg: "",
    max_heart_rate: "",
    exercise_angina: "",
    oldpeak: "",
    st_slope: "",
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

  // Auto-calculate Max Heart Rate function
  const calculateMaxHeartRate = () => {
    if (formData.age) {
      const age = parseInt(formData.age);
      if (age > 0) {
        const calculatedMaxHeartRate = 220 - age;
        setFormData((prev) => ({ ...prev, max_heart_rate: calculatedMaxHeartRate.toString() }));
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const payload = {
        age: parseInt(formData.age),
        sex: parseInt(formData.sex),
        chest_pain_type: parseInt(formData.chest_pain_type),
        resting_bp: parseInt(formData.resting_bp),
        cholesterol: parseInt(formData.cholesterol),
        fasting_blood_sugar: parseInt(formData.fasting_blood_sugar),
        resting_ecg: parseInt(formData.resting_ecg),
        max_heart_rate: parseInt(formData.max_heart_rate),
        exercise_angina: parseInt(formData.exercise_angina),
        oldpeak: parseFloat(formData.oldpeak),
        st_slope: parseInt(formData.st_slope),
      };

      const response = await fetch("/api/heart-disease", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error("Prediction error:", err);
      setError(err.message || "An error occurred while processing your request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string | number } }) => {
    const target = e.target;
    const name = target.name;
    const value = target.value;
    
    if ('getAttribute' in target) {
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
      [name]: value,
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
        {!isBackendReady && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 animate-fade-in-down">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Prediction service is currently offline. Please try again later.</span>
          </div>
        )}
        <div className="text-center mb-12 animate-fade-in-down">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-white/10 backdrop-blur-xl border border-white/20">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="text-sm font-semibold text-white/90">AI Health Assessment</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-4 tracking-tight drop-shadow-2xl">
            Heart Disease Risk <span className="text-transparent bg-clip-text bg-linear-to-r from-red-200 via-pink-200 to-rose-200 animate-gradient">Prediction</span>
          </h1>
          <p className="text-indigo-100 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">Advanced AI-powered cardiovascular health analysis for early detection.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form Area */}
          <div className="lg:col-span-2 space-y-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              <Card title="Personal Information" description="Basic demographic and physical details" className="animate-fade-in-up delay-100 z-40">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 transition-colors group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">Age</label>
                    <input
                      type="number"
                      name="age"
                      required
                      min="0"
                      max="120"
                      value={formData.age}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-300/50 dark:border-gray-600/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-300 outline-none shadow-lg font-medium"
                      placeholder="Enter your age"
                    />
                    {fieldErrors.age && <p className="text-red-500 text-xs mt-1 ml-1">{fieldErrors.age}</p>}
                  </div>

                  <CustomSelect
                    label="Gender"
                    name="sex"
                    value={formData.sex}
                    onChange={handleChange}
                    placeholder="Select Gender"
                    required
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
                </div>
              </Card>

              <Card title="Cardiac Symptoms" description="Chest pain and exercise-related symptoms" className="animate-fade-in-up delay-200 z-30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <CustomSelect
                    label="Chest Pain Severity"
                    name="chest_pain_type"
                    value={formData.chest_pain_type}
                    onChange={handleChange}
                    placeholder="Select Type"
                    required
                    icon={
                      <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    }
                    options={[
                      { label: "Severe Chest Pain (Typical Angina)", value: "0" },
                      { label: "Moderate Chest Pain (Atypical Angina)", value: "1" },
                      { label: "Mild/Unrelated Pain (Non-Anginal)", value: "2" },
                      { label: "No Pain (Asymptomatic)", value: "3" }
                    ]}
                  />

                  <CustomSelect
                    label="Do you feel chest pain when you exercise?"
                    name="exercise_angina"
                    value={formData.exercise_angina}
                    onChange={handleChange}
                    placeholder="Select Status"
                    required
                    icon={
                      <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    }
                    options={[
                      { label: "No", value: "0" },
                      { label: "Yes", value: "1" }
                    ]}
                  />
                </div>
              </Card>

              <Card title="Vital Signs & Lab Results" description="Blood pressure, cholesterol, and heart rate measurements" className="animate-fade-in-up delay-300 z-20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 transition-colors group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">Resting Blood Pressure (Top Number)</label>
                    <input
                      type="number"
                      name="resting_bp"
                      required
                      min="80"
                      max="200"
                      value={formData.resting_bp}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-300/50 dark:border-gray-600/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-300 outline-none shadow-lg font-medium"
                      placeholder="e.g., 120 mmHg"
                    />
                    {fieldErrors.resting_bp && <p className="text-red-500 text-xs mt-1 ml-1">{fieldErrors.resting_bp}</p>}
                  </div>

                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 transition-colors group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">Cholesterol Level (mg/dL)</label>
                    <input
                      type="number"
                      name="cholesterol"
                      required
                      min="50"
                      max="600"
                      value={formData.cholesterol}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-300/50 dark:border-gray-600/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-300 outline-none shadow-lg font-medium"
                      placeholder="e.g., 200 mg/dL"
                    />
                    {fieldErrors.cholesterol && <p className="text-red-500 text-xs mt-1 ml-1">{fieldErrors.cholesterol}</p>}
                  </div>

                  <CustomSelect
                    label="Fasting Blood Sugar Status"
                    name="fasting_blood_sugar"
                    value={formData.fasting_blood_sugar}
                    onChange={handleChange}
                    placeholder="Select Status"
                    required
                    icon={
                      <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    }
                    options={[
                      { label: "Normal (≤ 120 mg/dL)", value: "0" },
                      { label: "High (> 120 mg/dL)", value: "1" }
                    ]}
                  />

                  <div className="group">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 transition-colors group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">Maximum Heart Rate</label>
                      <button
                        type="button"
                        onClick={calculateMaxHeartRate}
                        className="text-xs px-3 py-1 rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-900 transition-colors font-medium cursor-pointer"
                        title="Calculate based on age (220 - age)"
                      >
                        Auto-calculate
                      </button>
                    </div>
                    <input
                      type="number"
                      name="max_heart_rate"
                      required
                      min="60"
                      max="220"
                      value={formData.max_heart_rate}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-300/50 dark:border-gray-600/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-300 outline-none shadow-lg font-medium"
                      placeholder="e.g., 150"
                    />
                    {fieldErrors.max_heart_rate && <p className="text-red-500 text-xs mt-1 ml-1">{fieldErrors.max_heart_rate}</p>}
                  </div>
                </div>
              </Card>

              <Card title="ECG & Cardiac Function" description="Electrocardiogram results and ST segment analysis" className="animate-fade-in-up delay-400 z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <CustomSelect
                    label="Resting Heart Test Results (ECG)"
                    name="resting_ecg"
                    value={formData.resting_ecg}
                    onChange={handleChange}
                    placeholder="Select ECG Result"
                    required
                    icon={
                      <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    }
                    options={[
                      { label: "Normal", value: "0" },
                      { label: "Abnormal Heart Wave (ST-T Wave Abnormality)", value: "1" },
                      { label: "Thickened Heart Muscle (LVH)", value: "2" }
                    ]}
                  />

                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 transition-colors group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">Exercise Stress Level (ST Depression)</label>
                    <input
                      type="number"
                      name="oldpeak"
                      step="0.1"
                      required
                      min="0"
                      max="10"
                      value={formData.oldpeak}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-300/50 dark:border-gray-600/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-300 outline-none shadow-lg font-medium"
                      placeholder="e.g., 1.0"
                    />
                    {fieldErrors.oldpeak && <p className="text-red-500 text-xs mt-1 ml-1">{fieldErrors.oldpeak}</p>}
                  </div>

                  <CustomSelect
                    label="Heart Rate Recovery Pattern (ST Slope)"
                    name="st_slope"
                    value={formData.st_slope}
                    onChange={handleChange}
                    placeholder="Select Slope Type"
                    required
                    icon={
                      <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    }
                    options={[
                      { label: "Better Heart Response (Upsloping)", value: "0" },
                      { label: "Average Heart Response (Flat)", value: "1" },
                      { label: "Poor Heart Response (Downsloping)", value: "2" }
                    ]}
                  />
                </div>
              </Card>

              <div className="pt-6 animate-fade-in-up delay-500">
                <button
                  type="submit"
                  disabled={loading || !isBackendReady}
                  className="group relative w-full overflow-hidden bg-white hover:bg-linear-to-r hover:from-red-50 hover:to-pink-50 text-red-600 py-5 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-[0_20px_60px_-15px_rgba(239,68,68,0.5)] active:translate-y-0 active:scale-100 transition-all duration-500 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100 flex justify-center items-center gap-3 cursor-pointer"
                >
                  {/* Animated gradient background on hover */}
                  <div className="absolute inset-0 bg-linear-to-r from-red-500/10 via-pink-500/10 to-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Shine effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-linear-to-r from-transparent via-white/40 to-transparent"></div>

                  {loading ? (
                    <>
                      <svg className="animate-spin h-7 w-7 text-red-600 relative z-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="relative z-10">Analyzing Cardiovascular Health...</span>
                    </>
                  ) : (
                    <>
                      <span className="relative z-10">Predict Heart Disease Risk</span>
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
                      <p className="text-gray-600 dark:text-gray-400 mt-2 font-medium text-sm md:text-base text-center md:text-left">Based on your cardiovascular health metrics</p>
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

                  <div className="relative bg-linear-to-br from-red-50/80 via-pink-50/80 to-rose-50/80 dark:from-red-900/30 dark:via-pink-900/30 dark:to-rose-900/30 backdrop-blur-sm rounded-3xl p-5 md:p-8 border border-red-200/40 dark:border-red-700/40 shadow-inner">
                    <h3 className="font-extrabold text-xl md:text-2xl bg-linear-to-r from-red-700 to-pink-700 dark:from-red-300 dark:to-pink-300 bg-clip-text text-transparent mb-6 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-red-500 to-pink-500 text-white shadow-lg shrink-0">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </span>
                      Cardiovascular Health Recommendations
                    </h3>
                    <div className="space-y-6">
                      {result.advice.error ? (
                        <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-800/30 text-center">
                          <svg className="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <h4 className="text-lg font-bold text-red-800 dark:text-red-200 mb-2">Recommendation Service Unavailable</h4>
                          <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                            We couldn't generate personalized health advice at this moment.
                          </p>
                          <div className="text-xs text-red-500/70 dark:text-red-400/50 font-mono bg-red-100/50 dark:bg-red-900/30 p-2 rounded-lg overflow-x-auto">
                            {result.advice.error}
                          </div>
                        </div>
                      ) : (
                        <>
                          {result.advice.suggestions?.suggestions?.map((suggestion, index) => (
                            <div key={index} className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-6 rounded-2xl shadow-md border-2 border-gray-100/50 dark:border-gray-700/50 hover:shadow-xl hover:border-red-300 dark:hover:border-red-600 transition-all duration-300">
                              <div className="flex justify-between items-start mb-4">
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">{suggestion.title}</h4>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  suggestion.priority === 'High' 
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' 
                                    : suggestion.priority === 'Medium'
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                }`}>
                                  {suggestion.priority} Priority
                                </span>
                              </div>
                              
                              <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">{suggestion.rationale}</p>
                              
                              <div className="space-y-4">
                                <div>
                                  <h5 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">Actionable Steps:</h5>
                                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">
                                    {suggestion.actionable_steps.map((step, idx) => (
                                      <li key={idx}>{step}</li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                  <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                                    <span className="font-semibold text-gray-900 dark:text-white block mb-1">Goal:</span>
                                    <span className="text-gray-600 dark:text-gray-300">{suggestion.measurable_goal}</span>
                                  </div>
                                  <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                                    <span className="font-semibold text-gray-900 dark:text-white block mb-1">Timeframe:</span>
                                    <span className="text-gray-600 dark:text-gray-300">{suggestion.estimated_timeframe}</span>
                                  </div>
                                </div>

                                <div className="text-sm">
                                  <span className="font-semibold text-red-600 dark:text-red-400">Precautions: </span>
                                  <span className="text-gray-600 dark:text-gray-300">{suggestion.precautions}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {result.advice.suggestions?.note && (
                            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-xl">
                              <p className="text-sm text-yellow-800 dark:text-yellow-200 italic">
                                <span className="font-bold not-italic">Note: </span>
                                {result.advice.suggestions.note}
                              </p>
                            </div>
                          )}
                        </>
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
          <div className="space-y-6 animate-fade-in-right delay-600">
            <div className="sticky top-8 space-y-6">
              <h3 className="text-2xl font-extrabold text-white mb-6 pl-2 flex items-center gap-3 drop-shadow-lg">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md border border-white/30 shadow-lg">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="bg-clip-text text-shadow-transparent bg-linear-to-r from-white to-red-100">Medical Terms</span>
              </h3>
              <FieldInfoCard 
                title="Chest Pain Categories" 
                info="Different types of chest pain indicate different risk levels. 'Typical Angina' is strong heart-related pain, while 'Non-Anginal' pain is usually not related to the heart."
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                }
              />
              <FieldInfoCard 
                title="Pain During Exercise" 
                info="If you feel chest pain or tightness while exercising, it might mean your heart isn't getting enough oxygen when it works hard."
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
              />
              <FieldInfoCard 
                title="Blood Pressure" 
                info="This measures the pressure in your arteries when your heart beats. High pressure puts extra strain on your heart. A normal reading is around 120."
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <FieldInfoCard 
                title="Cholesterol Levels" 
                info="Cholesterol is a fat-like substance in your blood. Too much of it can build up in your arteries and block blood flow. Normal is usually below 200."
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                }
              />
              <FieldInfoCard 
                title="Blood Sugar" 
                info="The amount of sugar in your blood after not eating for a while. High levels (over 120) can be a sign of diabetes, which hurts your heart."
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                }
              />
              <FieldInfoCard 
                title="Heart Rhythm Test (ECG)" 
                info="A test that checks your heart's electrical activity. It can find irregular heartbeats or signs that your heart muscle is thickened or strained."
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              />
              <FieldInfoCard 
                title="Stress Test Result (ST Depression)" 
                info="This number shows how much your heart struggles during exercise compared to rest. A higher number usually means your heart is working harder than it should to pump blood."
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
              />
              <FieldInfoCard 
                title="Heart Recovery Pattern" 
                info="This describes how quickly your heart recovers after peak exercise. An 'Upsloping' pattern is generally healthy, while 'Flat' or 'Downsloping' can be a warning sign."
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
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
