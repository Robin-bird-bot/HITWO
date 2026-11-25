/**
 * Each minigame's small line icon (the testing tab's list, the pop-up's
 * banner diamonds and "The game"), in the current color.
 */
import type { ReactNode } from 'react';

const PATHS: Readonly<Record<string, ReactNode>> = {
  // A barrel.
  bearrels: (
    <>
      <path d="M6 3h12c1.5 3 1.5 15 0 18H6C4.5 18 4.5 6 6 3z" />
      <path d="M5.2 9h13.6M5.2 15h13.6" />
    </>
  ),
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
      {PATHS[id] ?? PATHS.bearrels}
    </svg>
  );
}
