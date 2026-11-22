/**
 * What sits on the illustrated map's land (Phase 10.5, sections 5, 7 and 10):
 *
 * - **Stamps** (the placeholder PNGs in public/assets/map/stamps/): side-on
 *   trees and bushes along forest edges, a rock or peak on the strongest
 *   peaks, a cabin by the trailhead, a fire lookout by each Overlook, a tent
 *   by each Campsite, deer in the biggest meadow, and a waterfall where the
 *   river drops most. Never in a tile hex or on a path.
 * - **Bridges** where a path crosses a river or creek.
 * - **Named places** (rivers, creeks, ponds, lookouts, woods, meadows, peaks,
 *   falls) with Oregon names, each list shuffled once per run and used in
 *   order section after section, so nothing repeats and nothing is saved.
 *
 * Pure and seeded, like the land.
 */
import { MAP_STYLE, u } from '../../../../config/mapStyle';
import { nextFloat, seedRng, shuffle } from '../../../../engine/rng';
import type { RngState } from '../../../../engine/types';
import type { Point } from '../../mapLayout';
import { mapSeed } from '../geometry';
import { rngFor, uniform } from './grid';
import { LAND, type LandModel } from './model';

export type StampKind =
  | 'conifer'
  | 'leafy-tree'
  | 'autumn-tree'
  | 'bush'
  | 'rock'
  | 'peak'
  | 'cabin'
  | 'fire-lookout'
  | 'bridge'
  | 'tent'
  | 'deer'
  | 'waterfall';

export const STAMP_KINDS: readonly StampKind[] = [
  'conifer',
  'leafy-tree',
  'autumn-tree',
  'bush',
  'rock',
  'peak',
  'cabin',
  'fire-lookout',
  'bridge',
  'tent',
  'deer',
  'waterfall',
];

/** A stamp on the land: its base point (bottom middle), height and width, in world pixels. */
export interface Stamp {
  kind: StampKind;
  x: number;
  y: number;
  h: number;
  w: number;
}

export interface Bridge {
  x: number;
  y: number;
  /** The path's direction there, in degrees. */
  angle: number;
}

export type PlaceKind =
  'river' | 'creek' | 'pond' | 'lookout' | 'woods' | 'meadow' | 'peak' | 'falls';
export const PLACE_KINDS: readonly PlaceKind[] = [
  'river',
  'creek',
  'pond',
  'lookout',
  'woods',
  'meadow',
  'peak',
  'falls',
];

/** A named place's label: where it sits, its angle, size and color. */
export interface Place {
  kind: PlaceKind;
  name: string;
  x: number;
  y: number;
  /** Degrees. */
  rot: number;
  size: number;
  color: string;
  /** The label's box, for overlaps and the paint check. */
  box: { x0: number; y0: number; x1: number; y1: number };
}

export interface LandFeatures {
  stamps: Stamp[];
  bridges: Bridge[];
  places: Place[];
}

export type NameLists = Record<PlaceKind, string[]>;

const S = MAP_STYLE.stamps;
const LB = MAP_STYLE.labels;

/** How many names of each kind one section can use, so 3 sections never repeat. */
export const NAMES_PER_SECTION = 6;

/** Each kind's names for this run: shuffled once with the run seed. */
export function runNames(lists: NameLists, runSeed: number): NameLists {
  const out = {} as NameLists;
  for (const k of PLACE_KINDS) {
    out[k] = shuffle(seedRng(mapSeed(runSeed, 0, `names:${k}`)), lists[k] ?? []);
  }
  return out;
}

/** The n-th name of a kind in this section (undefined past the section's share). */
export function nameFor(names: NameLists, kind: PlaceKind, sectionIndex: number, n: number) {
  const list = names[kind];
  if (!list.length || n >= NAMES_PER_SECTION) return undefined;
  return list[(sectionIndex * NAMES_PER_SECTION + n) % list.length];
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

/** Distance from p to the segment a–b. */
export function segDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function polyDist(p: Point, pts: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, segDist(p, pts[i]!, pts[i + 1]!));
  return best;
}

function segCross(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
  const ccw = (a: Point, b: Point, c: Point) =>
    (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  return ccw(p1, q1, q2) !== ccw(p2, q1, q2) && ccw(p1, p2, q1) !== ccw(p1, p2, q2);
}

// ── The build ────────────────────────────────────────────────────────────────

export function buildFeatures(land: LandModel, lists: NameLists): LandFeatures {
  const { input } = land;
  const R = input.hexR;
  const seed = mapSeed(input.runSeed, input.sectionIndex, 'features');
  const rng = rngFor(seed, 1);
  const tiles = input.tiles;
  const paths = input.paths.map((p) => p.pts);
  const track = u(MAP_STYLE.paths.track.width) / 2;
  const at = (p: Point) => {
    const gx = Math.floor((p.x - land.x0) / land.cell);
    const gy = Math.floor((p.y - land.y0) / land.cell);
    if (gx < 0 || gy < 0 || gx >= land.gw || gy >= land.gh) return -1;
    return gy * land.gw + gx;
  };

  // ── Stamps ──
  const stamps: Stamp[] = [];
  const clear = (x: number, y: number, w: number, h: number) => {
    // Out of every hex (the stamp's whole box), off every path, and not on another stamp.
    for (const t of tiles) {
      const r = R * t.scale * 1.05;
      if (x + w / 2 > t.x - r && x - w / 2 < t.x + r && y > t.y - r && y - h < t.y + r) {
        if (Math.hypot(x - t.x, y - h / 2 - t.y) < r + Math.max(w, h) / 2) return false;
      }
    }
    const foot = { x, y: y - h * 0.25 };
    for (const pts of paths) if (polyDist(foot, pts) < track + w / 2) return false;
    for (const s of stamps) {
      if (Math.abs(s.x - x) < (s.w + w) * 0.35 && Math.abs(s.y - y) < (s.h + h) * 0.2) return false;
    }
    const i = at({ x, y });
    return i >= 0 && land.type[i] !== LAND.water;
  };
  const place = (kind: StampKind, x: number, y: number, h: number, w = h * 0.7) => {
    if (!clear(x, y, w, h)) return false;
    stamps.push({ kind, x, y, h, w });
    return true;
  };
  /** Tries spots around a centre, nearest first. */
  const placeNear = (kind: StampKind, c: Point, dist: number, h: number) => {
    for (const d of [dist, dist * 1.3, dist * 1.6]) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + 0.4;
        if (place(kind, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, h)) return stamps.at(-1)!;
      }
    }
    return undefined;
  };

  // A cabin near the trailhead; a fire lookout by each Overlook; a tent by each Campsite.
  const head = tiles.find((t) => t.kind === 'trailhead');
  if (head) placeNear('cabin', head, R * 1.45, u(S.small) * 1.2);
  const lookouts: { tile: (typeof tiles)[number]; stamp: Stamp | undefined }[] = [];
  for (const t of tiles) {
    if (t.special === 'overlook') {
      lookouts.push({ tile: t, stamp: placeNear('fire-lookout', t, R * t.scale * 1.4, u(S.tall)) });
    }
    if (t.special === 'campsite') placeNear('tent', t, R * t.scale * 1.35, u(S.small));
  }

  // Rocks and peaks on the strongest peaks.
  const peaks: { x: number; y: number; v: number }[] = [];
  const pstep = Math.max(2, Math.round(u(24) / land.cell));
  for (let gy = pstep; gy < land.gh - pstep; gy += pstep) {
    for (let gx = pstep; gx < land.gw - pstep; gx += pstep) {
      const v = land.peak[gy * land.gw + gx]!;
      if (v < 0.6) continue;
      let top = true;
      for (let dy = -2; dy <= 2 && top; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (land.peak[(gy + dy * pstep) * land.gw + gx + dx * pstep]! > v) {
            top = false;
            break;
          }
        }
      }
      if (top) peaks.push({ x: land.x0 + gx * land.cell, y: land.y0 + gy * land.cell, v });
    }
  }
  peaks.sort((a, b) => b.v - a.v);
  const peakStamps: Stamp[] = [];
  for (const p of peaks) {
    const kind: StampKind = p.v > 0.85 ? 'peak' : 'rock';
    if (
      place(
        kind,
        p.x,
        p.y + u(S.tall) * 0.4,
        u(kind === 'peak' ? S.tall : S.small) * 1.1,
        u(S.tall),
      )
    ) {
      if (kind === 'peak') peakStamps.push(stamps.at(-1)!);
    }
  }

  // A waterfall where the river drops most over 40 units, if it's big enough.
  const falls: Stamp[] = [];
  const river = land.river;
  const heightAt = (p: Point) => {
    const i = at(p);
    return i < 0 ? undefined : land.heightRaw[i];
  };
  let drop = { i: -1, d: 0 };
  for (let i = 0; i < river.length; i++) {
    let j = i;
    let along = 0;
    while (j < river.length - 1 && along < u(S.waterfallOver)) {
      along += Math.hypot(river[j + 1]!.x - river[j]!.x, river[j + 1]!.y - river[j]!.y);
      j++;
    }
    const a = heightAt(river[i]!);
    const b = heightAt(river[j]!);
    if (a === undefined || b === undefined || along < u(S.waterfallOver) * 0.8) continue;
    if (Math.abs(a - b) > drop.d) drop = { i: Math.floor((i + j) / 2), d: Math.abs(a - b) };
  }
  if (drop.i >= 0 && drop.d > S.waterfallDrop) {
    const p = river[drop.i]!;
    // On the water itself: only hexes and paths keep it off.
    const r = u(S.small) * 1.4;
    const hexFree = tiles.every((t) => Math.hypot(p.x - t.x, p.y - t.y) > R * t.scale * 1.1 + r);
    const pathFree = paths.every((pts) => polyDist(p, pts) > track + r / 2);
    if (hexFree && pathFree) {
      const s: Stamp = { kind: 'waterfall', x: p.x, y: p.y + r * 0.4, h: r, w: r };
      stamps.push(s);
      falls.push(s);
    }
  }

  // Side-on trees and bushes along forest edges, about one per 40 units of edge.
  const edges: number[] = [];
  const { gw, gh, forestMask } = land;
  for (let gy = 1; gy < gh - 1; gy++) {
    for (let gx = 1; gx < gw - 1; gx++) {
      const i = gy * gw + gx;
      if (!forestMask[i]) continue;
      if (!forestMask[i - 1] || !forestMask[i + 1] || !forestMask[i - gw] || !forestMask[i + gw]) {
        edges.push(i);
      }
    }
  }
  const wanted = Math.round((edges.length * input.cellUnits) / S.edgeEvery);
  const pickOrder = shuffle(rng, edges);
  const autumnOk = land.crowns.some((c) => c.autumn >= 0);
  let placed = 0;
  for (const i of pickOrder) {
    if (placed >= wanted) break;
    const x = land.x0 + (i % gw) * land.cell;
    const y = land.y0 + Math.floor(i / gw) * land.cell;
    const roll = nextFloat(rng);
    const kind: StampKind =
      roll < 0.4
        ? 'conifer'
        : roll < 0.62
          ? 'bush'
          : autumnOk && roll < 0.72
            ? 'autumn-tree'
            : 'leafy-tree';
    const h = kind === 'bush' ? u(S.small) : u(S.tall) * uniform(rng, 0.85, 1.1);
    if (place(kind, x, y + h * 0.2, h)) placed++;
  }

  // Deer in the biggest meadow.
  const meadows = patches(land, (t) => t === LAND.meadowA || t === LAND.meadowB);
  const biggest = meadows[0];
  if (biggest) {
    const n = S.deer[0] + Math.floor(nextFloat(rng) * (S.deer[1] - S.deer[0] + 1));
    let got = 0;
    for (let k = 0; k < 40 && got < n; k++) {
      const cellI = biggest.cells[Math.floor(nextFloat(rng) * biggest.cells.length)]!;
      const x = land.x0 + (cellI % biggest.gw) * biggest.ds * land.cell;
      const y = land.y0 + Math.floor(cellI / biggest.gw) * biggest.ds * land.cell;
      if (place('deer', x, y, u(S.small) * 1.1, u(S.small) * 1.2)) got++;
    }
  }

  // ── Bridges ──
  const bridges: Bridge[] = [];
  const water = [land.river, ...land.creeks];
  for (const pts of paths) {
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i]!;
      const p2 = pts[i + 1]!;
      for (const wl of water) {
        for (let j = 0; j < wl.length - 1; j++) {
          if (!segCross(p1, p2, wl[j]!, wl[j + 1]!)) continue;
          const m = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
          if (tiles.some((t) => Math.hypot(m.x - t.x, m.y - t.y) < R * t.scale * 1.1)) continue;
          if (bridges.some((b) => Math.hypot(m.x - b.x, m.y - b.y) < u(20))) continue;
          bridges.push({ ...m, angle: (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI });
        }
      }
    }
  }

  // ── Named places ──
  const names = runNames(lists, input.runSeed);
  const used: Record<PlaceKind, number> = {
    river: 0,
    creek: 0,
    pond: 0,
    lookout: 0,
    woods: 0,
    meadow: 0,
    peak: 0,
    falls: 0,
  };
  const places: Place[] = [];
  const COLOR: Record<PlaceKind, string> = {
    river: LB.water,
    creek: LB.water,
    pond: LB.water,
    falls: LB.water,
    lookout: LB.high,
    peak: LB.high,
    woods: LB.land,
    meadow: LB.land,
  };
  const SIZE: Record<PlaceKind, number> = {
    river: 15,
    creek: 14,
    pond: 17,
    falls: 14,
    lookout: 16,
    peak: 15,
    woods: 15,
    meadow: 15,
  };
  const boxOf = (x: number, y: number, text: string, size: number, rot: number) => {
    const w = text.length * size * 0.52;
    const h = size * 1.25;
    const a = (rot * Math.PI) / 180;
    const bw = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
    const bh = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
    return { x0: x - bw / 2, y0: y - bh / 2, x1: x + bw / 2, y1: y + bh / 2 };
  };
  const fits = (b: Place['box']) => {
    if (
      b.x0 < land.x0 ||
      b.y0 < land.y0 ||
      b.x1 > land.x0 + land.width ||
      b.y1 > land.y0 + land.height
    ) {
      return false;
    }
    for (const t of tiles) {
      const r = R * t.scale * 1.02;
      if (b.x1 > t.x - r && b.x0 < t.x + r && b.y1 > t.y - r && b.y0 < t.y + r) return false;
    }
    return !places.some(
      (p) => b.x1 > p.box.x0 && b.x0 < p.box.x1 && b.y1 > p.box.y0 && b.y0 < p.box.y1,
    );
  };
  /** Names a place at the first spot that fits; false when there's no name or no room. */
  const label = (kind: PlaceKind, spots: { x: number; y: number; rot: number }[]) => {
    const name = nameFor(names, kind, input.sectionIndex, used[kind]);
    if (!name) return false;
    const size = SIZE[kind];
    for (const s of spots) {
      const box = boxOf(s.x, s.y, name, size, s.rot);
      if (!fits(box)) continue;
      places.push({ kind, name, x: s.x, y: s.y, rot: s.rot, size, color: COLOR[kind], box });
      used[kind] += 1;
      return true;
    }
    return false;
  };
  /** Calm stretches of a line: spots along it, rotated to it, away from its ends. */
  const along = (pts: readonly Point[]) => {
    const out: { x: number; y: number; rot: number; bend: number }[] = [];
    const k = 6;
    for (let i = k; i < pts.length - k; i += 3) {
      const a = pts[i - k]!;
      const b = pts[i + k]!;
      const p = pts[i]!;
      let rot = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      if (rot > 90) rot -= 180;
      if (rot < -90) rot += 180;
      // How far it bends here: the middle's distance from the chord.
      const bend = segDist(p, a, b);
      // Beside the water, not on it.
      const n = { x: -(b.y - a.y), y: b.x - a.x };
      const nl = Math.hypot(n.x, n.y) || 1;
      const side = u(12);
      out.push({ x: p.x + (n.x / nl) * side, y: p.y + (n.y / nl) * side, rot, bend });
    }
    return out.filter((s) => Math.abs(s.rot) < 60).sort((a, b) => a.bend - b.bend);
  };
  if (land.river.length) label('river', along(land.river));
  for (const k of land.creeks) label('creek', along(k));
  for (const p of land.ponds) {
    label('pond', [
      { x: p.cx + p.rx + u(40), y: p.cy, rot: 0 },
      { x: p.cx - p.rx - u(40), y: p.cy, rot: 0 },
      { x: p.cx, y: p.cy + p.ry + u(14), rot: 0 },
      { x: p.cx, y: p.cy - p.ry - u(14), rot: 0 },
    ]);
  }
  for (const { tile } of lookouts) {
    const d = R * tile.scale * 1.15;
    label('lookout', [
      { x: tile.x - d - u(40), y: tile.y + R * 0.4, rot: 0 },
      { x: tile.x + d + u(40), y: tile.y + R * 0.4, rot: 0 },
      { x: tile.x, y: tile.y + d + u(10), rot: 0 },
    ]);
  }
  const hexArea = (3 * Math.sqrt(3) * R * R) / 2;
  const woods = patches(land, (t) => t === LAND.forest);
  for (const p of woods) {
    if (p.area < hexArea * LB.woodsTiles) break;
    label('woods', p.spots);
  }
  for (const p of meadows) {
    if (p.area < hexArea * LB.meadowTiles) break;
    label('meadow', p.spots);
  }
  for (const s of peakStamps)
    label('peak', [
      { x: s.x, y: s.y + u(14), rot: 0 },
      { x: s.x, y: s.y - s.h - u(10), rot: 0 },
    ]);
  for (const s of falls)
    label('falls', [
      { x: s.x + u(48), y: s.y, rot: 0 },
      { x: s.x - u(48), y: s.y, rot: 0 },
    ]);

  return { stamps, bridges, places };
}

/**
 * Connected patches of a land type (on every 4th cell), biggest first: their
 * area in world pixels², their cells, and spots near their middle for a label.
 */
function patches(land: LandModel, keep: (type: number) => boolean) {
  const ds = Math.max(1, Math.round(4 / land.input.cellUnits));
  const gw = Math.ceil(land.gw / ds);
  const gh = Math.ceil(land.gh / ds);
  const on = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      on[y * gw + x] = keep(land.type[y * ds * land.gw + x * ds]!) ? 1 : 0;
    }
  }
  const seen = new Uint8Array(gw * gh);
  const out: {
    area: number;
    cells: number[];
    gw: number;
    ds: number;
    spots: { x: number; y: number; rot: number }[];
  }[] = [];
  const stack: number[] = [];
  for (let s = 0; s < on.length; s++) {
    if (!on[s] || seen[s]) continue;
    const cells: number[] = [];
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      cells.push(i);
      const x = i % gw;
      const y = Math.floor(i / gw);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const j = ny * gw + nx;
        if (on[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    const cellPx = ds * land.cell;
    let cx = 0;
    let cy = 0;
    for (const i of cells) {
      cx += i % gw;
      cy += Math.floor(i / gw);
    }
    cx /= cells.length;
    cy /= cells.length;
    // Spots inside the patch, nearest the middle first.
    const spots = cells
      .map((i) => ({ i, d: ((i % gw) - cx) ** 2 + (Math.floor(i / gw) - cy) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .filter((_, k) => k % 7 === 0)
      .slice(0, 40)
      .map(({ i }) => ({
        x: land.x0 + (i % gw) * cellPx,
        y: land.y0 + Math.floor(i / gw) * cellPx,
        rot: 0,
      }));
    out.push({ area: cells.length * cellPx * cellPx, cells, gw, ds, spots });
  }
  return out.sort((a, b) => b.area - a.area);
}

/** For the tests: a stamp's box. */
export const stampBox = (s: Stamp) => ({
  x0: s.x - s.w / 2,
  x1: s.x + s.w / 2,
  y0: s.y - s.h,
  y1: s.y,
});

export type { RngState };
