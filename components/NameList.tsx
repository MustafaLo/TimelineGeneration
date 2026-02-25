"use client";

import { useState, useEffect, useRef } from "react";

interface NameListProps {
  names: string[];
  onRemove: (name: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  hidden: boolean;
}

function NameItem({
  name,
  onRemove,
}: {
  name: string;
  onRemove: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    // Trigger fade-in after mount
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <li
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 0.25s ease, transform 0.25s ease",
        padding: "2px 0",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.8125rem",
          color: "var(--fg)",
          letterSpacing: "0.02em",
        }}
      >
        {name}
      </span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--fg-muted)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.75rem",
          padding: "0 2px",
          opacity: hovered ? 0.7 : 0,
          transition: "opacity 0.15s ease",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </li>
  );
}

export default function NameList({
  names,
  onRemove,
  onGenerate,
  isLoading,
  hidden,
}: NameListProps) {
  if (names.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "calc(48px + 80px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.25rem",
        width: "min(480px, 80vw)",
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? "none" : "auto",
        transition: "opacity 0.4s var(--ease-physical)",
      }}
    >
      <ul
        style={{
          listStyle: "none",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "0.125rem",
        }}
      >
        {names.map((name) => (
          <NameItem key={name} name={name} onRemove={() => onRemove(name)} />
        ))}
      </ul>

      <button
        onClick={onGenerate}
        disabled={isLoading || names.length === 0}
        style={{
          marginTop: "0.5rem",
          background: "none",
          border: "1px solid var(--border)",
          color: isLoading ? "var(--fg-muted)" : "var(--fg)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.75rem",
          letterSpacing: "0.1em",
          textTransform: "lowercase",
          padding: "0.5rem 1.5rem",
          cursor: isLoading ? "default" : "pointer",
          transition: "border-color 0.2s ease, color 0.2s ease",
          opacity: isLoading ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
            (e.currentTarget as HTMLElement).style.color = "var(--accent)";
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLElement).style.color = "var(--fg)";
        }}
      >
        {isLoading ? "resolving\u2026" : "generate \u2192"}
      </button>
    </div>
  );
}
