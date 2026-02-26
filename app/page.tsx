"use client";

import { useState, useEffect, useRef } from "react";
import InputBar from "@/components/InputBar";
import NameList from "@/components/NameList";
import ThemeToggle from "@/components/ThemeToggle";
import TimelineChart from "@/components/TimelineChart";
import ChartSkeleton from "@/components/ChartSkeleton";
import LoadingAnimation from "@/components/LoadingAnimation";
import PersonModal from "@/components/PersonModal";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { TimelineData, AppState, PersonData } from "@/types/timeline";

export default function Home() {
  const [names, setNames] = useLocalStorage<string[]>("tg_pending_names", []);
  const [appState, setAppState] = useState<AppState>("landing");
  const [timelineData, setTimelineData, isHydrated] = useLocalStorage<TimelineData | null>(
    "tg_timeline_data",
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [namesHidden, setNamesHidden] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonData | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>("");

  // Skeleton state — shown only on the first generation (before any data exists)
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [skeletonExiting, setSkeletonExiting] = useState(false);
  const hasReceivedDataRef = useRef(false);

  // Landing transition
  const [landingVisible, setLandingVisible] = useState(false);
  const [appVisible, setAppVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setLandingVisible(true));
  }, []);

  // On hydration: if stored chart data exists, bypass landing and go straight to chart
  useEffect(() => {
    if (isHydrated && timelineData && timelineData.length > 0 && appState === "landing") {
      hasReceivedDataRef.current = true;
      setAppState("input");
      setLandingVisible(false);
      setAppVisible(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  function handleBegin() {
    setLandingVisible(false);
    setTimeout(() => {
      setAppState("input");
      requestAnimationFrame(() => setAppVisible(true));
    }, 650);
  }

  function handleAddName(name: string) {
    setNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setNamesHidden(false); // reveal list when user adds a name after generating
  }

  function handleRemoveName(name: string) {
    setNames((prev) => prev.filter((n) => n !== name));
  }

  function handleRemovePersonFromChart(name: string) {
    setTimelineData((prev) => {
      if (!prev) return null;
      const next = prev.filter((p) => p.name !== name);
      return next.length === 0 ? null : next;
    });
    if (selectedPerson?.name === name) setSelectedPerson(null);
  }

  function handleClearChart() {
    setTimelineData(null);
    setSelectedPerson(null);
    setNames([]);
  }

  function dismissSkeleton() {
    setSkeletonExiting(true);
    setTimeout(() => setShowSkeleton(false), 500);
  }

  async function handleGenerate() {
    if (names.length === 0) return;

    // Show the skeleton chart frame on the very first generation
    const isFirstGen = !hasReceivedDataRef.current;
    if (isFirstGen) {
      setShowSkeleton(true);
      setSkeletonExiting(false);
    }

    setNamesHidden(true); // immediate — names vanish before API returns
    setAppState("loading");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(json.error ?? "Something went wrong.");
        setAppState("error");
        if (isFirstGen) dismissSkeleton();
        return;
      }

      // Fade skeleton out as real chart fades in
      if (isFirstGen) dismissSkeleton();
      hasReceivedDataRef.current = true;

      setTimelineData((prev) => {
        if (!prev) return json.data;
        // Merge new people into existing chart, skipping exact name duplicates
        const existingNames = new Set(prev.map((p) => p.name));
        const fresh = json.data.filter((p: import("@/types/timeline").PersonData) => !existingNames.has(p.name));
        return [...prev, ...fresh];
      });
      setNames([]); // clear so old names don't reappear on next input
      setAppState("input");
    } catch {
      setErrorMessage("Network error. Check your connection and try again.");
      setAppState("error");
      if (isFirstGen) dismissSkeleton();
    }
  }

  const isLoading = appState === "loading";

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "var(--bg)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <ThemeToggle />

      {/* ── Clear chart button (top-left, mirrors ThemeToggle) ───────────────── */}
      <button
        onClick={handleClearChart}
        title="Clear chart"
        aria-label="Clear chart"
        style={{
          position: "fixed",
          top: "1.25rem",
          left: "1.25rem",
          zIndex: 100,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--fg-muted)",
          padding: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: timelineData ? 0.5 : 0,
          pointerEvents: timelineData ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
        onMouseEnter={(e) => { if (timelineData) e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = timelineData ? "0.5" : "0"; }}
      >
        {/* Eraser icon — fits the ink-on-paper metaphor */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
          <path d="M22 21H7" />
          <path d="m5 11 9 9" />
        </svg>
      </button>

      {/* ── Landing screen ───────────────────────────────────────────────── */}
      {appState === "landing" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: landingVisible ? 1 : 0,
            transition: "opacity 0.6s var(--ease-physical)",
            pointerEvents: landingVisible ? "auto" : "none",
            zIndex: 20,
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(3rem, 8vw, 7rem)",
              fontWeight: 300,
              color: "var(--fg)",
              letterSpacing: "-0.03em",
              lineHeight: 0.95,
              textAlign: "center",
              userSelect: "none",
            }}
          >
            Timelines
          </h1>

          <div
            style={{
              width: "2rem",
              height: "1px",
              backgroundColor: "var(--border)",
              margin: "1.75rem 0 1.5rem",
            }}
          />

          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.6875rem",
              color: "var(--fg-muted)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              opacity: 0.65,
              userSelect: "none",
            }}
          >
            a chart of biography based on Priestley&apos;s 1815 charts
          </p>

          <button
            onClick={handleBegin}
            style={{
              marginTop: "5rem",
              background: "none",
              border: "none",
              borderBottom: "1px solid var(--border)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.875rem",
              color: "var(--fg-muted)",
              cursor: "pointer",
              letterSpacing: "0.08em",
              padding: "0.25rem 0.75rem 0.4rem",
              transition: "color 0.2s, border-color 0.2s",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.color = "var(--accent)";
              el.style.borderBottomColor = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.color = "var(--fg-muted)";
              el.style.borderBottomColor = "var(--border)";
            }}
          >
            begin →
          </button>
        </div>
      )}

      {/* ── App layer ────────────────────────────────────────────────────── */}
      {appState !== "landing" && (
        <div
          style={{
            opacity: appVisible ? 1 : 0,
            transition: "opacity 0.5s var(--ease-physical)",
          }}
        >
          {/* Skeleton — axis + placeholder grid lines drawn during first generation */}
          {showSkeleton && <ChartSkeleton exiting={skeletonExiting} />}

          {/* Chart — always visible, even while loading new names */}
          {timelineData && (
            <TimelineChart
              data={timelineData}
              onPersonClick={(person, color) => {
                setSelectedPerson(person);
                setSelectedColor(color);
              }}
              onRemovePerson={handleRemovePersonFromChart}
            />
          )}

          {/* Loading animation — sailing ship on waves (hidden for now, may restore later) */}
          {/* {appState === "loading" && <LoadingAnimation />} */}

          {/* Input bar — always floating above chart */}
          <InputBar
            onSubmitName={handleAddName}
            onGenerate={handleGenerate}
            isLoading={isLoading}
            disabled={isLoading}
          />

          {/* Name list — fades out after generate */}
          <NameList
            names={names}
            onRemove={handleRemoveName}
            onGenerate={handleGenerate}
            isLoading={isLoading}
            hidden={namesHidden}
          />

          {/* Error */}
          {appState === "error" && errorMessage && (
            <div
              style={{
                position: "fixed",
                bottom: "3rem",
                left: "50%",
                transform: "translateX(-50%)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.8125rem",
                color: "var(--accent)",
                letterSpacing: "0.02em",
                textAlign: "center",
                zIndex: 60,
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Empty state — only shown before first generate */}
          {!timelineData && names.length === 0 && (
            <div
              style={{
                position: "fixed",
                bottom: "3rem",
                left: "50%",
                transform: "translateX(-50%)",
                fontFamily: "var(--font-display)",
                fontSize: "1.125rem",
                fontStyle: "italic",
                color: "var(--fg-muted)",
                opacity: 0.5,
                letterSpacing: "0.01em",
                textAlign: "center",
                pointerEvents: "none",
                zIndex: 1,
              }}
            >
              Enter names above — anyone from Cleopatra to Kanye West
            </div>
          )}
        </div>
      )}
      {/* Person modal — opens on bar click */}
      {selectedPerson && (
        <PersonModal
          person={selectedPerson}
          barColor={selectedColor}
          allData={timelineData ?? []}
          onClose={() => setSelectedPerson(null)}
        />
      )}
    </main>
  );
}
