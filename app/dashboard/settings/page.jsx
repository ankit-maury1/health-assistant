"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/Card";

export default function DashboardSettings() {
  const { status } = useSession();
  const [healthData, setHealthData] = useState({
    age: "",
    bmi: "",
    systolicBP: "",
    diastolicBP: "",
    gender: "",
    height: "",
    weight: "",
    hypertension: "",
    heartDisease: "",
    smokingHistory: "",
    hbA1cLevel: "",
    bloodGlucoseLevel: "",
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
  const [message, setMessage] = useState(null);

  const inputClassName =
    "w-full px-4 py-2.5 rounded-xl border-2 border-gray-300/50 dark:border-gray-600/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-300 outline-none shadow-sm font-medium";

  const sectionTitleClass =
    "px-4 py-3 bg-gray-100/90 dark:bg-gray-800/70 text-gray-800 dark:text-gray-100 font-semibold text-sm tracking-wide uppercase";

  const rowLabelClass =
    "px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white/70 dark:bg-gray-900/40 align-middle";

  const rowFieldClass = "px-4 py-3 bg-white/70 dark:bg-gray-900/30";

  const parseOptionalNumber = (value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  };

  useEffect(() => {
    if (status !== "authenticated") return;

    (async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) return;
        const data = await res.json();

        if (data.healthData) {
          setHealthData({
            age: data.healthData.age ?? "",
            bmi: data.healthData.bmi ?? "",
            systolicBP: data.healthData.systolicBP ?? "",
            diastolicBP: data.healthData.diastolicBP ?? "",
            gender: data.healthData.gender ?? "",
            height: data.healthData.height ?? "",
            weight: data.healthData.weight ?? "",
            hypertension:
              data.healthData.hypertension === null || data.healthData.hypertension === undefined
                ? ""
                : String(data.healthData.hypertension),
            heartDisease:
              data.healthData.heartDisease === null || data.healthData.heartDisease === undefined
                ? ""
                : String(data.healthData.heartDisease),
            smokingHistory: data.healthData.smokingHistory ?? "",
            hbA1cLevel: data.healthData.hbA1cLevel ?? "",
            bloodGlucoseLevel: data.healthData.bloodGlucoseLevel ?? "",
            sex: data.healthData.sex ?? "",
            chest_pain_type: data.healthData.chest_pain_type ?? "",
            resting_bp: data.healthData.resting_bp ?? "",
            cholesterol: data.healthData.cholesterol ?? "",
            fasting_blood_sugar: data.healthData.fasting_blood_sugar ?? "",
            resting_ecg: data.healthData.resting_ecg ?? "",
            max_heart_rate: data.healthData.max_heart_rate ?? "",
            exercise_angina: data.healthData.exercise_angina ?? "",
            oldpeak: data.healthData.oldpeak ?? "",
            st_slope: data.healthData.st_slope ?? "",
          });
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [status]);

  useEffect(() => {
    const height = Number(healthData.height);
    const weight = Number(healthData.weight);

    if (Number.isNaN(height) || Number.isNaN(weight) || height <= 0 || weight <= 0) {
      return;
    }

    const bmi = (weight / ((height / 100) * (height / 100))).toFixed(1);
    if (healthData.bmi !== bmi) {
      setHealthData((prev) => ({ ...prev, bmi }));
    }
  }, [healthData.height, healthData.weight, healthData.bmi]);

  const handleChange = (e) => {
    const target = e.target;
    const name = target.name;
    const value = target.value;
    setHealthData({ ...healthData, [name]: value });
  };

  const saveBaseline = async (e) => {
    e.preventDefault();
    setMessage(null);

    try {
      const cleanedBaseline = {
        age: parseOptionalNumber(healthData.age),
        bmi: parseOptionalNumber(healthData.bmi),
        systolicBP: parseOptionalNumber(healthData.systolicBP),
        diastolicBP: parseOptionalNumber(healthData.diastolicBP),
        gender: parseOptionalNumber(healthData.gender),
        height: parseOptionalNumber(healthData.height),
        weight: parseOptionalNumber(healthData.weight),
        hypertension: parseOptionalNumber(healthData.hypertension),
        heartDisease: parseOptionalNumber(healthData.heartDisease),
        smokingHistory: parseOptionalNumber(healthData.smokingHistory),
        hbA1cLevel: parseOptionalNumber(healthData.hbA1cLevel),
        bloodGlucoseLevel: parseOptionalNumber(healthData.bloodGlucoseLevel),
        sex: parseOptionalNumber(healthData.sex),
        chest_pain_type: parseOptionalNumber(healthData.chest_pain_type),
        resting_bp: parseOptionalNumber(healthData.resting_bp),
        cholesterol: parseOptionalNumber(healthData.cholesterol),
        fasting_blood_sugar: parseOptionalNumber(healthData.fasting_blood_sugar),
        resting_ecg: parseOptionalNumber(healthData.resting_ecg),
        max_heart_rate: parseOptionalNumber(healthData.max_heart_rate),
        exercise_angina: parseOptionalNumber(healthData.exercise_angina),
        oldpeak: parseOptionalNumber(healthData.oldpeak),
        st_slope: parseOptionalNumber(healthData.st_slope),
      };

      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ healthData: cleanedBaseline }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile");
      }

      setMessage("Baseline metrics saved successfully.");
    } catch (err) {
      setMessage(err.message);
    }
  };

  if (status !== "authenticated") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-950 dark:via-purple-950 dark:to-pink-950 py-10 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-10 right-4 w-80 h-80 bg-pink-400/20 rounded-full blur-3xl animate-float delay-200" />
        </div>

        <div className="relative z-10 max-w-md mx-auto py-20">
          <Card title="Sign In Required" description="Please sign in to manage your baseline health data.">
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Your settings are stored securely in your account. Sign in to continue.</p>
            <div className="flex flex-col gap-3">
              <a href="/auth/signin" className="w-full text-center py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">Sign in</a>
              <a href="/auth/signup" className="w-full text-center py-2 rounded-xl bg-white text-indigo-600 hover:bg-indigo-100">Create account</a>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 via-white to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Profile Baseline Settings</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Use the same baseline structure as Diabetes and Heart Disease forms. Leave any field empty to store null.</p>
        </div>

        <form className="space-y-6" onSubmit={saveBaseline}>
          <Card title="Combined Baseline Data" description="Consistent input types for diabetes and heart disease fields">
            <div className="overflow-x-auto rounded-2xl border border-gray-200/70 dark:border-gray-700/70 shadow-lg">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold tracking-wider text-gray-600 dark:text-gray-300 bg-gray-50/90 dark:bg-gray-800/80">Field</th>
                    <th className="px-4 py-3 text-left text-xs font-bold tracking-wider text-gray-600 dark:text-gray-300 bg-gray-50/90 dark:bg-gray-800/80">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={2} className={sectionTitleClass}>Diabetes Inputs</td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Gender</td>
                    <td className={rowFieldClass}>
                      <select name="gender" value={healthData.gender} onChange={handleChange} className={inputClassName}>
                        <option value="">Not set</option>
                        <option value="0">Female</option>
                        <option value="1">Male</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Age</td>
                    <td className={rowFieldClass}><input type="number" min="0" name="age" value={healthData.age} onChange={handleChange} className={inputClassName} placeholder="Enter age" /></td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Height (cm)</td>
                    <td className={rowFieldClass}><input type="number" min="90" name="height" value={healthData.height} onChange={handleChange} className={inputClassName} placeholder="in centimeters" /></td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Weight (kg)</td>
                    <td className={rowFieldClass}><input type="number" min="0" name="weight" value={healthData.weight} onChange={handleChange} className={inputClassName} placeholder="in kilograms" /></td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Smoking History</td>
                    <td className={rowFieldClass}>
                      <select name="smokingHistory" value={healthData.smokingHistory} onChange={handleChange} className={inputClassName}>
                        <option value="">Not set</option>
                        <option value="0">Never Smoked</option>
                        <option value="1">Former Smoker</option>
                        <option value="2">Current Smoker</option>
                        <option value="-1">Unknown</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Hypertension</td>
                    <td className={rowFieldClass}>
                      <select name="hypertension" value={healthData.hypertension} onChange={handleChange} className={inputClassName}>
                        <option value="">Not set</option>
                        <option value="0">No</option>
                        <option value="1">Yes</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Heart Disease</td>
                    <td className={rowFieldClass}>
                      <select name="heartDisease" value={healthData.heartDisease} onChange={handleChange} className={inputClassName}>
                        <option value="">Not set</option>
                        <option value="0">No</option>
                        <option value="1">Yes</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>BMI</td>
                    <td className={rowFieldClass}><input type="number" step="0.1" min="5" name="bmi" value={healthData.bmi} onChange={handleChange} readOnly className={inputClassName} placeholder="Auto-calculated from height and weight" /></td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Hemoglobin A1c Level</td>
                    <td className={rowFieldClass}><input type="number" step="0.1" min="3" max="15" name="hbA1cLevel" value={healthData.hbA1cLevel} onChange={handleChange} className={inputClassName} placeholder="3.0 - 15.0" /></td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Blood Glucose Level</td>
                    <td className={rowFieldClass}><input type="number" min="50" max="500" name="bloodGlucoseLevel" value={healthData.bloodGlucoseLevel} onChange={handleChange} className={inputClassName} placeholder="50 - 500 mg/dL" /></td>
                  </tr>

                  <tr>
                    <td colSpan={2} className={sectionTitleClass}>Heart Disease Inputs</td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Sex</td>
                    <td className={rowFieldClass}>
                      <select name="sex" value={healthData.sex} onChange={handleChange} className={inputClassName}>
                        <option value="">Not set</option>
                        <option value="0">Female</option>
                        <option value="1">Male</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Chest Pain Severity</td>
                    <td className={rowFieldClass}>
                      <select name="chest_pain_type" value={healthData.chest_pain_type} onChange={handleChange} className={inputClassName}>
                        <option value="">Not set</option>
                        <option value="0">Severe Chest Pain (Typical Angina)</option>
                        <option value="1">Moderate Chest Pain (Atypical Angina)</option>
                        <option value="2">Mild/Unrelated Pain (Non-Anginal)</option>
                        <option value="3">No Pain (Asymptomatic)</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Exercise Angina</td>
                    <td className={rowFieldClass}>
                      <select name="exercise_angina" value={healthData.exercise_angina} onChange={handleChange} className={inputClassName}>
                        <option value="">Not set</option>
                        <option value="0">No</option>
                        <option value="1">Yes</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Resting Blood Pressure</td>
                    <td className={rowFieldClass}><input type="number" min="80" max="200" name="resting_bp" value={healthData.resting_bp} onChange={handleChange} className={inputClassName} placeholder="e.g. 120 mmHg" /></td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Cholesterol (mg/dL)</td>
                    <td className={rowFieldClass}><input type="number" min="50" max="600" name="cholesterol" value={healthData.cholesterol} onChange={handleChange} className={inputClassName} placeholder="e.g. 200" /></td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Fasting Blood Sugar</td>
                    <td className={rowFieldClass}>
                      <select name="fasting_blood_sugar" value={healthData.fasting_blood_sugar} onChange={handleChange} className={inputClassName}>
                        <option value="">Not set</option>
                        <option value="0">Normal (≤ 120 mg/dL)</option>
                        <option value="1">High (&gt; 120 mg/dL)</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Resting ECG</td>
                    <td className={rowFieldClass}>
                      <select name="resting_ecg" value={healthData.resting_ecg} onChange={handleChange} className={inputClassName}>
                        <option value="">Not set</option>
                        <option value="0">Normal</option>
                        <option value="1">ST-T Wave Abnormality</option>
                        <option value="2">Left Ventricular Hypertrophy</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Maximum Heart Rate</td>
                    <td className={rowFieldClass}><input type="number" min="60" max="220" name="max_heart_rate" value={healthData.max_heart_rate} onChange={handleChange} className={inputClassName} placeholder="e.g. 150" /></td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>ST Depression (Oldpeak)</td>
                    <td className={rowFieldClass}><input type="number" step="0.1" min="0" max="10" name="oldpeak" value={healthData.oldpeak} onChange={handleChange} className={inputClassName} placeholder="e.g. 1.0" /></td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>ST Slope</td>
                    <td className={rowFieldClass}>
                      <select name="st_slope" value={healthData.st_slope} onChange={handleChange} className={inputClassName}>
                        <option value="">Not set</option>
                        <option value="0">Upsloping</option>
                        <option value="1">Flat</option>
                        <option value="2">Downsloping</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className={sectionTitleClass}>General Baseline Metrics</td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Systolic BP</td>
                    <td className={rowFieldClass}><input type="number" min="70" max="260" name="systolicBP" value={healthData.systolicBP} onChange={handleChange} className={inputClassName} placeholder="e.g. 120" /></td>
                  </tr>
                  <tr>
                    <td className={rowLabelClass}>Diastolic BP</td>
                    <td className={rowFieldClass}><input type="number" min="40" max="140" name="diastolicBP" value={healthData.diastolicBP} onChange={handleChange} className={inputClassName} placeholder="e.g. 80" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
            <button
              type="submit"
              className="group relative overflow-hidden bg-white hover:bg-linear-to-r hover:from-indigo-50 hover:to-pink-50 text-indigo-600 px-6 py-3 rounded-xl font-bold shadow-xl hover:shadow-[0_16px_40px_-14px_rgba(99,102,241,0.45)] transition-all duration-300"
            >
              Save Baseline
            </button>
            {message && <p className="text-sm text-gray-700 dark:text-gray-200">{message}</p>}
          </div>
        </form>
      </div>
    </div>
  );
}
