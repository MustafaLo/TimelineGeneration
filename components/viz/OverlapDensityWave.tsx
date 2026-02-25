"use client";

import { useEffect, useRef, useId } from "react";
import { gsap } from "gsap";
import { PersonData, TimelineData } from "@/types/timeline";
import { getYearRange, getTickInterval, getTicks } from "@/lib/chartUtils";

const CURRENT_YEAR = 2026;

// Internal SVG coordinate space
const VB_W      = 300;
const PAD_L     = 10;
const PAD_R     = 10;
const CHART_TOP = 22;   // space above wave for peak label
const CHART_H   = 100;  // wave height
const AXIS_H    = 28;   // below wave for axis line + labels

// ── Smooth path via Catmull-Rom → cubic bezier conversion ────────────────────
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;

  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    // Control points (tension = 1/6 gives a natural, not too-loose curve)
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }

  return d;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  person:   PersonData;
  barColor: string;
  allData:  TimelineData;
}

export default function OverlapDensityWave({ person, barColor, allData }: Props) {
  const rawId      = useId();
  const clipId     = `odw-${rawId.replace(/:/g, "")}`;

  const clipRectRef   = useRef<SVGRectElement>(null);
  const bandRef       = useRef<SVGRectElement>(null);
  const fillRef       = useRef<SVGPathElement>(null);
  const axisRef       = useRef<SVGGElement>(null);
  const peakLabelRef  = useRef<SVGTextElement>(null);

  // ── Year range and axis ───────────────────────────────────────────────────
  const [minYear, maxYear] = getYearRange(allData, CURRENT_YEAR);
  const interval = getTickInterval(maxYear - minYear);
  const ticks    = getTicks(minYear, maxYear, interval);

  const chartW = VB_W - PAD_L - PAD_R;
  const svgH   = CHART_TOP + CHART_H + AXIS_H;
  const axisY  = CHART_TOP + CHART_H;

  function xs(year: number): number {
    return PAD_L + ((year - minYear) / (maxYear - minYear)) * chartW;
  }

  // ── Sample: count people alive at each point ──────────────────────────────
  const range    = maxYear - minYear || 1;
  const step     = Math.max(1, Math.floor(range / 180)); // ~180 sample points max

  const sampleYears: number[] = [];
  for (let y = minYear; y <= maxYear; y += step) sampleYears.push(y);

  const counts = sampleYears.map(y =>
    allData.filter(p => {
      const born = p.birth_year;
      const died = p.death_year ?? CURRENT_YEAR;
      return born <= y && y <= died;
    }).length
  );

  const maxCount = Math.max(...counts, 1);

  function ys(count: number): number {
    return axisY - (count / maxCount) * CHART_H;
  }

  // ── Build SVG paths ───────────────────────────────────────────────────────
  const topPts = sampleYears.map((y, i) => ({ x: xs(y), y: ys(counts[i]) }));

  const strokePath = smoothPath(topPts);
  const areaPath =
    strokePath +
    ` L${topPts[topPts.length - 1].x.toFixed(2)},${axisY}` +
    ` L${topPts[0].x.toFixed(2)},${axisY}` +
    " Z";

  // ── Peak label position ───────────────────────────────────────────────────
  const peakIdx = counts.indexOf(maxCount);
  const peakX   = xs(sampleYears[peakIdx] ?? minYear);

  // ── Selected person's band ────────────────────────────────────────────────
  const bandX = xs(person.birth_year);
  const bandW = Math.max(2, xs(person.death_year ?? CURRENT_YEAR) - bandX);

  // ── GSAP entrance ─────────────────────────────────────────────────────────
  useEffect(() => {
    const clipRect  = clipRectRef.current;
    const band      = bandRef.current;
    const fill      = fillRef.current;
    const axis      = axisRef.current;
    const peakLabel = peakLabelRef.current;

    if (!clipRect || !band || !fill || !axis) return;

    // Clear stale GSAP inline styles from a previous mount (React Strict Mode safe)
    gsap.set([band, fill, axis, ...(peakLabel ? [peakLabel] : [])], { clearProps: "all" });
    // Reset clip rect SVG attribute separately (clearProps won't clear attr-plugin values)
    gsap.set(clipRect, { attr: { width: VB_W } });

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced) return;

    const tl = gsap.timeline();

    // 1. Selected person's band pulses in first — anchors the viewer
    tl.from(band, { opacity: 0, duration: 0.35, ease: "power2.out" });

    // 2. Wave strokes left → right via SVG clipPath rect width
    tl.from(
      clipRect,
      { attr: { width: 0 }, duration: 0.8, ease: "power3.inOut" },
      "-=0.05"
    );

    // 3. Fill fades in as stroke finishes — the wave gains body
    tl.from(fill, { opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.3");

    // 4. Axis settles in
    tl.from(axis, { opacity: 0, duration: 0.25, ease: "power2.out" }, "-=0.15");

    // 5. Peak count label last
    if (peakLabel) {
      tl.from(peakLabel, { opacity: 0, duration: 0.2, ease: "power2.out" }, "-=0.1");
    }

    return () => { tl.kill(); };
  }, [person.name]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${svgH}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        aria-label="Overlap density wave"
      >
        <defs>
          {/* Clip rect — GSAP animates its width from 0 → VB_W */}
          <clipPath id={clipId}>
            <rect
              ref={clipRectRef}
              x={0} y={0}
              width={VB_W} height={svgH}
            />
          </clipPath>
        </defs>

        {/* ── Selected person's lifespan band — fades in first ────────────── */}
        <rect
          ref={bandRef}
          x={bandX} y={CHART_TOP}
          width={bandW} height={CHART_H}
          fill={barColor}
          opacity={0.12}
          rx={1}
        />

        {/* ── Wave — clipped to reveal left → right ───────────────────────── */}
        <g clipPath={`url(#${clipId})`}>
          {/* Filled area — fades in after stroke reveals */}
          <path
            ref={fillRef}
            d={areaPath}
            fill="var(--fg-muted)"
            opacity={0.11}
          />
          {/* Stroke — the visible leading edge during the reveal */}
          <path
            d={strokePath}
            fill="none"
            stroke="var(--fg-muted)"
            strokeWidth={0.8}
            opacity={0.42}
          />
        </g>

        {/* ── Peak count label ─────────────────────────────────────────────── */}
        <text
          ref={peakLabelRef}
          x={peakX}
          y={CHART_TOP - 5}
          textAnchor="middle"
          dominantBaseline="auto"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "6px",
            fill: "var(--fg-muted)",
            opacity: 0.5,
            userSelect: "none",
            letterSpacing: "0.08em",
          }}
        >
          {maxCount} alive
        </text>

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
    </div>
  );
}
