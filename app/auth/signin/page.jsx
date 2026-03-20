"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);

    await signIn("google", { callbackUrl: "/dashboard" });

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4">Sign In</h1>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Continue with your Google account to access your dashboard.</p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full mt-3 py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700"
          >
            {loading ? "Redirecting..." : "Sign in with Google"}
          </button>
        </div>
      </div>
    </div>
  );
}
