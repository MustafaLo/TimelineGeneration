"use client";

import { useEffect, useRef, useState } from "react";
import { PersonData, TimelineData } from "@/types/timeline";
import { eventCache, NotableEvent } from "@/lib/eventCache";
import RadialLifeClock from "@/components/viz/RadialLifeClock";
import RadialAgeClock  from "@/components/viz/RadialAgeClock";
import YearGrid        from "@/components/viz/YearGrid";

const CURRENT_YEAR = 2026;
const CLOSE_DURATION = 340;

type ActiveViz = "clock" | "compare" | "years";

const VIZ_TABS: { key: ActiveViz; label: string }[] = [
  { key: "clock",   label: "Age"      },
  { key: "compare", label: "Overlaps" },
  { key: "years",   label: "Events"   },
];

interface PersonModalProps {
  person: PersonData;
  barColor: string;
  allData: TimelineData;
  onClose: () => void;
}

function formatYear(y: number): string {
  return y < 0 ? `${Math.abs(y)} BCE` : String(y);
}

export default function PersonModal({ person, barColor, allData, onClose }: PersonModalProps) {
  const [closing, setClosing] = useState(false);
  const [activeViz, setActiveViz] = useState<ActiveViz>("clock");
  const [transitioning, setTransitioning] = useState(false);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // ── Events data — fetched once per person on modal open ───────────────────
  const [gridEvents, setGridEvents] = useState<NotableEvent[]>(() =>
    eventCache.get(person.name) ?? []
  );
  const [eventsLoading, setEventsLoading] = useState(
    !eventCache.has(person.name)
  );

  useEffect(() => {
    if (eventCache.has(person.name)) return; // already cached

    let cancelled = false;
    setEventsLoading(true);

    fetch("/api/events", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({
        name      : person.name,
        birth_year: person.birth_year,
        death_year: person.death_year,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const events: NotableEvent[] = Array.isArray(data.events) ? data.events : [];
        eventCache.set(person.name, events);
        setGridEvents(events);
      })
      .catch(() => {
        if (!cancelled) setGridEvents([]);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });

    return () => { cancelled = true; };
  }, [person.name, person.birth_year, person.death_year]);

  function handleClose() {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, CLOSE_DURATION);
  }

  function handleTabClick(key: ActiveViz) {
    if (transitioning || key === activeViz) return;
    setTransitioning(true);
    // Brief lock — viz components will own the real transition timing in later tasks
    setTimeout(() => {
      setActiveViz(key);
      setTransitioning(false);
    }, 220);
  }

  // Slide the underline indicator to the active tab
  useEffect(() => {
    const idx = VIZ_TABS.findIndex((t) => t.key === activeViz);
    const btn = tabRefs.current[idx];
    const ind = indicatorRef.current;
    if (!btn || !ind) return;

    const parent = btn.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();

    ind.style.width  = `${btnRect.width}px`;
    ind.style.left   = `${btnRect.left - parentRect.left}px`;
  }, [activeViz]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closing]);

  // ── Computed biographical data ────────────────────────────────────────────
  const isAlive = person.death_year === null;
  const lifespan = isAlive
    ? CURRENT_YEAR - person.birth_year
    : person.death_year! - person.birth_year;

  const birthStr    = formatYear(person.birth_year);
  const deathStr    = isAlive ? "present" : formatYear(person.death_year!);
  const lifespanStr = isAlive ? `${lifespan}+ years` : `${lifespan} years`;

  // ── Contemporaries — others in this chart whose lifespan overlapped ───────
  const personEnd = person.death_year ?? CURRENT_YEAR;
  const contemporaries = allData.filter((p) => {
    if (p.name === person.name) return false;
    const otherEnd = p.death_year ?? CURRENT_YEAR;
    return person.birth_year <= otherEnd && p.birth_year <= personEnd;
  });

  // ── Animations ────────────────────────────────────────────────────────────
  const backdropAnim: React.CSSProperties = {
    animation: closing
      ? `modal-fade-out ${CLOSE_DURATION}ms cubic-bezier(0.7,0,0.3,1) both`
      : "modal-fade-in 300ms ease both",
  };
  const cardAnim: React.CSSProperties = {
    animation: closing
      ? `modal-card-out ${CLOSE_DURATION}ms cubic-bezier(0.7,0,0.3,1) both`
      : "modal-card-in 420ms cubic-bezier(0.7,0,0.3,1) both",
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        backgroundColor: "rgba(10, 8, 6, 0.55)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        ...backdropAnim,
      }}
    >
      {/* ── Card — postcard proportions 6:4.25 ────────────────────────────── */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(900px, calc(100vw - 3rem))",
          aspectRatio: "6 / 4.25",
          backgroundColor: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "20px",
          overflow: "hidden",
          display: "flex",
          boxShadow:
            "0 40px 100px rgba(0,0,0,0.28), 0 8px 32px rgba(0,0,0,0.14)",
          ...cardAnim,
        }}
      >
        {/* Top color strip — echoes the person's bar color */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            backgroundColor: barColor,
            opacity: 0.8,
            zIndex: 1,
          }}
        />

        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "1.25rem",
            right: "1.375rem",
            zIndex: 10,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--fg-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: "1.25rem",
            lineHeight: 1,
            opacity: 0.35,
            padding: "0.25rem 0.375rem",
            transition: "opacity 150ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.35")}
        >
          ×
        </button>

        {/* ── Left panel — biographical info ─────────────────────────────── */}
        <div
          style={{
            flex: "0 0 50%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "3rem 3.5rem",
          }}
        >
          {/* Name */}
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 3.5vw, 3.25rem)",
              fontWeight: 300,
              color: "var(--fg)",
              letterSpacing: "-0.025em",
              lineHeight: 0.92,
              marginBottom: "0.75rem",
            }}
          >
            {person.name}
          </h2>

          {/* Category + badges */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              marginBottom: "2rem",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.6rem",
                color: "var(--fg-muted)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                opacity: 0.7,
              }}
            >
              {person.category}
            </span>

            {isAlive && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.55rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  border: "1px solid currentColor",
                  padding: "0.1rem 0.4rem",
                  opacity: 0.9,
                }}
              >
                living
              </span>
            )}

            {person.approximate && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.55rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--fg-muted)",
                  border: "1px solid var(--border)",
                  padding: "0.1rem 0.4rem",
                  opacity: 0.6,
                }}
              >
                approx.
              </span>
            )}
          </div>

          {/* Hairline rule */}
          <div
            style={{
              height: "1px",
              backgroundColor: "var(--border)",
              marginBottom: "1.75rem",
            }}
          />

          {/* Epitaph */}
          {person.description && (
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(0.85rem, 1.4vw, 1.05rem)",
                fontWeight: 300,
                fontStyle: "italic",
                color: "var(--fg)",
                lineHeight: 1.55,
                opacity: 0.72,
                marginBottom: "1.75rem",
              }}
            >
              {person.description}
            </p>
          )}

          {/* Contemporaries */}
          {contemporaries.length > 0 && (
            <div>
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.55rem",
                  color: "var(--fg-muted)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  opacity: 0.45,
                  marginBottom: "0.75rem",
                }}
              >
                Shared the world with
              </span>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {contemporaries.slice(0, 5).map((p) => (
                  <li
                    key={p.name}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "0.5rem",
                      marginBottom: "0.35rem",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.5rem",
                        color: "var(--fg-muted)",
                        opacity: 0.35,
                        flexShrink: 0,
                      }}
                    >
                      —
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.72rem",
                        color: "var(--fg)",
                        opacity: 0.6,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {p.name}
                    </span>
                  </li>
                ))}
                {contemporaries.length > 5 && (
                  <li
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.58rem",
                      color: "var(--fg-muted)",
                      opacity: 0.35,
                      letterSpacing: "0.06em",
                      marginTop: "0.1rem",
                      paddingLeft: "1rem",
                    }}
                  >
                    and {contemporaries.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* ── Vertical hairline divider ───────────────────────────────────── */}
        <div
          style={{
            width: "1px",
            backgroundColor: "var(--border)",
            alignSelf: "stretch",
            margin: "2rem 0",
          }}
        />

        {/* ── Right panel — visualizations ───────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "2.25rem 2.75rem",
            minWidth: 0,
          }}
        >
          {/* ── Toggle tabs ──────────────────────────────────────────────── */}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 0,
              marginBottom: "2rem",
            }}
          >
            {VIZ_TABS.map(({ key, label }, i) => {
              const isActive = activeViz === key;
              return (
                <button
                  key={key}
                  ref={(el) => { tabRefs.current[i] = el; }}
                  onClick={() => handleTabClick(key)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: transitioning ? "default" : "pointer",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.575rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: isActive ? "var(--fg)" : "var(--fg-muted)",
                    opacity: isActive ? 1 : 0.38,
                    padding: "0.375rem 0",
                    marginRight: i < VIZ_TABS.length - 1 ? "1.75rem" : 0,
                    transition: "color 200ms ease, opacity 200ms ease",
                    userSelect: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.opacity = "0.65";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.opacity = "0.38";
                  }}
                >
                  {label}
                </button>
              );
            })}

            {/* Sliding underline indicator */}
            <span
              ref={indicatorRef}
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                height: "1px",
                backgroundColor: barColor,
                opacity: 0.85,
                transition: "left 280ms cubic-bezier(0.7,0,0.3,1), width 280ms cubic-bezier(0.7,0,0.3,1)",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* ── Visualization area ─────────────────────────────────────────── */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {activeViz === "clock" && (
              <RadialLifeClock person={person} barColor={barColor} />
            )}
            {activeViz === "compare" && (
              <RadialAgeClock person={person} barColor={barColor} allData={allData} />
            )}
            {activeViz === "years" && (
              <YearGrid
                person={person}
                barColor={barColor}
                events={gridEvents}
                loading={eventsLoading}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Viz placeholder — shown while Compare / Overlap are not yet built ─────────
function VizPlaceholder({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.55rem",
          color: "var(--fg-muted)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          opacity: 0.2,
        }}
      >
        {label} — coming soon
      </span>
    </div>
  );
}

// ── Data row ───────────────────────────────────────────────────────────────
function DataRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.6rem",
          color: "var(--fg-muted)",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          opacity: 0.5,
          minWidth: "5.25rem",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.9375rem",
          color: accent ? "var(--accent)" : "var(--fg)",
          letterSpacing: "0.02em",
        }}
      >
        {value}
      </span>
    </div>
  );
}
