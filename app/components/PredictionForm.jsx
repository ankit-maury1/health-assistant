
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export default function PredictionForm() {
  const { data: session, status } = useSession();
  const [form, setForm] = useState({
    age: "",
    bmi: "",
    systolicBP: "",
    diastolicBP: "",
    bloodGlucose: "",
    cholesterol: "",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    async function loadProfile() {
      try {
        const res = await fetch("/api/user/profile");

        if (!res.ok) {
          if (res.status === 401 || res.status === 404) {
            return;
          }
          throw new Error("Failed to load profile");
        }

        const data = await res.json();
        if (data.healthData) {
          setForm((prev) => ({
            ...prev,
            age: data.healthData.age ?? prev.age,
            bmi: data.healthData.bmi ?? prev.bmi,
            systolicBP: data.healthData.systolicBP ?? prev.systolicBP,
            diastolicBP: data.healthData.diastolicBP ?? prev.diastolicBP,
          }));
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    }

    loadProfile();
  }, [status]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  async function handlePredict(e) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const payload = {
      age: normalizeNumber(form.age),
      bmi: normalizeNumber(form.bmi),
      systolicBP: normalizeNumber(form.systolicBP),
      diastolicBP: normalizeNumber(form.diastolicBP),
      bloodGlucose: normalizeNumber(form.bloodGlucose),
      cholesterol: normalizeNumber(form.cholesterol),
    };

    try {
      const res = await fetch("http://localhost:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("FastAPI request failed");
      }

      const data = await res.json();
      const riskScore = data.riskScore ?? data.prediction ?? null;
      const riskLevel = data.riskLevel ?? (riskScore >= 70 ? "high" : riskScore >= 40 ? "moderate" : "low");

      setResult({ riskScore, riskLevel, raw: data });

      if (status === "authenticated") {
        await fetch("/api/predictions/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputMetrics: payload,
            riskScore,
            riskLevel,
            date: new Date().toISOString(),
          }),
        });
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Heart Disease & Diabetes Prediction</h2>

      {status === "loading" && <p>Checking session...</p>}
      {status === "unauthenticated" && (<p className="text-sm text-slate-500 mb-4">Guest mode: data won’t be saved in your account.</p>)}

      <form onSubmit={handlePredict} className="space-y-4">
        {[
          ["age", "Age"],
          ["bmi", "BMI"],
          ["systolicBP", "Systolic BP"],
          ["diastolicBP", "Diastolic BP"],
          ["bloodGlucose", "Blood Glucose"],
          ["cholesterol", "Cholesterol"],
        ].map(([name, label]) => (
          <div key={name}>
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <input
              type="number"
              name={name}
              value={form[name]}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              min="0"
              step="any"
            />
          </div>
        ))}

        <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">Predict</button>

        {error && <p className="text-red-500">{error}</p>}

        {result && (
          <div className="mt-4 p-4 border rounded bg-gray-50">
            <h3 className="font-semibold">Prediction Result</h3>
            <p>Risk Score: {result.riskScore}</p>
            <p>Risk Level: {result.riskLevel}</p>
            <pre className="text-xs mt-2">{JSON.stringify(result.raw, null, 2)}</pre>
          </div>
        )}
      </form>
    </div>
  );
}
