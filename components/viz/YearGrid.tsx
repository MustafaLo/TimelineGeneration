"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { PersonData } from "@/types/timeline";
import { NotableEvent } from "@/lib/eventCache";

const CURRENT_YEAR = 2026;
const EXTENSION    = 25;
const MAX_SQUARES  = 100;
const GAP          = 3;     // px — gap between squares
const PEAK_SCALE   = 1.4;   // scale of the directly hovered square
const LIFT_R       = 0.32;  // upward lift as fraction of squareSize

// Space consumed by tooltip + margins + axis (px) — used when computing square size
const CHROME_HEIGHT = 124;

// Opacity levels
const OP_ALIVE     = 0.2;
const OP_GHOST     = 0.07;
const OP_EVT_ALIVE = 0.78;
const OP_EVT_GHOST = 0.32;

interface Props {
  person:   PersonData;
  barColor: string;
  events:   NotableEvent[];
  loading:  boolean;
}

export default function YearGrid({ person, barColor, events, loading }: Props) {
  const outerRef      = useRef<HTMLDivElement>(null);
  const squareRefs    = useRef<(HTMLDivElement | null)[]>([]);

  interface QtSet { scale: (v: number) => void; y: (v: number) => void; }
  const quickTosRef   = useRef<QtSet[]>([]);
  const entranceRef   = useRef<gsap.core.Tween | null>(null);
  const hasEnteredRef = useRef(false);

  const [squareSize, setSquareSize] = useState(16); // will be overridden
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [dividerVisible, setDividerVisible] = useState(false);

  // ── Grid geometry ──────────────────────────────────────────────────────────
  const isAlive   = person.death_year === null;
  const deathYear = person.death_year ?? CURRENT_YEAR;
  const gridEnd   = isAlive
    ? CURRENT_YEAR
    : Math.min(deathYear + EXTENSION, CURRENT_YEAR);

  const totalYears = gridEnd - person.birth_year + 1;
  const step       = Math.max(1, Math.ceil(totalYears / MAX_SQUARES));

  const years: number[] = [];
  for (let y = person.birth_year; y <= gridEnd; y += step) years.push(y);

  // ── Map events into year buckets ───────────────────────────────────────────
  const eventMap = new Map<number, NotableEvent>();
  events.forEach((evt) => {
    for (let i = 0; i < years.length; i++) {
      const start = years[i];
      const end   = i < years.length - 1 ? years[i + 1] : gridEnd + step;
      if (evt.year >= start && evt.year < end) {
        if (!eventMap.has(start)) eventMap.set(start, evt);
        break;
      }
    }
  });

  // ── Compute optimal square size to fill the container ─────────────────────
  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const compute = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;

      const availW = width;
      const availH = Math.max(60, height - CHROME_HEIGHT);
      const n      = years.length;

      // Find column count C that maximises square size while fitting both axes
      let bestSize = 12;
      for (let c = 3; c <= n; c++) {
        const r  = Math.ceil(n / c);
        const ws = (availW - (c - 1) * GAP) / c;
        const hs = (availH - (r - 1) * GAP) / r;
        const sz = Math.floor(Math.min(ws, hs));
        if (sz > bestSize) bestSize = sz;
        // once size starts decreasing noticeably, stop searching
        if (sz < bestSize * 0.85) break;
      }

      setSquareSize(Math.max(12, Math.min(bestSize, 56)));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [years.length]);

  // ── Final opacity per square ───────────────────────────────────────────────
  function finalOp(i: number): number {
    const year   = years[i];
    const inLife = year <= deathYear;
    const hasEvt = eventMap.has(year);
    if (hasEvt) return inLife ? OP_EVT_ALIVE : OP_EVT_GHOST;
    return inLife ? OP_ALIVE : OP_GHOST;
  }

  // ── Entrance animation — re-runs when person changes ──────────────────────
  useEffect(() => {
    hasEnteredRef.current = false;
    quickTosRef.current   = [];
    setDividerVisible(false);

    const els = squareRefs.current.filter(Boolean) as HTMLDivElement[];
    if (els.length === 0) return;

    entranceRef.current?.kill();
    gsap.killTweensOf(els);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const makeQts = (el: HTMLDivElement): QtSet => ({
      scale: gsap.quickTo(el, "scale", { duration: 0.25, ease: "power2.out" }),
      y    : gsap.quickTo(el, "y",     { duration: 0.25, ease: "power2.out" }),
    });

    if (reduced) {
      gsap.set(els, { opacity: (i: number) => finalOp(i), scale: 1, x: 0, y: 0 });
      hasEnteredRef.current = true;
      quickTosRef.current   = els.map(makeQts);
      setDividerVisible(true);
    } else {
      gsap.set(els, { opacity: 0, scale: 0.35, x: 0, y: 0 });
      entranceRef.current = gsap.to(els, {
        opacity : (i: number) => finalOp(i),
        scale   : 1,
        duration: 0.4,
        stagger : { amount: 0.65, from: "start" },
        ease    : "power3.out",
        onComplete() {
          hasEnteredRef.current = true;
          quickTosRef.current   = (
            squareRefs.current.filter(Boolean) as HTMLDivElement[]
          ).map(makeQts);
          setDividerVisible(true);
        },
      });
    }

    return () => {
      entranceRef.current?.kill();
      gsap.killTweensOf(els);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.name]);

  // ── Highlight event squares when events arrive after entrance ──────────────
  useEffect(() => {
    if (events.length === 0 || !hasEnteredRef.current) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    years.forEach((y, i) => {
      if (!eventMap.has(y)) return;
      const el = squareRefs.current[i];
      if (!el) return;
      const inLife = y <= deathYear;
      gsap.to(el, {
        opacity : inLife ? OP_EVT_ALIVE : OP_EVT_GHOST,
        duration: reduced ? 0 : 0.32,
        delay   : reduced ? 0 : i * 0.006,
        ease    : "power2.out",
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // ── Hover: lift the closest square, neighbours barely affected ────────────
  // Tight quadratic falloff — only 1–2 squares ever visibly move.
  // y lift only (no x) — squares never overlap.
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const qts     = quickTosRef.current;
    if (qts.length === 0) return;

    const pitch   = squareSize + GAP;
    const bound   = squareSize * 2.2;
    const maxLift = squareSize * LIFT_R;

    let closestDist = Infinity;
    let closestIdx: number | null = null;

    squareRefs.current.forEach((el, i) => {
      if (!el || !qts[i]) return;

      const rect = el.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);

      const t  = Math.max(0, 1 - dist / bound);
      const t2 = t * t;

      qts[i].scale(1 + (PEAK_SCALE - 1) * t2);
      qts[i].y(-maxLift * t2);

      if (dist < pitch * 0.7 && dist < closestDist) {
        closestDist = dist;
        closestIdx  = i;
      }
    });

    setHoveredIdx(closestIdx);
  }

  function handleMouseLeave() {
    quickTosRef.current.forEach((qt) => {
      if (!qt) return;
      qt.scale(1);
      qt.y(0);
    });
    setHoveredIdx(null);
  }

  const fmt = (y: number) => (y < 0 ? `${Math.abs(y)} bce` : String(y));

  return (
    <div
      ref={outerRef}
      style={{
        display      : "flex",
        flexDirection: "column",
        height       : "100%",
      }}
    >
      {/* ── Event tooltip — fixed height, only shows for event squares ────── */}
      <div
        style={{
          flexShrink    : 0,
          height        : "2.25rem",
          display       : "flex",
          alignItems    : "center",
          justifyContent: "center",
        }}
      >
        {hoveredIdx !== null && eventMap.has(years[hoveredIdx]) ? (() => {
          const event = eventMap.get(years[hoveredIdx])!;
          return (
            <div
              style={{
                backgroundColor: "var(--bg-subtle)",
                border         : "1px solid var(--border)",
                borderRadius   : "3px",
                padding        : "0.3rem 0.7rem",
                fontFamily     : "var(--font-mono)",
                fontSize       : "0.625rem",
                color          : "var(--fg)",
                letterSpacing  : "0.03em",
                whiteSpace     : "nowrap",
                boxShadow      : "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <span style={{ color: "var(--fg-muted)", marginRight: "0.5rem" }}>
                {event.year < 0
                  ? `${Math.abs(event.year)} bce`
                  : String(event.year)}
              </span>
              {event.label}
            </div>
          );
        })() : loading ? (
          <span
            style={{
              fontFamily   : "var(--font-mono)",
              fontSize     : "0.52rem",
              color        : "var(--fg-muted)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              opacity      : 0.3,
            }}
          >
            loading events…
          </span>
        ) : null}
      </div>

      {/* ── Age text — separate, always shows on hover ──────────────────────── */}
      <div
        style={{
          flexShrink    : 0,
          height        : "1.4rem",
          display       : "flex",
          alignItems    : "center",
          justifyContent: "center",
          marginBottom  : "0.5rem",
        }}
      >
        {hoveredIdx !== null && (() => {
          const year     = years[hoveredIdx];
          const age      = year - person.birth_year;
          const inLife   = year <= deathYear;
          const yrsAfter = inLife ? 0 : year - deathYear;
          return (
            <span
              style={{
                fontFamily   : "var(--font-mono)",
                fontSize     : "0.575rem",
                color        : "var(--fg-muted)",
                letterSpacing: "0.06em",
                opacity      : inLife ? 0.6 : 0.85,
              }}
            >
              {inLife
                ? `age ${age}`
                : `† ${yrsAfter} yr${yrsAfter === 1 ? "" : "s"} after death`}
            </span>
          );
        })()}
      </div>

      {/* ── Year grid — fills remaining space ──────────────────────────────── */}
      <div
        onMouseMove ={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          flex        : 1,
          display     : "flex",
          flexWrap    : "wrap",
          gap         : `${GAP}px`,
          alignContent: "center",
          overflow    : "hidden",
        }}
      >
        {years.map((year, i) => {
          const inLife      = year <= deathYear;
          const hasEvt      = eventMap.has(year);
          const isLastAlive = !isAlive && inLife &&
            (i + 1 >= years.length || years[i + 1] > deathYear);

          return (
            <React.Fragment key={year}>
              <div
                ref={(el) => { squareRefs.current[i] = el; }}
                style={{
                  width          : `${squareSize}px`,
                  height         : `${squareSize}px`,
                  flexShrink     : 0,
                  backgroundColor: hasEvt
                    ? (inLife ? barColor : "var(--fg-muted)")
                    : (inLife ? "var(--fg)" : "var(--fg-muted)"),
                  borderRadius   : `${Math.max(1.5, squareSize * 0.08)}px`,
                  transformOrigin: "center",
                  willChange     : "transform",
                }}
              />
              {isLastAlive && (
                <div style={{
                  width          : "1px",
                  height         : `${Math.round(squareSize * 0.6)}px`,
                  flexShrink     : 0,
                  backgroundColor: "var(--fg)",
                  opacity        : dividerVisible ? 0.3 : 0,
                  transition     : "opacity 0.4s ease",
                  alignSelf      : "center",
                  margin         : "0 5px",
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Axis labels ────────────────────────────────────────────────────── */}
      <div
        style={{
          flexShrink    : 0,
          display       : "flex",
          justifyContent: "space-between",
          alignItems    : "center",
          marginTop     : "0.75rem",
          fontFamily    : "var(--font-mono)",
          fontSize      : "0.52rem",
          letterSpacing : "0.08em",
          color         : "var(--fg-muted)",
          opacity       : 0.45,
        }}
      >
        <span>{fmt(person.birth_year)}</span>

        {!isAlive && (
          <span style={{ color: "var(--fg)", opacity: 0.55 }}>
            † {fmt(deathYear)}
          </span>
        )}

        <span style={{ color: isAlive ? "var(--accent)" : undefined }}>
          {isAlive ? "present" : fmt(gridEnd)}
        </span>
      </div>
    </div>
  );
}
