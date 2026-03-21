"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { Card } from "@/components/ui/Card";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [history, setHistory] = useState([]);
  const [baseline, setBaseline] = useState(null);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chartVisible, setChartVisible] = useState(false);
  const listRef = useRef(null);
  const isFetchingRef = useRef(false);

  const fetchHistory = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        "/api/predictions/history?view=dashboard&windowDays=30&limit=1000",
      );

      if (!res.ok) {
        if (res.status === 401 || res.status === 404) {
          setHistory([]);
          setBaseline(null);
          return;
        }
        throw new Error("Failed to load history");
      }

      const data = await res.json();
      setHistory(data.history || []);
      setBaseline(data.baseline || null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status !== "authenticated") {
      return;
    }

    fetchHistory(0, true);
  }, [status, fetchHistory, router]);

  const getNormalizedCondition = (item) => {
    const rawCondition = (item.condition || item.result?.condition || "")
      .toString()
      .toLowerCase();

    if (rawCondition === "heart-disease" || rawCondition === "heart disease") {
      return "heart-disease";
    }

    if (rawCondition === "diabetes") {
      return "diabetes";
    }

    return "unknown";
  };

  const getRiskScore = (item) =>
    item.riskScore ??
    item.result?.probability ??
    item.result?.advice?.score ??
    null;

  const chartData = React.useMemo(() => {
    return history
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((item) => {
        const condition = getNormalizedCondition(item);
        const score = getRiskScore(item);
        const dateValue = new Date(item.date);
        if (Number.isNaN(dateValue.getTime())) return null;
        if (!Number.isFinite(Number(score))) return null;

        if (condition === "heart-disease") {
          return {
            date: dateValue.toISOString(),
            diabetes: null,
            heartDisease: Number(score),
            label: item.result?.prediction || "Heart Disease",
          };
        }

        if (condition === "diabetes") {
          return {
            date: dateValue.toISOString(),
            diabetes: Number(score),
            heartDisease: null,
            label: item.result?.prediction || "Diabetes",
          };
        }

        return null;
      })
      .filter(Boolean);
  }, [history]);

  useEffect(() => {
    if (!isLoading && chartData.length > 0) {
      const timeout = setTimeout(() => setChartVisible(true), 150);
      return () => clearTimeout(timeout);
    }
    setChartVisible(false);
  }, [isLoading, chartData.length]);

  const getRiskLevel = (item) =>
    item.riskLevel ??
    item.result?.advice?.risk_level ??
    item.result?.riskLevel ??
    null;

  const getSuggestions = (item) => {
    const source = item.result?.advice?.suggestions;
    if (Array.isArray(source)) return source;
    if (Array.isArray(source?.suggestions)) return source.suggestions;
    return [];
  };

  const getAdviceNote = (item) =>
    item.result?.advice?.note ?? item.result?.advice?.suggestions?.note ?? null;

  const headerContent = React.useMemo(() => {
    return (
      <div className="mb-8 text-center px-5 py-6 rounded-2xl border border-white/25 shadow-xl backdrop-blur-sm
        bg-gradient-to-r from-[var(--gradient-start)] via-[var(--gradient-mid)] to-[var(--gradient-end)] bg-opacity-30 dark:from-[var(--gradient-start)] dark:via-[var(--gradient-mid)] dark:to-[var(--gradient-end)] dark:bg-opacity-40">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
          Health Risk Trend Overview
        </h1>
        <p className="text-white/90 text-base sm:text-lg max-w-3xl mx-auto">
          Clear chart, risk trends, and history in one place—tap a row to expand details. Dark mode and light mode are both supported for easy reading.
        </p>
      </div>
    );
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 py-12 px-4 sm:px-6 lg:px-8 dark:from-indigo-950 dark:via-purple-950 dark:to-pink-950">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl animate-float delay-300" />
        <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-indigo-400/15 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {headerContent}

        {status !== "authenticated" && (
          <Card
            className="mb-6"
            title="Access Required"
            description="Please sign in to view your personalized dashboard."
          >
            <p className="text-sm text-slate-700 dark:text-slate-300">
              You need to be authenticated to inspect prediction history.
              <span className="block mt-3">
                <a
                  href="/auth/signin"
                  className="text-indigo-600 dark:text-indigo-300 hover:underline"
                >
                  Sign in
                </a>{" "}
                or{" "}
                <a
                  href="/auth/signup"
                  className="text-indigo-600 dark:text-indigo-300 hover:underline"
                >
                  Create account
                </a>{" "}
                to continue.
              </span>
            </p>
          </Card>
        )}

        {status === "authenticated" && (
          <Card
            title="Risk Score History"
            description="Your latest model output over time."
            className="mb-6"
          >
            {error && <p className="text-red-500">{error}</p>}
            {chartData.length === 0 ? (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                No predictions yet. Visit diabetes or heart disease forms to
                create your first analysis.
              </p>
            ) : (
              <div>
                <div className={`transition-all duration-700 ease-out ${chartVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                  <div className="h-88 sm:h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 14, right: 18, left: 8, bottom: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          strokeOpacity={0.35}
                        />
                        <XAxis dataKey="date" tick={{ fill: "#334155" }} />
                        <YAxis tick={{ fill: "#334155" }} />
                        <Tooltip />
                        <Line
                          name="Diabetes"
                          type="monotone"
                          dataKey="diabetes"
                          stroke="#2563EB"
                          strokeWidth={2}
                          dot={{ r: 5, strokeWidth: 2 }}
                          activeDot={{ r: 7 }}
                          isAnimationActive={true}
                          animationDuration={1400}
                          animationEasing="ease-out"
                        >
                          <LabelList
                            dataKey="diabetes"
                            position="top"
                            fill="#2563EB"
                            fontSize={12}
                          />
                        </Line>
                        <Line
                          name="Heart Disease"
                          type="monotone"
                          dataKey="heartDisease"
                          stroke="#EF4444"
                          strokeWidth={2}
                          dot={{ r: 5, strokeWidth: 2 }}
                          activeDot={{ r: 7 }}
                          isAnimationActive={true}
                          animationDuration={1400}
                          animationEasing="ease-out"
                        >
                          <LabelList
                            dataKey="heartDisease"
                            position="top"
                            fill="#EF4444"
                            fontSize={12}
                          />
                        </Line>
                        <Legend />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-6 bg-slate-50/80 dark:bg-slate-900/70 p-4 rounded-xl">
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
                    Prediction History
                  </h2>
                  {history.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      No historical prediction records found.
                    </p>
                  ) : (
                    <div ref={listRef} className="max-h-[54vh] overflow-y-auto">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm">
                          <thead className="bg-slate-100 dark:bg-slate-900">
                            <tr>
                              <th className="px-3 py-2">Timestamp</th>
                              <th className="px-3 py-2">Condition</th>
                              <th className="px-3 py-2">Risk Score</th>
                              <th className="px-3 py-2">Risk Level</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {history.map((item) => {
                              const rawCondition = getNormalizedCondition(item);
                              const normalizedCondition =
                                rawCondition === "heart-disease"
                                  ? "Heart Disease"
                                  : rawCondition === "diabetes"
                                    ? "Diabetes"
                                    : "Unknown";
                              const isDiabetes =
                                normalizedCondition === "Diabetes";
                              const isHeart =
                                normalizedCondition === "Heart Disease";
                              const riskScore = getRiskScore(item) ?? "N/A";
                              const riskLevel = getRiskLevel(item) ?? "N/A";
                              const suggestions = getSuggestions(item);
                              const adviceNote = getAdviceNote(item);
                              const isExpanded =
                                expandedId === (item._id || item.date);

                              return (
                                <React.Fragment key={item._id || item.date}>
                                  <tr
                                    className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                                    onClick={() =>
                                      setExpandedId(
                                        isExpanded
                                          ? null
                                          : item._id || item.date,
                                      )
                                    }
                                  >
                                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                      {new Date(item.date).toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={`px-2 py-1 rounded text-xs font-semibold ${isDiabetes ? "text-blue-700 bg-blue-100 dark:bg-blue-900/60 dark:text-blue-200" : isHeart ? "text-red-700 bg-red-100 dark:bg-red-900/60 dark:text-red-200" : "text-gray-700 bg-gray-100 dark:bg-gray-800/60 dark:text-gray-200"}`}
                                      >
                                        {normalizedCondition}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                                      {riskScore}
                                    </td>
                                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                                      {riskLevel}
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr
                                      key={`details-${item._id || item.date}`}
                                      className="bg-slate-50 dark:bg-slate-900"
                                    >
                                      <td
                                        colSpan={4}
                                        className="px-3 py-2 text-slate-700 dark:text-slate-300"
                                      >
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                          <div>
                                            <p className="font-semibold">
                                              Input Metrics
                                            </p>
                                            <pre className="bg-slate-100 dark:bg-slate-800 p-2 rounded text-xs overflow-auto">
                                              {JSON.stringify(
                                                item.inputMetrics || {},
                                                null,
                                                2,
                                              )}
                                            </pre>
                                          </div>
                                          <div>
                                            <p className="font-semibold">
                                              Model Result
                                            </p>
                                            <p>
                                              <span className="font-semibold">
                                                Prediction:
                                              </span>{" "}
                                              {item.result?.prediction || "N/A"}
                                            </p>
                                            <p>
                                              <span className="font-semibold">
                                                Probability:
                                              </span>{" "}
                                              {item.result?.probability ??
                                                "N/A"}
                                            </p>
                                            <p>
                                              <span className="font-semibold">
                                                Advice Level:
                                              </span>{" "}
                                              {riskLevel}
                                            </p>
                                            <p className="font-semibold mt-2">
                                              Suggestions:
                                            </p>
                                            {suggestions.length > 0 ? (
                                              <ul className="list-disc list-inside text-xs space-y-1">
                                                {suggestions.map(
                                                  (suggestion, idx) => (
                                                    <li key={idx}>
                                                      <span className="font-semibold">
                                                        {suggestion.title ||
                                                          "Plan"}
                                                        :
                                                      </span>{" "}
                                                      {suggestion.rationale ||
                                                        suggestion.measurable_goal ||
                                                        "No details provided."}
                                                    </li>
                                                  ),
                                                )}
                                              </ul>
                                            ) : (
                                              <p>N/A</p>
                                            )}
                                            {adviceNote && (
                                              <p className="text-xs mt-2 whitespace-pre-line">
                                                <span className="font-semibold">
                                                  Note:
                                                </span>{" "}
                                                {adviceNote}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                          Click the row to collapse.
                                        </p>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className="mt-3 text-center">
                          {isLoading ? (
                            <p className="text-sm text-slate-500">
                              Loading last 30 days of history...
                            </p>
                          ) : (
                            <p className="text-sm text-slate-500">
                              Showing {history.length} records from the last 30
                              days.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
