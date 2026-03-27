"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/settings", label: "Settings" },
    { href: "/diabetes", label: "Diabetes" },
    { href: "/heart-disease", label: "Heart" },
    { href: "/voice-assistant", label: "Voice AI" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/20 bg-gradient-to-r from-[var(--gradient-start)] via-[var(--gradient-mid)] to-[var(--gradient-end)] bg-opacity-100 shadow-lg backdrop-blur-lg dark:from-[var(--gradient-start)] dark:via-[var(--gradient-mid)] dark:to-[var(--gradient-end)] dark:bg-opacity-100">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <Link href="/" className="font-bold text-lg text-white dark:text-slate-100">Health Assistant</Link>

        <nav className="hidden items-center gap-3 md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-white hover:text-indigo-200 dark:text-white">
              {link.label}
            </Link>
          ))}

          {status === "loading" && <span className="text-sm text-slate-500">Loading...</span>}

          {status === "authenticated" && session?.user?.email ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-white">{session.user.name}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded border border-white/40 px-3 py-1 text-sm text-white hover:bg-white/10"
              >
                Sign Out
              </button>
            </div>
          ) : status !== "loading" ? (
            <Link href="/auth/signin" className="rounded border border-white/40 px-3 py-1 text-sm text-white hover:bg-white/10">
              Sign In
            </Link>
          ) : null}
        </nav>

        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-white/20 bg-gradient-to-r from-[var(--gradient-start)] via-[var(--gradient-mid)] to-[var(--gradient-end)] bg-opacity-95 dark:bg-opacity-90 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="text-sm font-medium text-white hover:text-indigo-200"
              >
                {link.label}
              </Link>
            ))}

            {status === "loading" && <span className="text-sm text-white/90">Loading...</span>}

            {status === "authenticated" && session?.user?.email ? (
              <>
                <span className="text-sm text-white">{session.user.name}</span>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-fit rounded border border-white/40 px-3 py-1 text-sm text-white hover:bg-white/10"
                >
                  Sign Out
                </button>
              </>
            ) : status !== "loading" ? (
              <Link
                href="/auth/signin"
                onClick={() => setIsMenuOpen(false)}
                className="w-fit rounded border border-white/40 px-3 py-1 text-sm text-white hover:bg-white/10"
              >
                Sign In
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
