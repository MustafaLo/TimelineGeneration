# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**TimelineGenerator** is a Next.js web app that generates beautiful, animated biographical timeline charts in the style of Joseph Priestley's 1765 "Chart of Biography."

The user inputs a list of people (anyone from Cleopatra to Kanye West to themselves), an AI model returns their birth and death dates, and the app renders an animated horizontal timeline where each person is a bar spanning their lifespan on a shared time axis.

## Core User Flow

1. User types names into an input list (one at a time, added to a collection)
2. User clicks **Generate** — all names are sent to the AI at once
3. AI returns structured data: name, birth year, death year (or null if living), and an inferred category
4. App renders the animated timeline chart

## Key Features

### Timeline Chart
- X-axis = time (auto-scaled to fit the full range of all people entered)
- Each person = a horizontal bar spanning birth → death
- **Living people**: solid bar from birth to today (2026), then a **dotted line + arrow** indicating they're still alive
- Bars are grouped vertically by **AI-inferred category** (e.g. Scientists, Rulers, Artists, Athletes, Musicians, Writers)
- Name label displayed on or near the bar
- Approximate dates are acceptable and expected for historical figures

### AI Integration
- The AI call handles: date lookup + category inference in a single structured response
- Response schema per person: `{ name, birth_year, death_year | null, category, approximate: boolean }`
- If input is complete gibberish, the AI should omit that entry or flag it
- API key approach: TBD (user-supplied key via settings UI, or developer-provided env var)

### Design Principles

This site must feel authored and distinctly non-AI. Every choice should be deliberate. Reference sites that embody the right quality: whatarethechords.com, joinscraps.com, liumichelle.com — study what makes them feel human-designed before writing any UI code.

#### Theme & Color
- **Light mode**: cream/parchment background ~`#f0ead6`, not pure white
- **Dark mode**: warm dark gray ~`#1c1a17`, not pure black
- Both modes should feel warm and considered, not clinical
- A single muted accent color — deep amber or aged terracotta — used sparingly: active input state, hover highlights, one or two key moments only
- Category bar colors are very desaturated, like faded ink — no bright or saturated palette
- Use CSS variables for all color tokens to make mode-switching clean

#### Typography
- **Display / headings**: A distinctive historical serif — Cormorant Garamond or similar. Must feel refined and slightly literary, nodding to the 18th century chart inspiration without being costumey
- **Input / data / labels**: A clean monospaced font (e.g. DM Mono, iA Writer Mono, or similar). Signals precision and the "typed query" nature of the input. Bar name labels use this.
- **Absolutely no**: Inter, Roboto, Arial, Helvetica, Space Grotesk, or any system sans-serif default
- Type scale should be restrained — few sizes, large contrast between display and body

#### Layout
- The **chart dominates** — it is the entire page. Nothing competes with it.
- Whitespace is a design tool, not an accident. Let the chart breathe.
- No sidebars, panels, or sectioned-off regions. The UI is ambient.
- Category labels rotated 90° along the left edge of each group, like spine text on a book — quiet but unexpected
- One unconventional layout detail is required; do not default to a safe, symmetric grid

#### Input
- The input line floats at the top of the screen, blended into the background — not a boxed form element
- Visually: just a blinking cursor and a hairline underline rule. No border-box, no rounded corners, no filled background, no label above it
- It should feel like writing directly onto the canvas
- **Draggable**: the input can be repositioned anywhere on the screen via a subtle, small drag handle. This is a key interaction detail.
- Submitted names appear as a quiet list, understated, not card-based or bubbly

#### Animations
Use `cubic-bezier(0.7, 0, 0.3, 1)` or similar physical easing — slow start, fast middle, slow end. Nothing bouncy or springy. Motion should feel like it has weight.

**Bar entrance animation (the most important animation):**
- Bars draw in left-to-right, tracing from birth year to death year, like ink being pulled across the page
- Slight deceleration at the end of each bar — like a pen slowing as it lifts
- Category groups stagger: each group starts ~100ms after the previous
- Within a group, individual bars stagger by ~60–80ms
- Name labels fade in (opacity 0 → 1, ~200ms) only after their bar finishes drawing — never before
- The time axis tick marks and year labels count/appear progressively during the draw sequence

**Other interactions:**
- Submitting a name to the input: subtle character-by-character or smooth fade-in of the name in the list
- Generating the chart: a brief, elegant transition from the input state to the chart state — not an abrupt swap
- Hover on a bar: a very subtle lift or glow, nothing dramatic
- All animations must respect `prefers-reduced-motion` — provide instant/fade fallbacks

**Never**: pop-in, scale-bounce, generic fade-everything, or loading spinners. If something is loading, the UI should feel like it's waiting quietly, not announcing itself.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: TBD — defer to `frontend-design` skill recommendation (likely Tailwind or CSS Modules)
- **Chart rendering**: Custom SVG or Canvas (no charting library unless clearly justified)
- **AI**: Model and provider TBD; structured JSON output required

## Agent Skills

- **frontend-design** (enabled plugin): Use for all UI components and layout decisions. Commit to a bold aesthetic before writing code. Avoid Inter/Roboto/Arial, avoid generic blue/gray palettes.
- **ui-animation**: Use for all animation decisions — easing, timing, bar entrance animations, reduced-motion support.
- **find-skills**: Discover additional skills via `npx skills find [query]`.

## Architecture Notes

- Keep the **input/list UI** and the **chart visualization** as separate components/sections — they should not be mixed
- The AI call should be a Next.js **API route** (not a client-side fetch directly to the model provider) to keep API keys server-side
- Chart should be reusable and driven entirely by the structured data returned from the AI — no chart component should know about AI or fetching

## Permissions

- WebSearch is allowed
- WebFetch is allowed for `skills.sh` domain
