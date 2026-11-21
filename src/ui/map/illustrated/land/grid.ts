/**
 * Field helpers for the illustrated map's land (Phase 10.5): seeded simplex
 * noise and fbm, blurs, distance transforms, quantiles and smoothing, all on
 * flat Float32Arrays (row by row, `w` wide). Pure, so the land can be built
 * in a worker or a test.
 */
import { nextFloat, seedRng, type RngState } from '../../../../engine';

export interface Field {
  w: number;
  h: number;
  a: Float32Array;
}

export const field = (w: number, h: number, a?: Float32Array): Field => ({
  w,
  h,
  a: a ?? new Float32Array(w * h),
});

// ── Simplex noise (2D, seeded) ───────────────────────────────────────────────

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** A seeded 2D simplex noise function, about −1 to 1. */
export function simplex(seed: number): (x: number, y: number) => number {
  const rng = seedRng(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(nextFloat(rng) * (i + 1));
    const t = p[i]!;
    p[i] = p[j]!;
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;
  const corner = (gi: number, x: number, y: number) => {
    const t = 0.5 - x * x - y * y;
    if (t < 0) return 0;
    const g = GRAD[gi & 7]!;
    return t * t * t * t * (g[0] * x + g[1] * y);
  };
  return (xin, yin) => {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const n0 = corner(perm[ii + perm[jj]!]!, x0, y0);
    const n1 = corner(perm[ii + i1 + perm[jj + j1]!]!, x1, y1);
    const n2 = corner(perm[ii + 1 + perm[jj + 1]!]!, x2, y2);
    return 70 * (n0 + n1 + n2);
  };
}

/**
 * fbm noise on a grid: `octaves` layers from `scale` (in cells) down, each
 * half as strong and twice as fine. Like the prototype, each layer is
 * sampled on a coarse grid and stretched, so it's quick.
 */
export function fbm(w: number, h: number, scale: number, octaves: number, seed: number): Field {
  const out = field(w, h);
  let amp = 1;
  let f = 1 / scale;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const noise = simplex(seed * 31 + o);
    const step = Math.max(1, Math.floor(scale / (8 * 2 ** o)));
    const cw = Math.floor(w / step) + 2;
    const ch = Math.floor(h / step) + 2;
    const coarse = new Float32Array(cw * ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) coarse[y * cw + x] = noise(x * step * f, y * step * f);
    }
    for (let y = 0; y < h; y++) {
      const fy = y / step;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const r0 = y0 * cw;
      const r1 = r0 + cw;
      for (let x = 0; x < w; x++) {
        const fx = x / step;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const a = coarse[r0 + x0]!;
        const b = coarse[r0 + x0 + 1]!;
        const c = coarse[r1 + x0]!;
        const d = coarse[r1 + x0 + 1]!;
        out.a[y * w + x]! += amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
      }
    }
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  for (let i = 0; i < out.a.length; i++) out.a[i]! /= norm;
  return out;
}

// ── Blobs ────────────────────────────────────────────────────────────────────

/** Adds `weight` × a gaussian blob at (cx, cy) with spread s (cells), only where it's not tiny. */
export function addGauss(f: Field, cx: number, cy: number, s: number, weight: number): void {
  if (!weight) return;
  const r = Math.ceil(s * 3.2);
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(f.w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(f.h - 1, Math.ceil(cy + r));
  if (x1 < x0 || y1 < y0) return;
  const k = 1 / (2 * s * s);
  // A gaussian is a row profile times a column profile: work each out once.
  const ex = new Float32Array(x1 - x0 + 1);
  for (let x = x0; x <= x1; x++) ex[x - x0] = Math.exp(-(x - cx) * (x - cx) * k);
  const a = f.a;
  for (let y = y0; y <= y1; y++) {
    const ey = weight * Math.exp(-(y - cy) * (y - cy) * k);
    const row = y * f.w;
    for (let x = x0; x <= x1; x++) a[row + x]! += ey * ex[x - x0]!;
  }
}

// ── Blur ─────────────────────────────────────────────────────────────────────

/** One box blur pass of radius r along rows (horizontal) or columns; edges repeat. */
function boxPass(
  src: Float32Array,
  dst: Float32Array,
  w: number,
  h: number,
  r: number,
  horiz: boolean,
) {
  const n = horiz ? w : h;
  const lines = horiz ? h : w;
  const stride = horiz ? 1 : w;
  const inv = 1 / (2 * r + 1);
  const last = n - 1;
  for (let l = 0; l < lines; l++) {
    const base = horiz ? l * w : l;
    const first = src[base]!;
    const end = src[base + last * stride]!;
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += i < 0 ? first : i > last ? end : src[base + i * stride]!;
    for (let i = 0; i < n; i++) {
      dst[base + i * stride] = acc * inv;
      const add = i + r + 1;
      const sub = i - r;
      acc +=
        (add > last ? end : src[base + add * stride]!) -
        (sub < 0 ? first : src[base + sub * stride]!);
    }
  }
}

/**
 * A gaussian blur of spread s (cells), as three box blurs each way, which is
 * close enough. Separate spreads for x and y make streaks.
 */
export function blur(f: Field, sx: number, sy: number = sx): Field {
  const out = field(f.w, f.h, f.a.slice());
  const tmp = new Float32Array(f.a.length);
  const radius = (s: number) => Math.max(0, Math.round((Math.sqrt((12 * s * s) / 3 + 1) - 1) / 2));
  const rx = radius(sx);
  const ry = radius(sy);
  for (let i = 0; i < 3; i++) {
    if (rx > 0) {
      boxPass(out.a, tmp, f.w, f.h, rx, true);
      out.a.set(tmp);
    }
    if (ry > 0) {
      boxPass(out.a, tmp, f.w, f.h, ry, false);
      out.a.set(tmp);
    }
  }
  return out;
}

// ── Distance ─────────────────────────────────────────────────────────────────

/** The exact 1D squared distance transform (Felzenszwalb and Huttenlocher). */
function edt1d(f: Float32Array, n: number, d: Float32Array, v: Int32Array, z: Float32Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k--;
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    d[q] = (q - v[k]!) * (q - v[k]!) + f[v[k]!]!;
  }
}

/** Distance (in cells) from every cell to the nearest set cell of `on`. */
export function distanceTo(on: Uint8Array, w: number, h: number): Field {
  const INF = 1e12;
  const g = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = on[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float32Array(n);
  const d = new Float32Array(n);
  const v = new Int32Array(n);
  const z = new Float32Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = g[y * w + x]!;
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y]!;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x]!;
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]!);
  }
  return field(w, h, g);
}

/** Marks the cells a thick polyline covers (world points already in cells). */
export function strokeCells(
  on: Uint8Array,
  w: number,
  h: number,
  pts: readonly { x: number; y: number }[],
  radius: number,
): void {
  const r2 = radius * radius;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let s = 0; s <= steps; s++) {
      const cx = a.x + ((b.x - a.x) * s) / steps;
      const cy = a.y + ((b.y - a.y) * s) / steps;
      const x0 = Math.max(0, Math.floor(cx - radius));
      const x1 = Math.min(w - 1, Math.ceil(cx + radius));
      const y0 = Math.max(0, Math.floor(cy - radius));
      const y1 = Math.min(h - 1, Math.ceil(cy + radius));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) on[y * w + x] = 1;
        }
      }
    }
  }
}

// ── Values ───────────────────────────────────────────────────────────────────

/** The values at these quantiles (0–1), from a sample of the field. */
export function quantiles(a: Float32Array, qs: readonly number[]): number[] {
  const step = Math.max(1, Math.floor(a.length / 200_000));
  const sample: number[] = [];
  for (let i = 0; i < a.length; i += step) sample.push(a[i]!);
  sample.sort((x, y) => x - y);
  return qs.map((q) => sample[Math.min(sample.length - 1, Math.floor(q * sample.length))] ?? 0);
}

export function minMax(a: Float32Array): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < a.length; i++) {
    const v = a[i]!;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

/**
 * A median filter for tone levels 0–3 in a (2r+1)² window: the median is the
 * smallest level k whose count of levels ≤ k reaches half the window. Counts
 * come from summed-area tables, so it's quick at any size.
 */
export function medianLevels(
  q: Uint8Array,
  w: number,
  h: number,
  r: number,
  levels = 4,
): Uint8Array {
  const out = new Uint8Array(q.length);
  out.fill(levels - 1);
  const W = w + 1;
  const sat = new Int32Array(W * (h + 1));
  for (let k = levels - 2; k >= 0; k--) {
    sat.fill(0);
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += q[y * w + x]! <= k ? 1 : 0;
        sat[(y + 1) * W + x + 1] = sat[y * W + x + 1]! + row;
      }
    }
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r);
        const x1 = Math.min(w, x + r + 1);
        const n = (y1 - y0) * (x1 - x0);
        const c = sat[y1 * W + x1]! - sat[y0 * W + x1]! - sat[y1 * W + x0]! + sat[y0 * W + x0]!;
        if (c * 2 > n) out[y * w + x] = k;
      }
    }
  }
  return out;
}

/** A seeded number generator for one part of the land. */
export const rngFor = (seed: number, part: number): RngState => seedRng((seed + part * 7919) >>> 0);

/** A float from lo to hi. */
export const uniform = (rng: RngState, lo: number, hi: number): number =>
  lo + nextFloat(rng) * (hi - lo);

/** A short, stable fingerprint of some arrays (for the determinism test and the cache). */
export function hashArrays(...arrays: ArrayLike<number>[]): string {
  let h = 0x811c9dc5;
  for (const a of arrays) {
    const step = Math.max(1, Math.floor(a.length / 50_000));
    for (let i = 0; i < a.length; i += step) {
      h = Math.imul(h ^ Math.round((a[i] ?? 0) * 1000), 0x01000193) >>> 0;
    }
    h = Math.imul(h ^ a.length, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
