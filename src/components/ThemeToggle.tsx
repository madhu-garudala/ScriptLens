"use client";

import { useEffect, useState } from "react";

/** Class-based dark mode: follows system preference, overridable, persisted. */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    let initial = false;
    try {
      const stored = localStorage.getItem("scriptlens-theme");
      initial = stored
        ? stored === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      /* storage unavailable — fall back to light */
    }
    setDark(initial);
    document.documentElement.classList.toggle("dark", initial);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("scriptlens-theme", next ? "dark" : "light");
    } catch {
      /* non-fatal */
    }
  }

  if (dark === null) return <div className="h-8 w-8" aria-hidden />;
  return (
    <button
      onClick={toggle}
      className="btn btn-ghost h-8 w-8 !p-0"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
        )}
      </svg>
    </button>
  );
}
