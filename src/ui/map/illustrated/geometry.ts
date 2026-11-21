/**
 * Where tiles and paths are drawn (Phase 10.5, section 3).
 *
 * - **Classic:** tiles on the grid (`tileCenter`), straight lines.
 * - **Illustrated:** each tile a little off the grid, x ±24 and y ±16
 *   (prototype units), its size ×0.90–1.07, the trailhead and checkpoint
 *   never moved; each line a gentle curve (`wind()` in
 *   docs/design/illustrated-map/reference/topo_layout.py).
 *
 * Seeded by the run and the section, so a run always looks the same. Only
 * looks: tiles and their connections are the same in both. Clicks, drags,
 * hover and the camera all use these positions.
 */
import { MAP_STYLE, u } from '../../../config/mapStyle';
import { seedRng, nextFloat, type RngState, type Section } from '../../../engine';
import { lastRowOf, tileCenter, type Point } from '../mapLayout';
import type { MapStyle } from '../mapStyleSetting';

export interface MapGeometry {
  style: MapStyle;
  /** Each tile's centre, in world coordinates. */
  centers: Readonly<Record<string, Point>>;
  /** Each tile's size, 1 on the grid. */
  scales: Readonly<Record<string, number>>;
  /** Each line's drawn path, from tile a to tile b (2 points in Classic). */
  paths: Readonly<Record<string, readonly Point[]>>;
}

/** A seed for one look of one section of a run ("jitter", "land"…). */
export function mapSeed(runSeed: number, sectionIndex: number, salt: string): number {
  let h = (runSeed ^ 0x9e3779b9) >>> 0;
  const mix = `${sectionIndex}:${salt}`;
  for (let i = 0; i < mix.length; i++) h = Math.imul(h ^ mix.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

const between = (rng: RngState, [lo, hi]: readonly number[]) =>
  (lo ?? 0) + nextFloat(rng) * ((hi ?? 0) - (lo ?? 0));

/**
 * Winding points from a to b: each pushed sideways by
 * (a1·sin(π·t·bends + phase) + a2·sin(π·t·(2·bends + 1))) · sin(π·t).
 */
export function wind(
  a: Point,
  b: Point,
  rng: RngState,
  { bends, amp, samples }: { bends: number; amp: number; samples: number },
): Point[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const W = MAP_STYLE.wind;
  const phase = nextFloat(rng) * Math.PI;
  const a1 = between(rng, W.a1) * amp;
  const a2 = between(rng, W.a2) * amp;
  const out: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const off =
      (a1 * Math.sin(Math.PI * t * bends + phase) + a2 * Math.sin(Math.PI * t * (bends * 2 + 1))) *
      Math.sin(Math.PI * t);
    out.push({ x: a.x + dx * t + nx * off, y: a.y + dy * t + ny * off });
  }
  return out;
}

/** The tiles and paths of a section, for a map style. */
export function mapGeometry(
  section: Section,
  { style, runSeed, sectionIndex }: { style: MapStyle; runSeed: number; sectionIndex: number },
): MapGeometry {
  const lastRow = lastRowOf(section);
  const tiles = Object.values(section.tiles).sort((p, q) => p.id.localeCompare(q.id));
  const centers: Record<string, Point> = {};
  const scales: Record<string, number> = {};
  const J = MAP_STYLE.jitter;
  const rng = seedRng(mapSeed(runSeed, sectionIndex, 'jitter'));
  for (const t of tiles) {
    const grid = tileCenter(t, lastRow);
    // Drawn either way, so a tile looks the same whichever style was picked first.
    const jx = (nextFloat(rng) * 2 - 1) * u(J.x);
    const jy = (nextFloat(rng) * 2 - 1) * u(J.y);
    const s = J.scaleMin + nextFloat(rng) * (J.scaleMax - J.scaleMin);
    const fixed = style === 'classic' || t.kind === 'trailhead' || t.kind === 'checkpoint';
    centers[t.id] = fixed ? grid : { x: grid.x + jx, y: grid.y + jy };
    scales[t.id] = fixed ? 1 : s;
  }
  const paths: Record<string, Point[]> = {};
  const W = MAP_STYLE.wind;
  section.lines.forEach((line, i) => {
    const a = centers[line.a];
    const b = centers[line.b];
    if (!a || !b) return;
    if (style === 'classic') {
      paths[line.id] = [a, b];
      return;
    }
    const sameRow = section.tiles[line.a]?.row === section.tiles[line.b]?.row;
    paths[line.id] = wind(a, b, seedRng(mapSeed(runSeed, sectionIndex, `wind:${line.id}`)), {
      bends: 1 + (i % 2),
      amp: u(sameRow ? W.ampInRow : W.ampBetweenRows),
      samples: W.samples,
    });
  });
  return { style, centers, scales, paths };
}

/** A path's middle point (where its cost badge sits). */
export function pathMiddle(pts: readonly Point[]): Point {
  if (pts.length === 2) {
    const [a, b] = pts as [Point, Point];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  return pts[Math.floor(pts.length / 2)] ?? { x: 0, y: 0 };
}

/** An SVG path through the points. */
export const pathD = (pts: readonly Point[]): string =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
