"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { PersonData, TimelineData } from "@/types/timeline";
import { getYearRange, getTickInterval, getTicks } from "@/lib/chartUtils";

const CURRENT_YEAR = 2026;

// Mirrors --cat-0..7 in globals.css and TimelineChart.tsx
const CAT_COLORS = [
  "#7a6e5f", "#5f6e6a", "#6e5f7a", "#7a6a5f",
  "#5f7a6e", "#6a6e5f", "#7a5f6a", "#5f6a7a",
];

// Internal SVG coordinate space
const VB_W      = 300;
const PAD_L     = 8;
const PAD_R     = 8;
const BAR_H     = 4;     // other people's bars
const BAR_H_SEL = 8;     // selected person's bar
const ROW_H     = 17;    // total height per row (bar + gap)
const TOP_PAD   = 14;    // space above row 0 (for name label overflow)
const AXIS_H    = 28;    // below last row — axis line + year labels

// ── Ordinal suffix ────────────────────────────────────────────────────────────
function ordinal(n: number): string {
  const v = n % 100;
  const suffix =
    v >= 11 && v <= 13 ? "th"
    : n % 10 === 1 ? "st"
    : n % 10 === 2 ? "nd"
    : n % 10 === 3 ? "rd"
    : "th";
  return `${n}${suffix}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  person:   PersonData;
  barColor: string;
  allData:  TimelineData;
}

export default function AgeGapFloat({ person, barColor, allData }: Props) {
  const svgRef        = useRef<SVGSVGElement>(null);
  const selectedRef   = useRef<SVGGElement>(null);
  const axisRef       = useRef<SVGGElement>(null);
  const annotationRef = useRef<HTMLSpanElement>(null);

  // ── Category → color (same first-appearance logic as TimelineChart) ────────
  const catColor = new Map<string, string>();
  let ci = 0;
  for (const p of allData) {
    if (!catColor.has(p.category)) {
      catColor.set(p.category, CAT_COLORS[ci % CAT_COLORS.length]);
      ci++;
    }
  }

  // ── Sort all people by birth year for display order ───────────────────────
  const sorted = [...allData].sort((a, b) => a.birth_year - b.birth_year);

  // ── Year range and axis ───────────────────────────────────────────────────
  const [minYear, maxYear] = getYearRange(allData, CURRENT_YEAR);
  const interval = getTickInterval(maxYear - minYear);
  const ticks    = getTicks(minYear, maxYear, interval);

  // ── X coordinate helper (maps year → SVG x) ──────────────────────────────
  const chartW = VB_W - PAD_L - PAD_R;
  function xs(year: number): number {
    return PAD_L + ((year - minYear) / (maxYear - minYear)) * chartW;
  }

  // ── SVG geometry ──────────────────────────────────────────────────────────
  const svgH  = TOP_PAD + allData.length * ROW_H + AXIS_H;
  const axisY = TOP_PAD + allData.length * ROW_H;

  // ── Selected person's row and bar geometry ────────────────────────────────
  const selectedRowIdx = sorted.findIndex(p => p.name === person.name);
  const selRowTop      = TOP_PAD + selectedRowIdx * ROW_H;
  const selBx = xs(person.birth_year);
  const selEx = xs(person.death_year ?? CURRENT_YEAR);
  const selBw = Math.max(2, selEx - selBx);
  const selBy = selRowTop + (ROW_H - BAR_H_SEL) / 2;

  // Name label: right of bar if space, else left
  const approxCharW     = 3.7; // px per char at 6.5px font size in viewBox coords
  const nameW           = person.name.length * approxCharW;
  const rightGap        = VB_W - PAD_R - (selEx + 5);
  const nameAnchor      = rightGap >= nameW ? "start" : "end";
  const nameLabelX      = nameAnchor === "start" ? selEx + 5 : selBx - 5;

  // ── Annotation: lifespan rank ─────────────────────────────────────────────
  const lifespanOf = (p: PersonData) => (p.death_year ?? CURRENT_YEAR) - p.birth_year;
  const byLifespan = [...allData].sort((a, b) => lifespanOf(b) - lifespanOf(a));
  const rank       = byLifespan.findIndex(p => p.name === person.name) + 1;
  const annotation =
    allData.length === 1 ? "only one in this chart"
    : rank === 1         ? "longest-lived in this chart"
    :                      `${ordinal(rank)} longest-lived`;

  // ── GSAP entrance ─────────────────────────────────────────────────────────
  useEffect(() => {
    const svg  = svgRef.current;
    const sel  = selectedRef.current;
    const axis = axisRef.current;
    const ann  = annotationRef.current;
    if (!svg || !sel || !axis || !ann) return;

    const others = Array.from(svg.querySelectorAll<SVGGElement>(".agf-bar"));

    // Clear any stale GSAP inline styles from a previous mount (React Strict Mode safe)
    gsap.set([...others, sel, axis, ann], { clearProps: "all" });

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced) return;

    const tl = gsap.timeline();

    // 1. Other bars stagger up
    if (others.length > 0) {
      tl.from(others, {
        y: 14, opacity: 0, duration: 0.45, ease: "power2.out", stagger: 0.04,
      });
    }

    // 2. Selected bar enters last — slightly heavier
    tl.from(sel, {
      y: 14, opacity: 0, duration: 0.5, ease: "power3.out",
    }, others.length > 0 ? "-=0.1" : "<");

    // 3. Axis fades in
    tl.from(axis, { opacity: 0, duration: 0.3, ease: "power2.out" }, "-=0.2");

    // 4. Annotation settles in last
    tl.from(ann, { opacity: 0, duration: 0.25, ease: "power2.out" }, "+=0.08");

    return () => { tl.kill(); };
  }, [person.name]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${svgH}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        aria-label="Lifespan comparison chart"
      >
        {/* Subtle row highlight behind selected person's row */}
        <rect
          x={0} y={selRowTop}
          width={VB_W} height={ROW_H}
          fill={barColor} opacity={0.06}
        />

        {/* ── Other people's bars ─────────────────────────────────────────── */}
        {sorted.map((p, i) => {
          if (p.name === person.name) return null;
          const bx    = xs(p.birth_year);
          const ex    = xs(p.death_year ?? CURRENT_YEAR);
          const bw    = Math.max(1.5, ex - bx);
          const by    = TOP_PAD + i * ROW_H + (ROW_H - BAR_H) / 2;
          const color = catColor.get(p.category) ?? CAT_COLORS[0];

          return (
            <g key={p.name} className="agf-bar">
              <rect
                x={bx} y={by} width={bw} height={BAR_H}
                fill={color} opacity={0.28} rx={1}
              />
            </g>
          );
        })}

        {/* ── Selected person's bar — rendered last, sits on top ──────────── */}
        <g ref={selectedRef}>
          <rect
            x={selBx} y={selBy}
            width={selBw} height={BAR_H_SEL}
            fill={barColor} opacity={0.85}
            rx={1.5}
          />

          {/* Name label — right of bar, or left if no room */}
          <text
            x={nameLabelX}
            y={selBy - 3.5}
            textAnchor={nameAnchor}
            dominantBaseline="auto"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "6.5px",
              fill: barColor,
              opacity: 0.9,
              userSelect: "none",
              letterSpacing: "0.03em",
            }}
          >
            {person.name}
          </text>
        </g>

        {/* ── Time axis ───────────────────────────────────────────────────── */}
        <g ref={axisRef}>
          <line
            x1={PAD_L} y1={axisY}
            x2={VB_W - PAD_R} y2={axisY}
            stroke="var(--border)" strokeWidth={0.6} opacity={0.75}
          />
          {ticks.map(tick => {
            const tx    = xs(tick);
            const label = tick < 0 ? `${Math.abs(tick)} bc` : String(tick);
            return (
              <g key={tick}>
                <line
                  x1={tx} y1={axisY}
                  x2={tx} y2={axisY + 3}
                  stroke="var(--border)" strokeWidth={0.5} opacity={0.6}
                />
                <text
                  x={tx} y={axisY + 10}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "5.5px",
                    fill: "var(--fg-muted)",
                    opacity: 0.5,
                    userSelect: "none",
                  }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── Lifespan rank annotation ──────────────────────────────────────── */}
      <span
        ref={annotationRef}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.5rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--fg-muted)",
          opacity: 0.38,
        }}
      >
        {annotation}
      </span>
    </div>
  );
}
