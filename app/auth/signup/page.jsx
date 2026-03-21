"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Card } from "@/components/ui/Card";

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
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-950 dark:via-purple-950 dark:to-pink-950 py-10 px-4 sm:px-6 lg:px-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-10 right-4 w-80 h-80 bg-pink-400/20 rounded-full blur-3xl animate-float delay-200" />
      </div>

      <div className="relative max-w-md mx-auto">
        <Card title="Create Account" description="Use Google SSO to get started in seconds." className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Account creation is handled with Google sign-in only.</p>
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full py-2.5 font-semibold bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all duration-300 disabled:opacity-80"
          >
            {loading ? "Redirecting..." : "Continue with Google"}
          </button>

          <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
            Already have an account? <a href="/auth/signin" className="text-indigo-500 hover:text-indigo-400">Sign in</a>
          </p>
        </Card>
      </div>
    </div>
  );
}
