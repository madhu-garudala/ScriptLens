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

  if (dark === null) return <div className="h-7 w-14" aria-hidden />;
  return (
    <button
      onClick={toggle}
      className="btn btn-ghost !px-2.5 !py-1 text-xs"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
    >
      {dark ? "☀ Light" : "☾ Dark"}
    </button>
  );
}
