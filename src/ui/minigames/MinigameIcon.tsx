/**
 * Each minigame's small line icon (the testing tab's list, the pop-up's
 * banner diamonds and "The game"), in the current color.
 */
import type { ReactNode } from 'react';

const PATHS: Readonly<Record<string, ReactNode>> = {
  // A trail sign on a post.
  traildle: (
    <>
      <rect x="3" y="4" width="18" height="10" rx="2" />
      <path d="M12 14v7M8 9h2M12 9h4" />
    </>
  ),
  // An apple.
  findObject: (
    <>
      <path d="M12 7c-3-2-8-1-8 5 0 5 3 9 5 9 1.2 0 2-.6 3-.6s1.8.6 3 .6c2 0 5-4 5-9 0-6-5-7-8-5z" />
      <path d="M12 7c0-2 1-4 3-4" />
    </>
  ),
  // Footprints.
  rememberPath: (
    <>
      <ellipse cx="8" cy="15" rx="3" ry="4.5" />
      <ellipse cx="16" cy="8" rx="3" ry="4.5" />
      <path d="M8 21v0M16 14v0" />
    </>
  ),
  // A bee.
  dodge: (
    <>
      <ellipse cx="12" cy="14" rx="7" ry="5" />
      <path d="M9 9.5v9M12 9v10M15 9.5v9" />
      <path d="M10 9c-2-4-6-3-5 0M14 9c2-4 6-3 5 0" />
    </>
  ),
  // A map tile with a bending trail.
  trailMap: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 15h6c2 0 3-1 3-3V3" />
    </>
  ),
  // Two cards, one turned over.
  memory: (
    <>
      <rect x="3" y="5" width="9" height="13" rx="1.5" />
      <rect x="12" y="6" width="9" height="13" rx="1.5" transform="rotate(8 16.5 12.5)" />
      <circle cx="7.5" cy="11.5" r="2" />
    </>
  ),
  // A jigsaw piece.
  picturePuzzle: (
    <path d="M4 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 0 0 4v4h-4a2 2 0 1 0-4 0H4v-4a2 2 0 1 1 0-4z" />
  ),
  // A rope bridge: two sagging ropes and hangers.
  sketchyBridge: (
    <>
      <path d="M2 8q10 7 20 0M2 14q10 7 20 0" />
      <path d="M7 11v5M12 12v6M17 11v5M2 6v10M22 6v10" />
    </>
  ),
  // A pile, three tiers high, with a stink line (Minefield, the Dog Waste Zone).
  minefield: (
    <>
      <path d="M4 20h16c0-2-1.5-3-3-3h-10c-1.5 0-3 1-3 3z" />
      <path d="M7 17c0-2 1.5-3 3-3h4c1.5 0 3 1 3 3" />
      <path d="M10 14c0-2 1-3 2-4 1 1 2 2 2 4" />
      <path d="M17 7c1-1 1-2 0-3" />
    </>
  ),
  // Cracked ice.
  thinIce: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 3l2 6-4 4 5 2 1 6M10 9l7-1M11 15l6 3" />
    </>
  ),
  // An axe in a stump.
  trailBlocks: (
    <>
      <path d="M4 20h16M7 20v-6h10v6" />
      <path d="M12 14l5-9M15 3l4 2-2 3" />
    </>
  ),
  // A sleeping bear: Zzz.
  sleepingBear: (
    <>
      <path d="M3 19c0-5 4-8 9-8s9 3 9 8z" />
      <circle cx="7" cy="12" r="1.5" />
      <path d="M14 3h4l-4 4h4" />
    </>
  ),
  // A trash can with its lid up.
  whackoon: (
    <>
      <path d="M6 9h12l-1 12H7z" />
      <path d="M5 7l13-3M10 13v5M14 13v5" />
    </>
  ),
  // A car between lane lines.
  crossing: (
    <>
      <path d="M3 4h18M3 20h18M3 12h3M9 12h3M15 12h3" />
      <rect x="6" y="14" width="10" height="4" rx="1" />
    </>
  ),
  // A train engine on a rail.
  train: (
    <>
      <path d="M3 20h18" />
      <path d="M5 17V9h7v-3h3v3h4v8z" />
      <circle cx="8" cy="18" r="1.5" />
      <circle cx="16" cy="18" r="1.5" />
    </>
  ),
  // A raft on waves.
  rafting: (
    <>
      <rect x="6" y="6" width="12" height="9" rx="1" />
      <path d="M9 6v9M12 6v9M15 6v9M3 19c3-2 6 2 9 0s6 2 9 0" />
    </>
  ),
  // Two trunks, each with a blaze.
  trailBlazes: (
    <>
      <path d="M6 3v18M10 3v18M14 3v18M18 3v18" />
      <path d="M7 13h2M15 8h2" />
    </>
  ),
  // A jar ring and a firefly.
  fireflyCatch: (
    <>
      <circle cx="10" cy="13" r="7" />
      <circle cx="17" cy="6" r="2" />
    </>
  ),
  // Arrows out from a corner: grow or shrink.
  sizeUp: (
    <>
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <path d="M13 11l7-7M14 4h6v6" />
    </>
  ),
  // A fly swatter.
  flySwatter: (
    <>
      <rect x="7" y="3" width="10" height="10" rx="1.5" />
      <path d="M12 13v8M7 8h10M12 3v10" />
    </>
  ),
  // Binoculars.
  safari: (
    <>
      <circle cx="7" cy="16" r="4" />
      <circle cx="17" cy="16" r="4" />
      <path d="M11 16h2M4.5 13l2-8h3l1 7M19.5 13l-2-8h-3l-1 7" />
    </>
  ),
  // A line of three squares turning a corner, and a piece of trash.
  campCleanup: (
    <>
      <rect x="3" y="11" width="5" height="5" rx="1" />
      <rect x="9" y="11" width="5" height="5" rx="1" />
      <rect x="9" y="17" width="5" height="5" rx="1" />
      <path d="M18 4h3M18.5 4l.5 5h1l.5-5" />
    </>
  ),
  // A trash bin.
  raccoonShuffle: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
    </>
  ),
  // A trail sign with a question mark.
  fakeSigns: (
    <>
      <path d="M4 5h14l3 4-3 4H4z" />
      <path d="M11 13v8M10 8.2a1.6 1.6 0 1 1 2.2 1.5c-.6.3-.9.6-.9 1.3" />
    </>
  ),
  // A winding trail with a flag.
  trails: (
    <>
      <path d="M8 21c0-4 6-5 6-9s-5-4-5-8" />
      <path d="M17 3v7M17 3h4l-1 1.5 1 1.5h-4" />
    </>
  ),
  // A 4-way crossing with an arrow.
  crossroads: (
    <>
      <path d="M12 3v18M3 12h18" />
      <path d="M9 6l3-3 3 3" />
    </>
  ),
  // A climbing hold and a hand reaching.
  rockClimb: (
    <>
      <ellipse cx="15" cy="6" rx="4" ry="2.5" />
      <path d="M6 21l3-8 4-3M13 10l2-2" />
    </>
  ),
  // A pine and a winding trail.
  findPath: (
    <>
      <path d="M8 3l-5 8h3l-3 5h10l-3-5h3z" />
      <path d="M8 16v5M16 21c0-3 4-3 4-6s-4-3-4-6" />
    </>
  ),
};

export function MinigameIcon({ id, size = 22 }: { id: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[id] ?? PATHS.dodge}
    </svg>
  );
}
