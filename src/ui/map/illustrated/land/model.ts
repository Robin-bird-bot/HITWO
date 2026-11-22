/**
 * The illustrated map's land (Phase 10.5, section 4), built from a section's
 * tiles, nodes and paths. Follows docs/design/illustrated-map/reference/topo.py
 * and its numbers (in prototype units; `PU` prototype units per field cell).
 *
 * 1. Fields: fbm noise at 260, 90 and 30; mountain, peak, forest and meadow
 *    influence from the nodes; extra ranges and woods off the tree.
 * 2. Water: the main river from the top edge to the bottom through the River
 *    tiles; creeks for River tiles it can't reach; a pond for River ×2.
 * 3. Height rising toward the checkpoint, dipping along rivers.
 * 4. Light from the top left, cut into 4 flat tones and smoothed.
 * 5. Land types (rock, forest, bank, two meadows), each with 4 tones, higher
 *    land tinted toward the haze.
 * 6–8. Contours, details (flowers, grass, cracks) and tree crowns, as lists
 *    for the painter.
 *
 * Pure and seeded: the same run, section, biome and tiles always give the
 * same land. Nothing here is saved.
 */
import { MAP_STYLE, u } from '../../../../config/mapStyle';
import { nextFloat } from '../../../../engine/rng';
import type { NodeKind, RngState } from '../../../../engine/types';
import type { Point } from '../../mapLayout';
import { mapSeed } from '../geometry';
import {
  addGauss,
  blur,
  distanceTo,
  fbm,
  field,
  hashArrays,
  medianLevels,
  minMax,
  quantiles,
  rngFor,
  strokeCells,
  uniform,
  type Field,
} from './grid';
import { PALETTES, rgbOf, type PaletteName } from './palette';

const L = MAP_STYLE.land;

export interface LandTile {
  id: string;
  x: number;
  y: number;
  scale: number;
  kind: 'trailhead' | 'normal' | 'checkpoint';
  special: string | null;
  nodes: NodeKind[];
}

export interface LandPath {
  id: string;
  kind: string;
  pts: readonly Point[];
}

export interface LandInput {
  runSeed: number;
  sectionIndex: number;
  palette: PaletteName;
  tiles: LandTile[];
  paths: LandPath[];
  /** A tile hex's corner radius at size 1, in world pixels (Classic's 64). */
  hexR: number;
  /** Prototype units per field cell: 1 on a laptop, 2 on phones. */
  cellUnits: number;
}

/** Land types, for colors and the debug view. */
export const LAND = { meadowA: 0, meadowB: 1, forest: 2, rock: 3, bank: 4, water: 5 } as const;

export interface Pond {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface Crown {
  x: number;
  y: number;
  r: number;
  tone: number;
  /** 0–1: conifer below the conifer share; sketch symbol above 1 − the sketch share. */
  u: number;
  /** An autumn palette's index, or −1. */
  autumn: number;
}

export interface LandModel {
  input: LandInput;
  /** The land's rectangle in world pixels. */
  x0: number;
  y0: number;
  width: number;
  height: number;
  /** The field grid: `gw` × `gh` cells of `cell` world pixels. */
  gw: number;
  gh: number;
  cell: number;
  /** Base colors, RGBA per cell (land types × 4 tones, with the haze). */
  rgba: Uint8ClampedArray;
  /** Tone 0 (shadow) to 3 (highlight), per cell. */
  tone: Uint8Array;
  /** Land type (LAND), per cell. */
  type: Uint8Array;
  /** Height, 0 (lowest) to 1, per cell. */
  heightN: Float32Array;
  /** Raw height and peak strength, for features and stamps. */
  heightRaw: Float32Array;
  peak: Float32Array;
  forestMask: Uint8Array;
  /** Distance to water in prototype units, per cell. */
  waterDist: Float32Array;
  /** Hatched in the sketch: deep shadow, or shadow on rock. */
  hatch: Uint8Array;
  /** Water, in world pixels. */
  river: Point[];
  creeks: Point[][];
  ponds: Pond[];
  /** River tiles the main river runs through (the rest have creeks). */
  riverTiles: string[];
  contours: { pts: Float32Array; major: boolean }[];
  crowns: Crown[];
  flowers: { x: number; y: number; r: number; color: string }[];
  grass: { x: number; y: number; dx: number; dy: number }[];
  cracks: { x: number; y: number; dx: number; dy: number; dark: boolean }[];
  hash: string;
}

const count = (t: LandTile, k: NodeKind) => t.nodes.filter((n) => n === k).length;

// ── Water ────────────────────────────────────────────────────────────────────

/** Catmull-Rom through the points, `n` steps per span. */
export function smoothPts(pts: readonly Point[], n: number): Point[] {
  if (pts.length < 2) return [...pts];
  const P = [pts[0]!, ...pts, pts[pts.length - 1]!];
  const out: Point[] = [];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1]!;
    const p1 = P[i]!;
    const p2 = P[i + 1]!;
    const p3 = P[i + 2]!;
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** A natural wander across the line (amp in the points' units; arc length in prototype units). */
export function meander(
  pts: readonly Point[],
  amp: number,
  toUnits: number,
  rng: RngState,
): Point[] {
  const ph = [uniform(rng, 0, 6), uniform(rng, 0, 6), uniform(rng, 0, 6)] as const;
  let acc = 0;
  return pts.map((p, i) => {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const l = Math.hypot(dx, dy) || 1;
    if (i) acc += Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y) * toUnits;
    const o =
      amp *
      (Math.sin(acc / 37 + ph[0]) * 0.6 +
        Math.sin(acc / 17 + ph[1]) * 0.3 +
        Math.sin(acc / 9 + ph[2]) * 0.1);
    return { x: p.x - (dy / l) * o, y: p.y + (dx / l) * o };
  });
}

/**
 * The River tiles the main river can run through in order, top to bottom:
 * the longest chain where it never has to run sideways much more than down.
 * The others get creeks.
 */
export function riverChain(tiles: readonly LandTile[], rowGap: number): LandTile[] {
  const rivers = tiles.filter((t) => count(t, 'river') > 0).sort((a, b) => a.y - b.y || a.x - b.x);
  const ok = (a: LandTile, b: LandTile) =>
    b.y - a.y > rowGap * 0.4 && Math.abs(b.x - a.x) <= 1.25 * (b.y - a.y) + rowGap * 0.35;
  const best: number[] = rivers.map(() => 1);
  const prev: number[] = rivers.map(() => -1);
  for (let i = 0; i < rivers.length; i++) {
    for (let j = 0; j < i; j++) {
      if (ok(rivers[j]!, rivers[i]!) && best[j]! + 1 > best[i]!) {
        best[i] = best[j]! + 1;
        prev[i] = j;
      }
    }
  }
  let end = -1;
  for (let i = 0; i < rivers.length; i++) if (end < 0 || best[i]! > best[end]!) end = i;
  const chain: LandTile[] = [];
  for (let i = end; i >= 0; i = prev[i]!) chain.unshift(rivers[i]!);
  return chain;
}

// ── The build ────────────────────────────────────────────────────────────────

/** How long each part of the last build took (ms), for the debug panel and tuning. */
export const LAND_TIMINGS: Record<string, number> = {};

export function buildLand(input: LandInput): LandModel {
  let lap = performance.now();
  const mark = (part: string) => {
    const now = performance.now();
    LAND_TIMINGS[part] = now - lap;
    lap = now;
  };
  const PU = input.cellUnits;
  const cell = u(PU);
  /** Prototype units → cells. */
  const c = (n: number) => n / PU;
  const pal = PALETTES[input.palette];
  const seed = mapSeed(input.runSeed, input.sectionIndex, `land:${input.palette}`);
  const R = input.hexR;

  // The land: the tree's box plus the margin on every side.
  const xs = input.tiles.map((t) => t.x);
  const ys = input.tiles.map((t) => t.y);
  const margin = u(L.margin);
  const x0 = Math.min(...xs) - R - margin;
  const y0 = Math.min(...ys) - R - margin;
  const width = Math.max(...xs) + R + margin - x0;
  const height = Math.max(...ys) + R + margin - y0;
  const gw = Math.ceil(width / cell);
  const gh = Math.ceil(height / cell);
  const N = gw * gh;
  const toG = (p: Point): Point => ({ x: (p.x - x0) / cell, y: (p.y - y0) / cell });
  const toW = (p: Point): Point => ({ x: x0 + p.x * cell, y: y0 + p.y * cell });
  const tiles = input.tiles.map((t) => ({ t, g: toG(t) }));
  const treeBox = {
    x0: (Math.min(...xs) - R - x0) / cell,
    x1: (Math.max(...xs) + R - x0) / cell,
    y0: (Math.min(...ys) - R - y0) / cell,
    y1: (Math.max(...ys) + R - y0) / cell,
  };

  // 1. Fields.
  const [s1, s2, s3] = L.noise as [number, number, number];
  const n1 = fbm(gw, gh, c(s1), 5, seed + 1);
  const n2 = fbm(gw, gh, c(s2), 4, seed + 2);
  const n3 = fbm(gw, gh, c(s3), 3, seed + 3);
  const mtn = field(gw, gh);
  const fst = field(gw, gh);
  const mdw = field(gw, gh);
  const peak = field(gw, gh);
  for (const { t, g } of tiles) {
    const m = count(t, 'mountain');
    addGauss(mtn, g.x + c(40), g.y - c(30), c(120), m);
    addGauss(fst, g.x, g.y, c(115), count(t, 'forest'));
    addGauss(mdw, g.x, g.y, c(95), count(t, 'wildlife') + (t.kind === 'trailhead' ? 1.3 : 0));
    // Peaks off to one side, so the tile itself stays walkable.
    for (let j = 0; j < m; j++)
      addGauss(peak, g.x + c(70 - 120 * j), g.y + c(-45 + 20 * j), c(62), 1);
  }
  // Off the tree: ranges, woods and meadows so the edges aren't empty.
  const off = rngFor(seed, 11);
  const outside = (): Point => {
    for (let i = 0; i < 40; i++) {
      const p = { x: uniform(off, 0, gw), y: uniform(off, 0, gh) };
      const inBox =
        p.x > treeBox.x0 - c(40) &&
        p.x < treeBox.x1 + c(40) &&
        p.y > treeBox.y0 - c(40) &&
        p.y < treeBox.y1 + c(40);
      if (!inBox) return p;
    }
    return { x: uniform(off, 0, gw), y: 0 };
  };
  for (let i = 0; i < 3; i++) {
    const p = outside();
    addGauss(mtn, p.x, p.y, c(uniform(off, 140, 190)), uniform(off, 0.8, 1.6));
    addGauss(peak, p.x, p.y - c(10), c(uniform(off, 85, 150)), uniform(off, 0.7, 1.5));
  }
  for (let i = 0; i < 3; i++) {
    const p = outside();
    addGauss(fst, p.x, p.y, c(uniform(off, 160, 220)), uniform(off, 0.6, 0.9));
  }
  for (let i = 0; i < 2; i++) {
    const p = outside();
    addGauss(mdw, p.x, p.y, c(uniform(off, 150, 170)), uniform(off, 0.5, 0.7));
  }

  mark('fields');
  // 2. Water.
  const wr = rngFor(seed, 21);
  const rowGap = 152;
  const chain = riverChain(input.tiles, rowGap);
  const chainIds = new Set(chain.map((t) => t.id));
  const ctrl: Point[] = [];
  if (chain.length) {
    const first = toG(chain[0]!);
    const last = toG(chain[chain.length - 1]!);
    ctrl.push({ x: first.x + c(uniform(wr, -150, 150)), y: -c(40) });
    for (const t of chain) {
      const g = toG(t);
      ctrl.push({ x: g.x + c(uniform(wr, -12, 12)), y: g.y + c(uniform(wr, -10, 10)) });
    }
    ctrl.push({ x: last.x + c(uniform(wr, -150, 150)), y: gh + c(40) });
  } else {
    // No River tiles: the river runs down one side, off the tree.
    const left = nextFloat(wr) < 0.5;
    const x = left ? treeBox.x0 - c(110) : treeBox.x1 + c(110);
    ctrl.push({ x: x + c(uniform(wr, -60, 60)), y: -c(40) });
    ctrl.push({ x: x + c(uniform(wr, -60, 60)), y: gh / 2 });
    ctrl.push({ x: x + c(uniform(wr, -60, 60)), y: gh + c(40) });
  }
  const riverG = meander(smoothPts(ctrl, 16), c(7), PU, rngFor(seed, 22));
  const creeksG: Point[][] = [];
  for (const t of input.tiles) {
    if (count(t, 'river') === 0 || chainIds.has(t.id)) continue;
    const g = toG(t);
    const fromLeft = g.x < gw / 2;
    const edge = { x: fromLeft ? -c(30) : gw + c(30), y: g.y + c(uniform(wr, -60, 60)) };
    const mid = { x: (edge.x + g.x) / 2, y: (edge.y + g.y) / 2 + c(uniform(wr, -40, 40)) };
    // It joins the river at the nearest point below the tile (or the nearest at all).
    let join = riverG[0]!;
    let bestD = Infinity;
    for (const p of riverG) {
      const d = Math.hypot(p.x - g.x, p.y - g.y) + (p.y < g.y ? c(200) : 0);
      if (d < bestD) {
        bestD = d;
        join = p;
      }
    }
    creeksG.push(
      meander(smoothPts([edge, mid, g, join], 20), c(6), PU, rngFor(seed, 30 + creeksG.length)),
    );
  }
  const ponds: Pond[] = [];
  for (const t of input.tiles) {
    if (count(t, 'river') < 2) continue;
    const g = toG(t);
    const a = uniform(wr, 0, Math.PI * 2);
    const d = c(uniform(wr, 42, 58));
    ponds.push({
      cx: g.x + Math.cos(a) * d,
      cy: g.y + Math.sin(a) * d,
      rx: c(62) * uniform(wr, 0.85, 1.1),
      ry: c(44) * uniform(wr, 0.85, 1.1),
    });
  }
  const lakeN = fbm(gw, gh, c(60), 2, seed + 5);
  const lake = new Uint8Array(N);
  for (const p of ponds) {
    const x0p = Math.max(0, Math.floor(p.cx - p.rx * 1.5));
    const x1p = Math.min(gw - 1, Math.ceil(p.cx + p.rx * 1.5));
    const y0p = Math.max(0, Math.floor(p.cy - p.ry * 1.5));
    const y1p = Math.min(gh - 1, Math.ceil(p.cy + p.ry * 1.5));
    for (let y = y0p; y <= y1p; y++) {
      for (let x = x0p; x <= x1p; x++) {
        const i = y * gw + x;
        const e = ((x - p.cx) / p.rx) ** 2 + ((y - p.cy) / p.ry) ** 2;
        if (e < 1 + 0.35 * lakeN.a[i]!) lake[i] = 1;
      }
    }
  }
  const riverOn = new Uint8Array(N);
  strokeCells(riverOn, gw, gh, riverG, 1);
  const creekOn = new Uint8Array(N);
  for (const k of creeksG) strokeCells(creekOn, gw, gh, k, 1);
  const rivD = distanceTo(riverOn, gw, gh);
  const crkD = creeksG.length
    ? distanceTo(creekOn, gw, gh)
    : field(gw, gh, new Float32Array(N).fill(1e6));
  const lakeD = ponds.length
    ? distanceTo(lake, gw, gh)
    : field(gw, gh, new Float32Array(N).fill(1e6));
  const waterDist = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    waterDist[i] = Math.min(rivD.a[i]!, crkD.a[i]! * 1.6, lakeD.a[i]!) * PU;
  }

  mark('water');
  // 3. Height.
  const H = field(gw, gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const rd = (rivD.a[i]! * PU) / 70;
      const cd = (crkD.a[i]! * PU) / 40;
      H.a[i] =
        0.45 * (1 - y / gh) +
        0.16 * mtn.a[i]! +
        0.3 * peak.a[i]! * (0.8 + (0.4 * (n2.a[i]! + 1)) / 2) +
        0.16 * n1.a[i]! +
        0.025 * n2.a[i]! -
        0.1 * Math.exp(-rd * rd) -
        0.05 * Math.exp(-cd * cd);
    }
  }
  const Hs = blur(H, c(2));

  mark('height');
  // 4. Light: hillshade from the top left, 4 flat tones, smoothed.
  const H5 = blur(Hs, c(5));
  const Lx = -0.62;
  const Ly = -0.62;
  const Lz = 0.48;
  const Ln = Math.hypot(Lx, Ly, Lz);
  const shade = field(gw, gh);
  const gk = 300 / PU / 2;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const gx =
        (H5.a[y * gw + Math.min(gw - 1, x + 1)]! - H5.a[y * gw + Math.max(0, x - 1)]!) * gk;
      const gy =
        (H5.a[Math.min(gh - 1, y + 1) * gw + x]! - H5.a[Math.max(0, y - 1) * gw + x]!) * gk;
      const nz = 1 / Math.sqrt(gx * gx + gy * gy + 1);
      shade.a[i] = ((-gx * Lx - gy * Ly + Lz) / Ln) * nz;
    }
  }
  const shadeS = blur(shade, c(2.5));
  const cuts = quantiles(shadeS.a, L.toneQuantiles);
  const q0 = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const v = shadeS.a[i]!;
    q0[i] = v < cuts[0]! ? 0 : v < cuts[1]! ? 1 : v < cuts[2]! ? 2 : 3;
  }
  const tone = medianLevels(q0, gw, gh, Math.max(1, Math.round(c(3))));

  mark('light');
  // 5. Land types.
  const meadowMix = fbm(gw, gh, c(140), 3, seed + 9);
  const type = new Uint8Array(N);
  const forestMask = new Uint8Array(N);
  const clearR = tiles.map(({ t, g }) => ({ g, r: (R * t.scale) / cell }));
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const wd = waterDist[i]!;
      const rock = peak.a[i]! + 0.35 * n2.a[i]! + 0.15 * n3.a[i]! > 0.62;
      const forestF =
        fst.a[i]! * 0.85 -
        mdw.a[i]! * 1.3 -
        peak.a[i]! * 0.5 +
        0.4 * n2.a[i]! +
        0.12 * n3.a[i]! +
        0.12 +
        0.25 * n1.a[i]!;
      let forest = forestF > 0.32 && !rock && wd > 9;
      if (forest) {
        // Tiles sit in clearings, so no tree is ever inside a hex.
        for (const k of clearR) {
          if ((x - k.g.x) ** 2 + (y - k.g.y) ** 2 < k.r * k.r) {
            forest = false;
            break;
          }
        }
      }
      const water =
        rivD.a[i]! * PU < 6.5 + (n3.a[i]! > 0 ? 2.5 : 0) || crkD.a[i]! * PU < 3.2 || lake[i] === 1;
      const bank = wd <= 6 && wd > 0;
      forestMask[i] = forest ? 1 : 0;
      type[i] = water
        ? LAND.water
        : bank
          ? LAND.bank
          : rock
            ? LAND.rock
            : forest
              ? LAND.forest
              : meadowMix.a[i]! > 0.05
                ? LAND.meadowA
                : LAND.meadowB;
    }
  }

  // Colors: each type's 4 tones, higher land tinted toward the haze.
  const [hMin, hMax] = minMax(Hs.a);
  const heightN = new Float32Array(N);
  for (let i = 0; i < N; i++) heightN[i] = (Hs.a[i]! - hMin) / (hMax - hMin || 1);
  const tones = (list: string[]) => list.map(rgbOf);
  const T = {
    [LAND.meadowA]: tones(pal.meadowA),
    [LAND.meadowB]: tones(pal.meadowB),
    [LAND.forest]: tones(pal.forestFloor),
    [LAND.rock]: tones(pal.rock),
    [LAND.bank]: tones(pal.bank),
    [LAND.water]: tones(pal.bank),
  } as Record<number, [number, number, number][]>;
  const haze = rgbOf(pal.haze);
  const snowAbove = pal.snowAbove;
  const rgba = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) {
    const t = type[i]!;
    const col = T[t]![tone[i]!]!;
    const e = heightN[i]! * L.haze;
    let r = col[0] * (1 - e) + haze[0] * e;
    let g = col[1] * (1 - e) + haze[1] * e;
    let b = col[2] * (1 - e) + haze[2] * e;
    // Alpine: rock turns white up high.
    if (snowAbove !== undefined && t === LAND.rock && heightN[i]! > snowAbove) {
      r = r * 0.15 + 246 * 0.85;
      g = g * 0.15 + 245 * 0.85;
      b = b * 0.15 + 242 * 0.85;
    }
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  const hatch = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    hatch[i] = tone[i] === 0 || (tone[i] === 1 && type[i] === LAND.rock) ? 1 : 0;
  }

  mark('types');
  // 6. Contours on a coarser grid (they're smooth anyway).
  const contours = contourLines(blur(Hs, c(3)), Math.max(1, Math.round(c(4))), cell, x0, y0, PU);

  mark('contours');
  // 7. Details.
  const det = rngFor(seed, 51);
  const areaUnits = (width / u(1)) * (height / u(1));
  const flowerN = fbm(gw, gh, c(40), 2, seed + 12);
  const flowers: LandModel['flowers'] = [];
  const grass: LandModel['grass'] = [];
  const cracks: LandModel['cracks'] = [];
  const nDetail = Math.round((5200 * areaUnits) / (1600 * 1000));
  const meadowish = (i: number) => type[i] === LAND.meadowA || type[i] === LAND.meadowB;
  const inClearing = (x: number, y: number) =>
    clearR.some((k) => (x - k.g.x) ** 2 + (y - k.g.y) ** 2 < k.r * k.r);
  for (let n = 0; n < nDetail; n++) {
    const gx = uniform(det, 0, gw - 1);
    const gy = uniform(det, 0, gh - 1);
    const i = Math.floor(gy) * gw + Math.floor(gx);
    if (!meadowish(i) || waterDist[i]! < 8 || inClearing(gx, gy)) continue;
    const w = toW({ x: gx, y: gy });
    if (flowerN.a[i]! > 0.18) {
      flowers.push({
        ...w,
        r: u(uniform(det, 0.9, 1.5)),
        color: pal.flowers[Math.floor(nextFloat(det) * pal.flowers.length)]!,
      });
    } else if (nextFloat(det) < 0.35) {
      grass.push({ ...w, dx: u(uniform(det, -1.5, 1.5)), dy: -u(uniform(det, 2.5, 4.5)) });
    }
  }
  const nCracks = Math.round((2600 * areaUnits) / (1600 * 1000));
  for (let n = 0; n < nCracks; n++) {
    const gx = uniform(det, 0, gw - 1);
    const gy = uniform(det, 0, gh - 1);
    const i = Math.floor(gy) * gw + Math.floor(gx);
    if (type[i] !== LAND.rock) continue;
    const a = uniform(det, -0.5, 0.5) - 0.6;
    const len = u(uniform(det, 4, 10));
    cracks.push({
      ...toW({ x: gx, y: gy }),
      dx: len * Math.cos(a),
      dy: len * Math.sin(a),
      dark: tone[i]! <= 1,
    });
  }

  mark('details');
  // 8. Tree crowns on a jittered grid, lowest drawn last.
  const cr = rngFor(seed, 61);
  const autumnN = fbm(gw, gh, c(80), 3, seed + 31);
  const crowns: Crown[] = [];
  const step = c(11);
  const jit = c(3.5);
  for (let gy = 0; gy < gh; gy += step) {
    for (let gx = 0; gx < gw; gx += step) {
      const x = gx + uniform(cr, -jit, jit);
      const y = gy + uniform(cr, -jit, jit);
      const ix = Math.min(gw - 1, Math.max(0, Math.floor(x)));
      const iy = Math.min(gh - 1, Math.max(0, Math.floor(y)));
      const i = iy * gw + ix;
      // Always draw the same numbers, so changing one rule doesn't reshuffle the rest.
      const r = uniform(cr, 6.2, 9.4);
      const uu = nextFloat(cr);
      const v = nextFloat(cr) * (autumnN.a[i]! > 0.12 ? 0.2 : 99);
      if (!forestMask[i]) continue;
      const conifer = uu < L.conifers;
      const autumn =
        !conifer && pal.autumn.length && v < pal.autumnShare
          ? Math.floor(v * 100) % pal.autumn.length
          : -1;
      crowns.push({ ...toW({ x, y }), r: u(r), tone: tone[i]!, u: uu, autumn });
    }
  }
  crowns.sort((a, b) => a.y - b.y || a.x - b.x);

  mark('crowns');
  const model: LandModel = {
    input,
    x0,
    y0,
    width,
    height,
    gw,
    gh,
    cell,
    rgba,
    tone,
    type,
    heightN,
    heightRaw: Hs.a,
    peak: peak.a,
    forestMask,
    waterDist,
    hatch,
    river: riverG.map(toW),
    creeks: creeksG.map((k) => k.map(toW)),
    ponds: ponds.map((p) => ({
      cx: x0 + p.cx * cell,
      cy: y0 + p.cy * cell,
      rx: p.rx * cell,
      ry: p.ry * cell,
    })),
    riverTiles: chain.map((t) => t.id),
    contours,
    crowns,
    flowers,
    grass,
    cracks,
    hash: '',
  };
  model.hash = hashArrays(tone, type, Hs.a, peak.a);
  return model;
}

// ── Contours ─────────────────────────────────────────────────────────────────

/**
 * Contour lines of a height field (marching squares on every `ds`th cell),
 * joined into polylines in world pixels. About 26 levels; every 5th is
 * heavier; short scraps are dropped.
 */
export function contourLines(
  f: Field,
  ds: number,
  cell: number,
  x0: number,
  y0: number,
  PU: number,
): { pts: Float32Array; major: boolean }[] {
  const w = Math.floor((f.w - 1) / ds) + 1;
  const h = Math.floor((f.h - 1) / ds) + 1;
  const v = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) v[y * w + x] = f.a[y * ds * f.w + x * ds]!;
  const [lo, hi] = minMax(v);
  const levels = L.contours;
  const out: { pts: Float32Array; major: boolean }[] = [];
  const minLen = 30 / (ds * PU);
  for (let li = 0; li < levels; li++) {
    const level = lo + 0.02 + ((hi - lo - 0.04) * li) / (levels - 1);
    // Each crossing lives on a cell edge: horizontal edges keyed 2·i, vertical 2·i + 1.
    const point = new Map<number, Point>();
    const links = new Map<number, number[]>();
    const cross = (
      key: number,
      ax: number,
      ay: number,
      bx: number,
      by: number,
      va: number,
      vb: number,
    ) => {
      if (!point.has(key)) {
        const t = (level - va) / (vb - va);
        point.set(key, { x: ax + (bx - ax) * t, y: ay + (by - ay) * t });
      }
      return key;
    };
    const link = (a: number, b: number) => {
      (links.get(a) ?? links.set(a, []).get(a)!).push(b);
      (links.get(b) ?? links.set(b, []).get(b)!).push(a);
    };
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const a = v[y * w + x]!;
        const b = v[y * w + x + 1]!;
        const cc = v[(y + 1) * w + x + 1]!;
        const d = v[(y + 1) * w + x]!;
        const idx =
          (a > level ? 1 : 0) | (b > level ? 2 : 0) | (cc > level ? 4 : 0) | (d > level ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        const top = () => cross(2 * (y * w + x), x, y, x + 1, y, a, b);
        const bottom = () => cross(2 * ((y + 1) * w + x), x, y + 1, x + 1, y + 1, d, cc);
        const left = () => cross(2 * (y * w + x) + 1, x, y, x, y + 1, a, d);
        const right = () => cross(2 * (y * w + x + 1) + 1, x + 1, y, x + 1, y + 1, b, cc);
        switch (idx) {
          case 1:
          case 14:
            link(left(), top());
            break;
          case 2:
          case 13:
            link(top(), right());
            break;
          case 3:
          case 12:
            link(left(), right());
            break;
          case 4:
          case 11:
            link(right(), bottom());
            break;
          case 6:
          case 9:
            link(top(), bottom());
            break;
          case 7:
          case 8:
            link(left(), bottom());
            break;
          case 5:
            link(left(), top());
            link(right(), bottom());
            break;
          case 10:
            link(top(), right());
            link(left(), bottom());
            break;
        }
      }
    }
    // Walk the links into polylines.
    const seen = new Set<number>();
    for (const startKey of links.keys()) {
      if (seen.has(startKey)) continue;
      // Start from an open end if this chain has one.
      let s = startKey;
      const visitedEnds = new Set<number>([s]);
      let prev = -1;
      for (;;) {
        const n = (links.get(s) ?? []).find((k) => k !== prev && !visitedEnds.has(k));
        if ((links.get(s)?.length ?? 0) < 2 || n === undefined) break;
        prev = s;
        s = n;
        visitedEnds.add(s);
      }
      const chain: number[] = [];
      prev = -1;
      let cur = s;
      while (!seen.has(cur)) {
        seen.add(cur);
        chain.push(cur);
        const next = (links.get(cur) ?? []).find((k) => k !== prev && !seen.has(k));
        if (next === undefined) {
          // A closed loop: back to the start.
          if ((links.get(cur) ?? []).includes(chain[0]!) && chain.length > 2) chain.push(chain[0]!);
          break;
        }
        prev = cur;
        cur = next;
      }
      if (chain.length < minLen) continue;
      const pts = new Float32Array(chain.length * 2);
      chain.forEach((k, i) => {
        const p = point.get(k)!;
        pts[i * 2] = x0 + p.x * ds * cell;
        pts[i * 2 + 1] = y0 + p.y * ds * cell;
      });
      out.push({ pts, major: li % L.contourEvery === 0 });
    }
  }
  return out;
}
