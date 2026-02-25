# Modal Visualizations — Plan

## Context

When a user clicks a timeline bar, a postcard-proportioned modal opens.
- **Left half**: biographical info (name, dates, lifespan, category) — ✅ done
- **Right half**: interactive visualizations — ⏳ this plan

The right panel will have **3 toggle views**. The user switches between them via small
toggle buttons at the top of the right panel. GSAP powers the morphing transitions
between views.

GSAP skill already installed: `martinholovsky-gsap` (symlinked in `.claude/skills/`).

---

## The Three Visualizations

### 1. Radial Life Clock
A circular dial representing the person's entire lifespan.

**Concept:**
- A thin background ring drawn in a muted tone
- A filled arc sweeps from birth to death (or present), in the person's bar color
- Center text: lifespan in years (e.g. "39 yrs")
- Below center: birth year on the left, death year on the right flanking the arc

**GSAP animation (on enter):**
- Arc draws in via `gsap.to()` on SVG `stroke-dashoffset` from full circumference → 0
- Duration ~900ms, ease: `power3.out`
- Center number counts up from 0 using a GSAP tween on a displayed value

**GSAP animation (switching from another view):**
- Outgoing view: `opacity 0, scale 0.92` (~220ms)
- Incoming clock: fade + scale up from `0.92 → 1` after outgoing finishes

---

### 2. Age Gap Float
Shows this person's lifespan bar floating alongside all other people currently in the
timeline, so you can immediately see how they compare.

**Concept:**
- Horizontal mini-timeline showing all loaded people as small bars, sorted by birth year
- The selected person's bar is highlighted (brighter color, slightly taller)
- A subtle label below: e.g. "3rd longest lived" or "born earliest"
- Shared time axis at the bottom

**GSAP animation (on enter):**
- Bars float up from `y: 16, opacity: 0` with a stagger of ~40ms per bar
  (`gsap.from(bars, { y: 16, opacity: 0, stagger: 0.04, ease: "power2.out" })`)
- Highlighted bar enters last and slightly larger
- Annotation label fades in after bars settle (~300ms delay)

**GSAP animation (switching views):**
- Bars scatter outward (`y: -12, opacity: 0, stagger: 0.025`) then incoming view mounts

**Extra data needed:**
- Full `TimelineData` must be passed into the modal so this view can render all bars,
  not just the selected person's.

---

### 3. Overlap Density Wave
A filled area chart showing how many people in the timeline were alive concurrently
with this person — a density wave over time.

**Concept:**
- X-axis: years (full range of loaded data, or scoped ±50yrs around this person)
- Y-axis: count of contemporaries alive at each point
- Smooth filled SVG area path (`<path>` with cubic bezier curves)
- The selected person's birth→death span is shaded differently underneath
- Optional: a vertical scrub line on hover that shows the count at that year

**GSAP animation (on enter):**
- Area path reveals left → right using a `clip-path: inset(0 100% 0 0)` animated to
  `inset(0 0% 0 0)`, duration ~800ms, ease `power3.inOut`
- Fill opacity fades in separately after stroke finishes (~200ms delay)
- The person's personal range band fades in last

**GSAP animation (switching views):**
- Path shrinks downward (`scaleY: 0, transformOrigin: "bottom"`) then incoming mounts
- Fallback crossfade if MorphSVG unavailable

**Extra data needed:** Same as Age Gap Float — full `TimelineData` required.

---

## Implementation Steps

### Step 1 — Pass `allData` into the modal
- `page.tsx`: add `allData={timelineData}` prop to `<PersonModal>`
- `PersonModal.tsx`: accept `allData: TimelineData` prop; pass it into Age Gap + Wave

### Step 2 — Toggle UI in right panel
- Three small pill/tab buttons at the top of the right panel
- Labels: "Clock", "Compare", "Overlap" (or icon-only if space is tight)
- DM Mono, tiny caps, muted; active state uses the person's bar color as underline
- State: `activeViz: "clock" | "compare" | "overlap"` in `PersonModal`
- Default: `"clock"` (most self-contained, no allData dependency)

### Step 3 — Build each viz as its own component
```
components/viz/RadialLifeClock.tsx    — receives: person, barColor
components/viz/AgeGapFloat.tsx        — receives: person, barColor, allData
components/viz/OverlapDensityWave.tsx — receives: person, barColor, allData
```
Each component runs its GSAP enter timeline inside `useEffect` on mount.

### Step 4 — Transition between views
- Manage with a `transitioning: boolean` state flag to prevent double-clicks mid-anim
- On toggle:
  1. Set `transitioning = true`
  2. Play exit tween on current view (~220ms)
  3. Unmount current, mount next
  4. Incoming component runs its own enter tween on mount
  5. Set `transitioning = false`

### Step 5 — Reduced motion
- Wrap all GSAP calls in `gsap.matchMedia()`:
  - `prefers-reduced-motion: reduce` → skip tweens, show final state instantly
  - Default → full animation

---

## Open Questions (resolve before building)

| # | Question | Suggestion |
|---|----------|------------|
| 1 | Does the installed GSAP skill include MorphSVG plugin? | Check skill file; if not, use crossfade fallback for Wave transition |
| 2 | Age Gap Float — show names on mini bars? | Start with colors only; names on tooltip on hover |
| 3 | Overlap wave X-axis scope — full timeline range or ±50yr window? | Full range; more context |
| 4 | Toggle button style — text labels or icons? | Text labels (DM Mono caps) — consistent with app typography |

---

## Files to create / modify

| File | Action |
|---|---|
| `components/PersonModal.tsx` | Add toggle state, `allData` prop, viz switcher in right panel |
| `app/page.tsx` | Pass `allData={timelineData}` to PersonModal |
| `components/viz/RadialLifeClock.tsx` | Create |
| `components/viz/AgeGapFloat.tsx` | Create |
| `components/viz/OverlapDensityWave.tsx` | Create |
