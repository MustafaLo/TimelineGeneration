"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { TimelineData, PersonData } from "@/types/timeline";
import {
  getYearRange,
  getTickInterval,
  getTicks,
} from "@/lib/chartUtils";

// ── Layout constants ──────────────────────────────────────────────────────────
const PAD_BOTTOM   = 60;
const PAD_LEFT     = 48;
const PAD_RIGHT    = 160;
const BAR_H        = 18;
const BAR_GAP      = 14;
const RESERVED_TOP = 120;
const CURRENT_YEAR = 2026;
const ARROW_EXT    = 48;

// ── Animation constants ───────────────────────────────────────────────────────
const BAR_DRAW_DURATION  = 700;  // ms — time for a single bar to draw in
const BAR_STAGGER        = 70;   // ms — offset between consecutive bars
const LABEL_FADE_DURATION = 200; // ms — label fade after bar finishes
const TICK_STAGGER       = 50;   // ms — offset between tick labels
const BAR_EXIT_DURATION  = 320;  // ms — bar fade-out on removal

// Desaturated ink tones — mirrors --cat-0..7 in globals.css
const CAT_COLORS = [
  "#7a6e5f", "#5f6e6a", "#6e5f7a", "#7a6a5f",
  "#5f7a6e", "#6a6e5f", "#7a5f6a", "#5f6a7a",
];

// Approx char width for DM Mono at 10px
const CHAR_W = 6.3;

// ── Types ─────────────────────────────────────────────────────────────────────
interface FlatRow {
  person: PersonData;
  barY: number;
  color: string;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function computeContentHeight(data: TimelineData): number {
  const n = data.length;
  return n * (BAR_H + BAR_GAP) - BAR_GAP + PAD_BOTTOM;
}

function buildFlatLayout(
  data: TimelineData,
  topOffset: number
): { rows: FlatRow[] } {
  const catColor = new Map<string, string>();
  let ci = 0;
  for (const p of data) {
    if (!catColor.has(p.category)) {
      catColor.set(p.category, CAT_COLORS[ci % CAT_COLORS.length]);
      ci++;
    }
  }

  const sorted = [...data].sort((a, b) => a.birth_year - b.birth_year);
  const rows: FlatRow[] = sorted.map((person, i) => ({
    person,
    barY: topOffset + i * (BAR_H + BAR_GAP),
    color: catColor.get(person.category) ?? CAT_COLORS[0],
  }));

  return { rows };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TimelineChart({
  data,
  onPersonClick,
  onRemovePerson,
}: {
  data: TimelineData;
  onPersonClick?: (person: PersonData, color: string) => void;
  onRemovePerson?: (name: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const [hoveredX, setHoveredX] = useState<string | null>(null);
  const [exitingNames, setExitingNames] = useState<Set<string>>(new Set());

  // Per-person animation delay, computed once per name and cached in a ref.
  // Map is idempotent: existing names keep their delay, new names get
  // a delay based on how many other new names are in the same render pass.
  const animDelayMapRef = useRef<Map<string, number>>(new Map());

  // Same pattern for tick marks — keyed by year value.
  const tickDelayMapRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const contentH = useMemo(() => computeContentHeight(data), [data]);
  const topOffset = dims.h > 0
    ? RESERVED_TOP + Math.max(0, (dims.h - RESERVED_TOP - contentH) * 0.62)
    : RESERVED_TOP;

  const { rows } = useMemo(
    () => buildFlatLayout(data, topOffset),
    [data, topOffset]
  );

  const [minYear, maxYear] = useMemo(() => getYearRange(data, CURRENT_YEAR), [data]);
  const chartW = Math.max(0, dims.w - PAD_LEFT - PAD_RIGHT);

  function xs(year: number): number {
    return PAD_LEFT + ((year - minYear) / (maxYear - minYear)) * chartW;
  }

  const interval = getTickInterval(maxYear - minYear);
  const ticks = useMemo(
    () => getTicks(minYear, maxYear, interval),
    [minYear, maxYear, interval]
  );

  const axisY = topOffset + contentH - PAD_BOTTOM;

  // ── Compute animation delays (idempotent — ref.has() guards re-assignment) ──
  {
    let newBarCount = 0;
    for (const row of rows) {
      if (!animDelayMapRef.current.has(row.person.name)) {
        animDelayMapRef.current.set(row.person.name, newBarCount * BAR_STAGGER);
        newBarCount++;
      }
    }
  }
  {
    let newTickCount = 0;
    for (const tick of ticks) {
      if (!tickDelayMapRef.current.has(tick)) {
        tickDelayMapRef.current.set(tick, newTickCount * TICK_STAGGER);
        newTickCount++;
      }
    }
  }

  if (dims.w === 0) {
    return <div ref={wrapRef} style={{ position: "fixed", inset: 0, zIndex: 0 }} />;
  }

  return (
    <div
      ref={wrapRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <svg
        width={dims.w}
        height={dims.h}
        style={{ display: "block", overflow: "visible" }}
        aria-label="Biographical timeline chart"
        role="img"
      >
        <defs>
          <marker
            id="alive-arrow"
            markerWidth="7"
            markerHeight="7"
            refX="5.5"
            refY="3.5"
            orient="auto"
          >
            <path d="M0,1 L0,6 L6,3.5 z" fill="var(--fg-muted)" opacity="0.65" />
          </marker>
        </defs>

        {/* ── Vertical grid lines (static — subtle reference, no animation) ── */}
        {ticks.map((tick) => (
          <line
            key={`grid-${tick}`}
            x1={xs(tick)}
            y1={topOffset - 10}
            x2={xs(tick)}
            y2={axisY}
            stroke="var(--fg-muted)"
            strokeWidth={0.5}
            opacity={0.18}
          />
        ))}

        {/* ── Person bars ───────────────────────────────────────────────────── */}
        {rows.map(({ person, barY, color }) => {
          const bx = xs(person.birth_year);
          const solidEndX = xs(person.death_year ?? CURRENT_YEAR);
          const barW = Math.max(2, solidEndX - bx);
          // All y-coords are relative to the group's translateY — so midBarY is just BAR_H/2
          const midY = BAR_H / 2;
          const isAlive = person.death_year === null;

          const arrowEndX = isAlive
            ? Math.min(solidEndX + ARROW_EXT, dims.w - 14)
            : 0;

          const nameW = person.name.length * CHAR_W;
          const rightOfBar = isAlive ? arrowEndX : solidEndX;
          const nameRightX = rightOfBar + 8;
          const nameOnLeft = nameRightX + nameW > dims.w - 8;
          const nameX = nameOnLeft ? bx - 5 : nameRightX;
          const nameAnchor = nameOnLeft ? "end" : "start";

          const barDelay = animDelayMapRef.current.get(person.name) ?? 0;
          const labelDelay = barDelay + BAR_DRAW_DURATION;

          const isBarHovered = hoveredBar === person.name;
          const isXHovered = hoveredX === person.name;
          const isExiting = exitingNames.has(person.name);

          // × position: after name label when on right, or after bar end when name is on left
          const xBtnX = nameOnLeft
            ? rightOfBar + 10
            : nameRightX + nameW + 6;

          return (
            /*
              Outer <g>: positions the bar via CSS transform (not SVG y-attr).
              Using transform lets CSS transition the position when bars shift
              after a removal — all remaining bars slide smoothly to their new slots.
            */
            <g
              key={person.name}
              style={{
                transform: `translateY(${barY}px)`,
                // Position shift: only when NOT part of the entrance animation
                transition: `transform 380ms cubic-bezier(0.7,0,0.3,1)`,
              }}
            >
              {/*
                Inner <g>: handles hover interactions + exit fade.
                Kept separate from the transform layer so opacity and
                position transitions don't fight each other.
              */}
              <g
                className="bar-group"
                style={{
                  pointerEvents: isExiting ? "none" : "auto",
                  cursor: onPersonClick ? "pointer" : "default",
                  // Only set opacity/transition via inline style when exiting.
                  // When idle, let globals.css `.bar-group:hover` rules control opacity
                  // (inline styles would override those CSS rules if always present).
                  ...(isExiting ? {
                    opacity: 0,
                    transition: `opacity ${BAR_EXIT_DURATION}ms cubic-bezier(0.7,0,0.3,1)`,
                  } : {}),
                }}
                onMouseEnter={() => !isExiting && setHoveredBar(person.name)}
                onMouseLeave={() => { setHoveredBar(null); setHoveredX(null); }}
                onClick={() => !isExiting && onPersonClick?.(person, color)}
              >
                {/*
                  Draw animation <g>: clip-path bar-draw animation.
                  All rects/lines use y=0 / midY (relative to outer translateY).
                */}
                <g
                  style={{
                    animation: `bar-draw ${BAR_DRAW_DURATION}ms cubic-bezier(0.7,0,0.3,1) ${barDelay}ms both`,
                  }}
                >
                  {/* Solid bar */}
                  <rect
                    x={bx}
                    y={0}
                    width={barW}
                    height={BAR_H}
                    fill={color}
                    opacity={person.approximate ? 0.52 : 0.82}
                    rx={1.5}
                    ry={1.5}
                  />

                  {/* Approximate: open left-edge notch */}
                  {person.approximate && (
                    <rect
                      x={bx}
                      y={0}
                      width={4}
                      height={BAR_H}
                      fill="var(--bg)"
                      opacity={0.65}
                      rx={1.5}
                    />
                  )}

                  {/* Living person: dashed extension + arrow */}
                  {isAlive && (
                    <line
                      x1={solidEndX}
                      y1={midY}
                      x2={arrowEndX}
                      y2={midY}
                      stroke={color}
                      strokeWidth={1.5}
                      strokeDasharray="3,4"
                      opacity={0.55}
                      markerEnd="url(#alive-arrow)"
                    />
                  )}
                </g>

                {/* Name label — fades in only after its bar finishes drawing */}
                <text
                  x={nameX}
                  y={midY}
                  textAnchor={nameAnchor}
                  dominantBaseline="middle"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    fill: "var(--fg)",
                    userSelect: "none",
                    pointerEvents: "none",
                    ["--final-opacity" as string]: "0.8",
                    animation: `timeline-fade ${LABEL_FADE_DURATION}ms ease ${labelDelay}ms both`,
                  } as React.CSSProperties}
                >
                  {person.name}
                </text>

                {/* × remove button — appears only on bar hover */}
                {onRemovePerson && (
                  <text
                    x={xBtnX}
                    y={midY}
                    textAnchor="start"
                    dominantBaseline="middle"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      fill: "var(--fg)",
                      userSelect: "none",
                      cursor: "pointer",
                      opacity: isBarHovered ? (isXHovered ? 0.75 : 0.35) : 0,
                      transition: "opacity 0.15s ease",
                    }}
                    onMouseEnter={(e) => { e.stopPropagation(); setHoveredX(person.name); }}
                    onMouseLeave={(e) => { e.stopPropagation(); setHoveredX(null); }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Start exit animation, then notify parent after it completes
                      setExitingNames(prev => new Set(prev).add(person.name));
                      setHoveredBar(null);
                      setHoveredX(null);
                      setTimeout(() => {
                        onRemovePerson(person.name);
                        setExitingNames(prev => {
                          const next = new Set(prev);
                          next.delete(person.name);
                          return next;
                        });
                      }, BAR_EXIT_DURATION + 40);
                    }}
                  >
                    ×
                  </text>
                )}
              </g>
            </g>
          );
        })}

        {/* ── Time axis line ────────────────────────────────────────────────── */}
        <line
          x1={PAD_LEFT}
          y1={axisY}
          x2={dims.w - PAD_RIGHT}
          y2={axisY}
          stroke="var(--fg-muted)"
          strokeWidth={1}
          style={{
            ["--final-opacity" as string]: "0.55",
            animation: "timeline-fade 500ms ease 0ms both",
          } as React.CSSProperties}
        />

        {/* ── Tick marks and year labels ────────────────────────────────────── */}
        {ticks.map((tick, i) => {
          const tx = xs(tick);
          const label = tick < 0 ? `${Math.abs(tick)} bc` : String(tick);
          const tickDelay = tickDelayMapRef.current.get(tick) ?? i * TICK_STAGGER;

          return (
            <g key={`tick-${tick}`}>
              <line
                x1={tx}
                y1={axisY}
                x2={tx}
                y2={axisY + 6}
                stroke="var(--fg-muted)"
                strokeWidth={1}
                style={{
                  ["--final-opacity" as string]: "0.65",
                  animation: `timeline-fade 200ms ease ${tickDelay}ms both`,
                } as React.CSSProperties}
              />
              <text
                x={tx}
                y={axisY + 20}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fill: "var(--fg)",
                  letterSpacing: "0.02em",
                  userSelect: "none",
                  ["--final-opacity" as string]: "0.82",
                  animation: `timeline-fade 200ms ease ${tickDelay + 30}ms both`,
                } as React.CSSProperties}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
