/**
 * Painted as you explore (Phase 10.5, section 6): the reveal mask says how
 * much paint shows over the pencil sketch at each spot, 0 to 1.
 *
 * Each revealed tile adds a soft disc of radius 150 fading over 70
 * (prototype units), the trailhead a wide patch below it; the edge is broken
 * up by noise (the mask code in reference/topo.py). A new reveal's disc grows
 * from nothing, so the mask is worked out for a tile's growth `k` (0–1), and
 * only over the part of the map that changed.
 *
 * Revealed means: someone has been there, or a node there is shown (entering,
 * Scout, an Overlook, Prepared…), plus the trailhead from the start.
 */
import { MAP_STYLE, u } from '../../../../config/mapStyle';
import type { Section } from '../../../../engine';
import { mapSeed } from '../geometry';
import { fbm } from './grid';

const RV = MAP_STYLE.reveal;
/** Mask cells are this many prototype units across: it's soft, so coarse is fine. */
export const MASK_UNITS = 4;
/** Paint fades out over this much before the land's edge (world pixels). */
const EDGE_FADE = u(140);

export interface MaskGrid {
  x0: number;
  y0: number;
  cell: number;
  w: number;
  h: number;
  noise: Float32Array;
  /** 0–255 per cell. */
  alpha: Uint8Array;
}

export interface RevealSpot {
  id: string;
  x: number;
  y: number;
  trailhead: boolean;
}

/** The tiles whose land is painted. */
export function revealedTiles(section: Section): string[] {
  return Object.values(section.tiles)
    .filter((t) => t.kind === 'trailhead' || t.visited || t.nodes.some((n) => n.revealed))
    .map((t) => t.id)
    .sort();
}

export function maskGrid(
  land: { x0: number; y0: number; width: number; height: number },
  runSeed: number,
  sectionIndex: number,
): MaskGrid {
  const cell = u(MASK_UNITS);
  const w = Math.ceil(land.width / cell) + 1;
  const h = Math.ceil(land.height / cell) + 1;
  const seed = mapSeed(runSeed, sectionIndex, 'reveal');
  return {
    x0: land.x0,
    y0: land.y0,
    cell,
    w,
    h,
    noise: fbm(w, h, 45 / MASK_UNITS, 3, seed).a,
    alpha: new Uint8Array(w * h),
  };
}

/** How much of one spot's disc covers a point, for its growth k (0–1). */
function disc(spot: RevealSpot, k: number, x: number, y: number): number {
  if (k <= 0) return 0;
  const r = u(RV.radius) * k;
  const f = u(RV.fade) * Math.max(0.15, k);
  let v = 1 - Math.min(1, Math.max(0, (Math.hypot(x - spot.x, y - spot.y) - r) / f));
  if (spot.trailhead) {
    // The trailhead's wide patch, below it (the prototype's start area).
    const d = Math.hypot((x - spot.x) / 2.2, y - (spot.y + u(92))) - u(120) * k;
    v = Math.max(v, 1 - Math.min(1, Math.max(0, d / f)));
  }
  return v;
}

/** The reach of a spot's disc, for the part of the mask it can change. */
export const discReach = (spot: RevealSpot) =>
  u(RV.radius + RV.fade) * (spot.trailhead ? 2.6 : 1) + u(40);

/**
 * Works the mask out over a box of cells (all of it when no box), from every
 * spot and how far each has grown (1 when missing). Returns the box changed.
 */
export function paintMask(
  g: MaskGrid,
  spots: readonly RevealSpot[],
  growth: Readonly<Record<string, number>> = {},
  box?: { x0: number; y0: number; x1: number; y1: number },
): { x0: number; y0: number; x1: number; y1: number } {
  const b = box ?? { x0: 0, y0: 0, x1: g.w - 1, y1: g.h - 1 };
  const near = spots.filter((s) => {
    const reach = discReach(s) / g.cell;
    const sx = (s.x - g.x0) / g.cell;
    const sy = (s.y - g.y0) / g.cell;
    return sx + reach >= b.x0 && sx - reach <= b.x1 && sy + reach >= b.y0 && sy - reach <= b.y1;
  });
  for (let y = b.y0; y <= b.y1; y++) {
    for (let x = b.x0; x <= b.x1; x++) {
      const wx = g.x0 + x * g.cell;
      const wy = g.y0 + y * g.cell;
      let m = 0;
      for (const s of near) m = Math.max(m, disc(s, growth[s.id] ?? 1, wx, wy));
      // Paint fades out before the land's edge, so it never ends in a straight line.
      const edge = Math.min(x, y, g.w - 2 - x, g.h - 2 - y) * g.cell;
      m *= Math.min(1, Math.max(0, edge / EDGE_FADE));
      const i = y * g.w + x;
      // The noisy edge: m + 0.22·noise, then a short ramp around 0.45–0.55.
      const v = Math.min(1, Math.max(0, (m + 0.22 * g.noise[i]! - 0.45) / 0.1));
      g.alpha[i] = Math.round(v * 255);
    }
  }
  return b;
}

/** The box of cells a spot's disc can touch. */
export function spotBox(g: MaskGrid, s: RevealSpot) {
  const reach = discReach(s) / g.cell;
  const sx = (s.x - g.x0) / g.cell;
  const sy = (s.y - g.y0) / g.cell;
  return {
    x0: Math.max(0, Math.floor(sx - reach)),
    y0: Math.max(0, Math.floor(sy - reach)),
    x1: Math.min(g.w - 1, Math.ceil(sx + reach)),
    y1: Math.min(g.h - 1, Math.ceil(sy + reach)),
  };
}

/** How much paint shows at a world point (0–1). */
export function maskAt(g: MaskGrid, x: number, y: number): number {
  const gx = Math.round((x - g.x0) / g.cell);
  const gy = Math.round((y - g.y0) / g.cell);
  if (gx < 0 || gy < 0 || gx >= g.w || gy >= g.h) return 0;
  return g.alpha[gy * g.w + gx]! / 255;
}

/** Ease-out for the paint soaking in. */
export const easeOut = (t: number): number => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
