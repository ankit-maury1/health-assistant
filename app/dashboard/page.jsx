"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [history, setHistory] = useState([]);
  const [baseline, setBaseline] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status !== "authenticated") {
      return;
    }

    async function loadHistory() {
      try {
        const res = await fetch("/api/predictions/history");
        if (!res.ok) {
          throw new Error("Failed to load history");
        }

        const data = await res.json();
        setHistory(data.history || []);
        setBaseline(data.baseline || null);
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    }

    loadHistory();
  }, [status]);

  const chartData = history
    .slice()
    .reverse()
    .map((item) => ({
      date: new Date(item.date).toISOString().substring(0, 10),
      riskScore: item.riskScore,
      riskLevel: item.riskLevel,
    }));

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
      <h1 className="mb-4 text-2xl font-bold sm:text-3xl">My Health Dashboard</h1>

      {status !== "authenticated" && (
        <p className="text-sm text-gray-600">Please log in to see your personalized dashboard.</p>
      )}

      {status === "authenticated" && (
        <>
          <section className="h-[22rem] border rounded-lg bg-white p-3 shadow-sm sm:h-96 sm:p-4">
            <h2 className="text-xl font-semibold mb-4">Risk Score History</h2>
            {error && <p className="text-red-500">{error}</p>}
            {chartData.length === 0 ? (
              <p className="text-sm">No predictions yet. Make your first prediction!</p>
            ) : (
              <ResponsiveContainer width="100%" height="80%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="riskScore" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>
        </>
      )}
    </div>
  );
}
