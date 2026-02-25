"use client";

import { useRef, useState, useEffect } from "react";

// Mirror the chart's padding constants so extents match exactly
const PAD_LEFT      = 48;
const PAD_RIGHT     = 160;
const RESERVED_TOP  = 120;

const PLACEHOLDER_LINES = 7;

// Timing (ms)
const AXIS_DURATION    = 800;  // horizontal axis draws left → right
const LINES_START      = 700;  // vertical lines start after axis is nearly done
const LINE_STAGGER     = 80;   // between consecutive vertical lines
const LINE_DURATION    = 350;  // how long each vertical line takes to draw

export default function ChartSkeleton({ exiting }: { exiting: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Estimated axis Y — uses 75% of viewport height as a reasonable midpoint
  // (real chart positions based on bar count, but fade transition covers the diff)
  const axisY = Math.max(dims.h * 0.75, RESERVED_TOP + 150);
  const chartW = Math.max(0, dims.w - PAD_LEFT - PAD_RIGHT);

  // Evenly-spaced placeholder tick positions across the chart width
  const placeholderXs = Array.from({ length: PLACEHOLDER_LINES }, (_, i) =>
    PAD_LEFT + (i / (PLACEHOLDER_LINES - 1)) * chartW
  );

  return (
    <div
      ref={wrapRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: exiting ? 0 : 1,
        transition: "opacity 400ms var(--ease-physical)",
      }}
    >
      {dims.w > 0 && (
        <svg
          width={dims.w}
          height={dims.h}
          style={{ display: "block", overflow: "visible" }}
        >
          {/* Vertical placeholder grid lines — draw top → bottom after axis */}
          {placeholderXs.map((tx, i) => (
            <rect
              key={`vline-${i}`}
              x={tx - 0.25}
              y={RESERVED_TOP - 10}
              width={0.5}
              height={axisY - RESERVED_TOP + 10}
              fill="var(--fg-muted)"
              opacity={0.18}
              style={{
                animation: `col-draw ${LINE_DURATION}ms ease ${LINES_START + i * LINE_STAGGER}ms both`,
              }}
            />
          ))}

          {/* Horizontal axis line — drawn as a rect so clip-path works reliably */}
          <rect
            x={PAD_LEFT}
            y={axisY}
            width={chartW}
            height={1}
            fill="var(--fg-muted)"
            opacity={0.55}
            style={{
              animation: `bar-draw ${AXIS_DURATION}ms cubic-bezier(0.7,0,0.3,1) 0ms both`,
            }}
          />

          {/* Tick marks — fade in alongside their vertical lines */}
          {placeholderXs.map((tx, i) => (
            <rect
              key={`tick-${i}`}
              x={tx - 0.5}
              y={axisY}
              width={1}
              height={6}
              fill="var(--fg-muted)"
              style={{
                ["--final-opacity" as string]: "0.4",
                animation: `timeline-fade 200ms ease ${LINES_START + i * LINE_STAGGER + 100}ms both`,
              } as React.CSSProperties}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
