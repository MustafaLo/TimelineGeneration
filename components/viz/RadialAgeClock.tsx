"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { PersonData, TimelineData } from "@/types/timeline";

const CURRENT_YEAR = 2026;

// ── SVG coordinate space ──────────────────────────────────────────────────────
const VB      = 260;
const CX      = VB / 2;
const CY      = VB / 2;

const MIN_R   = 28;
const MAX_R   = 106;
const BASE_R  = (MIN_R + MAX_R) / 2; // 67 — selected person's ring
const CLOCK_R = MAX_R + 11;          // outer tick-mark ring

const CAT_COLORS = [
  "#7a6e5f", "#5f6e6a", "#6e5f7a", "#7a6a5f",
  "#5f7a6e", "#6a6e5f", "#7a5f6a", "#5f6a7a",
];

// ── Geometry ──────────────────────────────────────────────────────────────────

function polarToXY(r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return {
    x: +(CX + r * Math.cos(rad)).toFixed(2),
    y: +(CY + r * Math.sin(rad)).toFixed(2),
  };
}

function describeArc(r: number, startDeg: number, endDeg: number): string {
  const end   = Math.min(endDeg, startDeg + 359.9);
  const s     = polarToXY(r, startDeg);
  const e     = polarToXY(r, end);
  const large = end - startDeg > 180 ? 1 : 0;
  return `M${s.x},${s.y} A${r},${r} 0 ${large},1 ${e.x},${e.y}`;
}

function arcLengthPx(r: number, angleDeg: number): number {
  return r * (Math.PI / 180) * Math.abs(angleDeg);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArcEntry {
  key:          string;
  p:            PersonData;
  color:        string;
  r:            number;
  startDeg:     number;
  endDeg:       number;
  len:          number;
  bornDuring:   boolean;
  diedDuring:   boolean;
  ageGap:       number;  // selected.birth − other.birth (+ve = they're older)
  overlapYears: number;
}

interface Props {
  person:   PersonData;
  barColor: string;
  allData:  TimelineData;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RadialAgeClock({ person, barColor, allData }: Props) {
  const svgRef     = useRef<SVGSVGElement>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const personEnd = person.death_year ?? CURRENT_YEAR;
  const lifespan  = Math.max(personEnd - person.birth_year, 1);
  const firstName = person.name.split(" ")[0];

  function yearToDeg(year: number): number {
    return ((year - person.birth_year) / lifespan) * 360;
  }

  // Category → color (first-appearance order)
  const catColor = new Map<string, string>();
  let ci = 0;
  for (const p of allData) {
    if (!catColor.has(p.category)) {
      catColor.set(p.category, CAT_COLORS[ci % CAT_COLORS.length]);
      ci++;
    }
  }

  // ── Arc data ──────────────────────────────────────────────────────────────
  //
  // KEY CHANGE: arcs are assigned evenly-spaced radii sorted by age gap.
  // This guarantees arcs never stack on top of each other regardless of how
  // similar the age gaps are.  Older → outer, younger → inner; the relative
  // ordering is always preserved even if the proportional spacing isn't.

  const others = allData.filter(p => p.name !== person.name);

  // 1. Filter to only people who actually overlapped, then sort youngest→oldest
  const overlapping = others
    .filter(p => {
      const otherEnd = p.death_year ?? CURRENT_YEAR;
      return Math.min(otherEnd, personEnd) > Math.max(p.birth_year, person.birth_year);
    })
    // Pick the 10 closest contemporaries by shared years — most overlap first
    .sort((a, b) => {
      const endA    = a.death_year ?? CURRENT_YEAR;
      const endB    = b.death_year ?? CURRENT_YEAR;
      const shareA  = Math.min(endA, personEnd) - Math.max(a.birth_year, person.birth_year);
      const shareB  = Math.min(endB, personEnd) - Math.max(b.birth_year, person.birth_year);
      return shareB - shareA;
    })
    .slice(0, 10)
    // Re-sort by age gap for radial positioning: youngest (inner) → oldest (outer)
    .sort((a, b) => {
      const gapA = person.birth_year - a.birth_year;
      const gapB = person.birth_year - b.birth_year;
      return gapA - gapB;
    });

  const N = overlapping.length;

  // 2. Assign evenly-spaced radii across [MIN_R, MAX_R]
  function assignedRadius(i: number): number {
    if (N <= 1) return BASE_R;
    return MIN_R + (i / (N - 1)) * (MAX_R - MIN_R);
  }

  // 3. Build arc entries
  const arcs: ArcEntry[] = overlapping.map((p, i) => {
    const otherEnd     = p.death_year ?? CURRENT_YEAR;
    const overlapStart = Math.max(p.birth_year, person.birth_year);
    const overlapEnd   = Math.min(otherEnd, personEnd);
    const r            = assignedRadius(i);
    const startDeg     = yearToDeg(overlapStart);
    const endDeg       = yearToDeg(overlapEnd);

    return {
      key:          p.name,
      p,
      color:        catColor.get(p.category) ?? CAT_COLORS[0],
      r,
      startDeg,
      endDeg,
      len:          arcLengthPx(r, endDeg - startDeg),
      bornDuring:   p.birth_year > person.birth_year,
      diedDuring:   p.death_year !== null && p.death_year < personEnd,
      ageGap:       person.birth_year - p.birth_year,
      overlapYears: overlapEnd - overlapStart,
    };
  });

  // Age tick marks
  const ageStep = lifespan > 80 ? 20 : lifespan > 50 ? 10 : 5;
  const ageTicks: number[] = [];
  for (let a = ageStep; a < lifespan; a += ageStep) ageTicks.push(a);

  // ── Hover content ─────────────────────────────────────────────────────────
  const hoveredArc = arcs.find(a => a.key === hoveredKey) ?? null;

  function infoStat1(arc: ArcEntry): string {
    const other  = arc.p.name.split(" ")[0];
    const gapAbs = Math.abs(arc.ageGap);
    if (arc.ageGap > 0) return `${other} was ${gapAbs} when ${firstName} was born`;
    if (arc.ageGap < 0) return `${firstName} was ${gapAbs} when ${other} was born`;
    return `${other} was born the same year as ${firstName}`;
  }

  function infoStat2(arc: ArcEntry): string {
    const other = arc.p.name.split(" ")[0];
    if (arc.diedDuring) {
      const selAge = arc.p.death_year! - person.birth_year;
      return `${other} died when ${firstName} was ${selAge}`;
    }
    if (arc.p.death_year === null) return `${other} is still alive today`;
    return `${other} outlived ${firstName}`;
  }

  // ── GSAP entrance ─────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const clockRingEl  = svg.querySelector<SVGCircleElement>(".rac-clock-ring");
    const tickEls      = Array.from(svg.querySelectorAll<SVGGElement>(".rac-tick"));
    const bornMarker   = svg.querySelector<SVGGElement>(".rac-born");
    const centerEl     = svg.querySelector<SVGGElement>(".rac-center");
    const arcEls       = Array.from(svg.querySelectorAll<SVGPathElement>(".rac-arc"));
    const dotEls       = Array.from(svg.querySelectorAll<SVGCircleElement>(".rac-dot"));

    const allEls = [
      ...(clockRingEl  ? [clockRingEl]  : []),
      ...tickEls,
      ...(bornMarker   ? [bornMarker]   : []),
      ...(centerEl     ? [centerEl]     : []),
      ...arcEls, ...dotEls,
    ];

    gsap.set(allEls, { clearProps: "all" });

    if (prefersReduced) return;

    arcEls.forEach(el => {
      const len = parseFloat(el.dataset.len ?? "100");
      el.style.strokeDasharray  = String(len);
      el.style.strokeDashoffset = String(len);
    });
    gsap.set(arcEls,  { opacity: 0 });
    gsap.set(dotEls,  { opacity: 0 });
    if (clockRingEl) gsap.set(clockRingEl, { opacity: 0 });
    gsap.set(tickEls, { opacity: 0 });
    if (bornMarker)   gsap.set(bornMarker,   { opacity: 0 });
    if (centerEl)     gsap.set(centerEl,     { opacity: 0 });

    const tl = gsap.timeline();

    if (clockRingEl) tl.to(clockRingEl, { opacity: 0.22, duration: 0.5, ease: "power2.out" });
    if (tickEls.length) {
      tl.to(tickEls, { opacity: 1, duration: 0.18, stagger: 0.04, ease: "power2.out" }, "-=0.3");
    }
    if (bornMarker) tl.to(bornMarker, { opacity: 1, duration: 0.25, ease: "power2.out" }, "-=0.1");
    if (centerEl)   tl.to(centerEl,   { opacity: 1, duration: 0.35, ease: "power2.out" }, "-=0.1");
    if (arcEls.length) {
      tl.to(arcEls, {
        strokeDashoffset: 0,
        opacity: 1,
        duration: 0.65,
        stagger: { amount: 0.55, from: "start" },
        ease: "power3.inOut",
      }, "-=0.1");
    }
    if (dotEls.length) {
      tl.to(dotEls, { opacity: 0.85, duration: 0.2, stagger: 0.06, ease: "power2.out" }, "-=0.2");
    }

    return () => { tl.kill(); };
  }, [person.name]);

  if (arcs.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "0.55rem",
          letterSpacing: "0.18em", textTransform: "uppercase",
          color: "var(--fg-muted)", opacity: 0.45,
        }}>
          no contemporaries in this chart
        </span>
      </div>
    );
  }

  const anyHovered = hoveredKey !== null;

  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: "0.5rem",
    }}>

      {/* ── Info strip — appears above the SVG on hover ──────────────────────── */}
      <div style={{
        width: "100%",
        height: "4.25rem",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.28rem",
        opacity: hoveredArc ? 1 : 0,
        transition: "opacity 180ms ease",
        pointerEvents: "none",
        overflow: "hidden",
      }}>
        {hoveredArc && (
          <>
            {/* Full name */}
            <span style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.05rem",
              fontWeight: 300,
              color: hoveredArc.color,
              letterSpacing: "-0.015em",
              lineHeight: 1,
            }}>
              {hoveredArc.p.name}
            </span>
            {/* Stat 1 — age relationship at birth */}
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.625rem",
              color: "var(--fg)",
              letterSpacing: "0.04em",
              opacity: 0.8,
            }}>
              {infoStat1(hoveredArc)}
            </span>
            {/* Stat 2 — how the overlap ended */}
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.625rem",
              color: "var(--fg)",
              letterSpacing: "0.04em",
              opacity: 0.7,
            }}>
              {infoStat2(hoveredArc)}
            </span>
            {/* Shared years — most muted */}
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.575rem",
              color: "var(--fg)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: 0.55,
            }}>
              {hoveredArc.overlapYears} yr shared
            </span>
          </>
        )}
      </div>

      {/* ── Main SVG clock ────────────────────────────────────────────────────── */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB} ${VB}`}
        width="100%"
        style={{ display: "block", overflow: "visible", flex: "1 1 0", minHeight: 0 }}
        aria-label={`Radial age clock for ${person.name}`}
      >
        {/* Outer clock ring */}
        <circle
          className="rac-clock-ring"
          cx={CX} cy={CY} r={CLOCK_R}
          fill="none"
          stroke="var(--fg)"
          strokeWidth={0.5}
          opacity={0.18}
        />

        {/* Age tick marks */}
        {ageTicks.map(age => {
          const deg    = (age / lifespan) * 360;
          const inner  = polarToXY(CLOCK_R - 5, deg);
          const outer  = polarToXY(CLOCK_R + 1, deg);
          const lp     = polarToXY(CLOCK_R + 9, deg);
          const anchor =
            deg < 10 || deg > 350 ? "middle"
            : deg < 180 ? "start"
            : "end";

          return (
            <g key={age} className="rac-tick">
              <line
                x1={inner.x} y1={inner.y}
                x2={outer.x} y2={outer.y}
                stroke="var(--fg)" strokeWidth={0.7}
              />
              <text
                x={lp.x} y={lp.y}
                textAnchor={anchor} dominantBaseline="middle"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "6px",
                  fill: "var(--fg)",
                  userSelect: "none",
                  letterSpacing: "0.02em",
                }}
              >
                {age}
              </text>
            </g>
          );
        })}

        {/* "Born" marker at 12 o'clock */}
        {(() => {
          const inner = polarToXY(CLOCK_R - 5, 0);
          const outer = polarToXY(CLOCK_R + 2, 0);
          const lp    = polarToXY(CLOCK_R + 11, 0);
          return (
            <g className="rac-born">
              <line
                x1={inner.x} y1={inner.y}
                x2={outer.x} y2={outer.y}
                stroke={barColor} strokeWidth={1.5}
              />
              <text
                x={lp.x} y={lp.y}
                textAnchor="middle" dominantBaseline="middle"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "6px",
                  fill: barColor,
                  letterSpacing: "0.06em",
                  userSelect: "none",
                }}
              >
                born / death
              </text>
            </g>
          );
        })()}

        {/* ── Contemporary arcs ───────────────────────────────────────────────── */}
        {arcs.map(arc => {
          const d       = describeArc(arc.r, arc.startDeg, arc.endDeg);
          const startPt = polarToXY(arc.r, arc.startDeg);
          const endPt   = polarToXY(arc.r, arc.endDeg);

          const isHovered = hoveredKey === arc.key;
          const isDimmed  = anyHovered && !isHovered;

          return (
            <g
              key={arc.key}
              style={{
                opacity: isDimmed ? 0.07 : 1,
                transition: "opacity 160ms ease",
                cursor: "pointer",
              }}
              onMouseEnter={() => setHoveredKey(arc.key)}
              onMouseLeave={() => setHoveredKey(null)}
            >
              {arc.bornDuring && (
                <circle
                  className="rac-dot"
                  cx={startPt.x} cy={startPt.y} r={1.8}
                  fill={arc.color}
                />
              )}

              <path
                className="rac-arc"
                d={d}
                fill="none"
                stroke={arc.color}
                strokeWidth={isHovered ? 3.5 : 2.2}
                strokeLinecap="round"
                data-len={arc.len}
                style={{ transition: "stroke-width 120ms ease" }}
              />

              {arc.diedDuring && (
                <circle
                  className="rac-dot"
                  cx={endPt.x} cy={endPt.y} r={2.2}
                  fill={arc.color}
                />
              )}
            </g>
          );
        })}

        {/* ── Center label ─────────────────────────────────────────────────────── */}
        <g className="rac-center">
          {hoveredArc ? (
            /* On hover: just the first name of the hovered person */
            <text
              x={CX} y={CY + 2}
              textAnchor="middle" dominantBaseline="middle"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "13px",
                fontWeight: 300,
                fill: hoveredArc.color,
                letterSpacing: "-0.02em",
                userSelect: "none",
              }}
            >
              {hoveredArc.p.name.split(" ")[0]}
            </text>
          ) : (
            /* Default: selected person */
            <>
              <text
                x={CX} y={CY - 5}
                textAnchor="middle" dominantBaseline="auto"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "12px",
                  fontWeight: 300,
                  fill: "var(--fg)",
                  letterSpacing: "-0.02em",
                  userSelect: "none",
                }}
              >
                {firstName}
              </text>
              <text
                x={CX} y={CY + 7}
                textAnchor="middle" dominantBaseline="hanging"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "5.5px",
                  fill: barColor,
                  opacity: 0.8,
                  userSelect: "none",
                  letterSpacing: "0.1em",
                }}
              >
                {lifespan}yr
              </text>
            </>
          )}
        </g>
      </svg>

      {/* ── Legend ───────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
        {["outer = older", "inner = younger", "clockwise = age →"].map(label => (
          <span
            key={label}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.46rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--fg-muted)",
              opacity: 0.6,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
