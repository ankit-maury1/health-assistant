"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignUpPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignUp() {
    setError(null);
    setLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4">Create Account</h1>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Account creation is handled with Google sign-in only.</p>
          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700"
          >
            {loading ? "Redirecting..." : "Continue with Google"}
          </button>
        </div>

        <p className="mt-4 text-sm">
          Already have an account? <a href="/auth/signin" className="text-blue-600">Sign in</a>
        </p>
      </div>
    </div>
  );
}
