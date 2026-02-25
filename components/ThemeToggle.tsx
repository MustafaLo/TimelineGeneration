"use client";

import { useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle light/dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        position: "fixed",
        top: "1.25rem",
        right: "1.25rem",
        zIndex: 100,
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "var(--fg-muted)",
        padding: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.5,
        transition: "opacity 0.2s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.5")}
    >
      {/* Sun / Moon icon swap */}
      {dark ? (
        /* Sun */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Moon */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
