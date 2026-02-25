"use client";

// Tile width must match the translateX values in globals.css @keyframes wv-*
const TILE_W = 160;
const TILES  = 30; // 4800px — covers any screen

function wavePath(y: number, amp: number): string {
  let d = `M 0,${y}`;
  for (let i = 0; i < TILES; i++) {
    const x = i * TILE_W;
    d += ` C ${x + 40},${y - amp} ${x + 120},${y + amp} ${x + TILE_W},${y}`;
  }
  return d;
}

/*
  Ship geometry (half-scale rendering):
    SVG element:  55 × 47 px  (width / height attributes)
    viewBox:      -50 -65 100 85  (same as full-size — scales down uniformly)
    waterline y=0 maps to pixel y = 47 × (65/85) ≈ 36 px from top of element

  Container height: 68px
  Front wave centre: y = 44 in container SVG
  Ship div top: 44 − 36 = 8 px  →  waterline sits on the front wave ✓
*/

export default function LoadingAnimation() {
  return (
    <div
      style={{
        position: "fixed",
        top: "132px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "320px",
        height: "68px",
        zIndex: 5,
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      {/* ── Waves ──────────────────────────────────────────────── */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        {/* Back wave — slow, barely visible */}
        <g style={{ animation: "wv-slow 5.5s linear infinite" }}>
          <path
            d={wavePath(52, 4)}
            fill="none"
            stroke="var(--fg)"
            strokeWidth="0.8"
            opacity="0.12"
          />
        </g>

        {/* Mid wave */}
        <g style={{ animation: "wv-mid 4s linear infinite" }}>
          <path
            d={wavePath(48, 5)}
            fill="none"
            stroke="var(--fg)"
            strokeWidth="1"
            opacity="0.26"
          />
        </g>

        {/* Front wave — fastest, most visible */}
        <g style={{ animation: "wv-fast 2.8s linear infinite" }}>
          <path
            d={wavePath(44, 6)}
            fill="none"
            stroke="var(--fg)"
            strokeWidth="1.4"
            opacity="0.55"
          />
        </g>
      </svg>

      {/* ── Ship ───────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: "8px",
          left: "50%",
          marginLeft: "-27px", // half of rendered width (55 * 0.5 ≈ 27)
          animation: "ship-bob 3.2s ease-in-out infinite",
          willChange: "transform",
        }}
      >
        {/*
          width="55" height="47" with the original full-size viewBox
          scales the whole ship to 55% — strokes scale with it so they
          stay proportionally delicate.
        */}
        <svg
          width="55"
          height="47"
          viewBox="-50 -65 100 85"
          fill="none"
          stroke="var(--fg)"
          strokeWidth="2.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {/* Hull */}
          <path
            d="M -36,2 Q 0,18 36,4 L 30,-8 L -30,-8 Z"
            fill="var(--bg)"
            strokeWidth="3"
          />
          {/* Bowsprit */}
          <line x1="-30" y1="-6" x2="-46" y2="2" />
          {/* Cabin */}
          <path d="M -10,-8 L -10,-17 L 16,-17 L 16,-8" fill="var(--bg)" />
          {/* Mast */}
          <line x1="2" y1="-8" x2="2" y2="-54" />
          {/* Rigging */}
          <line x1="-46" y1="2" x2="2" y2="-54" strokeWidth="1.4" opacity="0.45" />
          {/* Main sail */}
          <path d="M 3,-10 L 3,-52 C 38,-34 36,-12 30,-8 Z" fill="var(--bg)" />
          {/* Jib */}
          <path d="M -1,-16 L -1,-48 L -36,-8 Z" fill="var(--bg)" />
          {/* Flag */}
          <path d="M 2,-54 L 14,-59 L 2,-51 Z" fill="var(--fg)" stroke="none" />
        </svg>
      </div>
    </div>
  );
}
