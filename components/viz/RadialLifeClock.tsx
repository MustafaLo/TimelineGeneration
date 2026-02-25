"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { PersonData } from "@/types/timeline";

// ── Constants ─────────────────────────────────────────────────────────────────
const CURRENT_YEAR = 2026;
const MAX_LIFE     = 120;   // full circle = 120 years
const SIZE         = 200;   // SVG viewBox dimension
const CX           = SIZE / 2;
const CY           = SIZE / 2;
const R            = 76;    // arc radius
const CIRCUMFERENCE = 2 * Math.PI * R; // ≈ 477.5

function formatYear(y: number): string {
  return y < 0 ? `${Math.abs(y)} BCE` : String(y);
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  person:   PersonData;
  barColor: string;
}

export default function RadialLifeClock({ person, barColor }: Props) {
  const arcRef   = useRef<SVGCircleElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  const isAlive   = person.death_year === null;
  const deathYear = isAlive ? CURRENT_YEAR : person.death_year!;
  const lifespan  = deathYear - person.birth_year;
  const fraction  = Math.min(lifespan / MAX_LIFE, 1);
  const targetOffset = CIRCUMFERENCE * (1 - fraction);

  const birthStr = formatYear(person.birth_year);
  const deathStr = isAlive ? "present" : formatYear(person.death_year!);

  // ── GSAP entrance animation ───────────────────────────────────────────────
  useEffect(() => {
    const arc     = arcRef.current;
    const countEl = countRef.current;
    if (!arc || !countEl) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Reduced motion: jump straight to final state
    if (prefersReduced) {
      gsap.set(arc, { strokeDashoffset: targetOffset });
      countEl.textContent = String(lifespan);
      return;
    }

    // Set initial state — arc fully hidden
    gsap.set(arc, { strokeDashoffset: CIRCUMFERENCE });

    const counter = { value: 0 };
    const tl = gsap.timeline();

    tl.to(arc, {
      strokeDashoffset: targetOffset,
      duration: 0.9,
      ease: "power3.out",
    }).to(
      counter,
      {
        value: lifespan,
        duration: 0.7,
        ease: "power2.out",
        onUpdate: () => {
          if (countEl) countEl.textContent = String(Math.round(counter.value));
        },
      },
      "<0.1" // start 100ms after arc begins
    );

    return () => { tl.kill(); };
  }, [person.name]); // re-run if person changes (tab switch)

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.75rem",
        width: "100%",
        height: "100%",
      }}
    >
      {/* ── Dial ─────────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          overflow="visible"
        >
          {/* Background ring — full 120-year circle */}
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1}
            opacity={0.7}
          />

          {/* Life arc — draw-on animated by GSAP */}
          <circle
            ref={arcRef}
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={barColor}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE}
            // Rotate so 0° is at 12 o'clock (top)
            transform={`rotate(-90 ${CX} ${CY})`}
            opacity={0.85}
          />

          {/* Anchor dot at 12 o'clock — marks the birth point */}
          <circle
            cx={CX}
            cy={CY - R}
            r={2.5}
            fill={barColor}
            opacity={0.45}
          />
        </svg>

        {/* ── Center text overlay ─────────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {/* Lifespan number — count-up via GSAP */}
          <span
            ref={countRef}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2.875rem",
              fontWeight: 300,
              lineHeight: 1,
              color: "var(--fg)",
              letterSpacing: "-0.035em",
            }}
          >
            0
          </span>

          {/* "yrs" label */}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.5rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--fg-muted)",
              opacity: 0.45,
              marginTop: "0.375rem",
            }}
          >
            {isAlive ? "yrs+" : "yrs"}
          </span>
        </div>
      </div>

      {/* ── Year labels ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2.25rem",
        }}
      >
        <YearLabel label="born" value={birthStr} />

        {/* Hairline divider */}
        <div
          style={{
            width: "1px",
            height: "2rem",
            backgroundColor: "var(--border)",
            opacity: 0.6,
          }}
        />

        <YearLabel label={isAlive ? "age" : "died"} value={deathStr} />
      </div>
    </div>
  );
}

// ── Year label ────────────────────────────────────────────────────────────────
function YearLabel({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.3rem",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.5rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--fg-muted)",
          opacity: 0.45,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.875rem",
          letterSpacing: "0.04em",
          color: "var(--fg)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
