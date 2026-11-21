/**
 * Painting the illustrated map's land (Phase 10.5, sections 4–5) with
 * Canvas2D, from the land model: works in a worker (OffscreenCanvas) or on
 * the main thread. Follows reference/topo.py's draw order and numbers:
 *
 * - **Painted:** the base tones stretched to size, contours, flowers, grass
 *   and cracks, water (sand, shallows, water, a deep centre, a few ripples),
 *   tree crowns lowest-last, stamps with ground shadows, then paper grain,
 *   brush streaks and the warm and cool wash.
 * - **Sketch:** paper with grain, graphite contours, rivers as two ink lines,
 *   some trees as little symbols, and hatching in the shadows and on rock.
 */
import { MAP_STYLE, u } from '../../../config/mapStyle';
import type { Point } from '../mapLayout';
import type { LandFeatures, Stamp, StampKind } from './land/features';
import type { Crown, LandModel } from './land/model';
import { PALETTES, PAPER, rgbOf } from './land/palette';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export type StampImages = Partial<Record<StampKind, ImageBitmap | HTMLImageElement>>;

/** A canvas of this size: offscreen where there's one, else a DOM canvas. */
export function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const ctx2d = (c: AnyCanvas): Ctx => {
  const ctx = c.getContext('2d') as Ctx | null;
  if (!ctx) throw new Error('No 2D canvas');
  return ctx;
};

const rgba = (hex: string, a: number) => {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
};

function line(ctx: Ctx, pts: readonly Point[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
}

/** Paper grain and horizontal brush streaks, as a small tile to repeat. */
function grainTile(seed: number, strength: number): AnyCanvas {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = ctx2d(c);
  const img = ctx.createImageData(size, size);
  let s = seed >>> 0 || 1;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  // Grain: noise; streaks: noise smeared sideways (a running average along the row).
  const noise = new Float32Array(size * size);
  for (let i = 0; i < noise.length; i++) noise[i] = rand() * 2 - 1;
  const streak = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    let acc = 0;
    const r = 12;
    for (let x = -r; x <= r; x++) acc += noise[y * size + ((x + size) % size)]!;
    for (let x = 0; x < size; x++) {
      streak[y * size + x] = acc / (2 * r + 1);
      acc += noise[y * size + ((x + r + 1) % size)]! - noise[y * size + ((x - r + size) % size)]!;
    }
  }
  for (let i = 0; i < noise.length; i++) {
    const v = 128 + (noise[i]! * 0.022 + streak[i]! * 0.25) * 255 * strength;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Repeats a grain tile over the whole canvas, softly (pixel space). */
function applyGrain(ctx: Ctx, w: number, h: number, tile: AnyCanvas) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'soft-light';
  const pattern = ctx.createPattern(tile as CanvasImageSource, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

// ── Water ────────────────────────────────────────────────────────────────────

function lakePoly(p: { cx: number; cy: number; rx: number; ry: number }): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    const r = 1 + 0.17 * Math.sin(3 * a + 1) + 0.08 * Math.sin(7 * a);
    out.push({ x: p.cx + p.rx * r * Math.cos(a), y: p.cy + p.ry * r * Math.sin(a) });
  }
  return out;
}

/** One layer of all the water: the river (wider downstream, uneven), creeks and ponds. */
function waterLayer(ctx: Ctx, land: LandModel, wr: number, wc: number, color: string) {
  const R = land.river;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  for (let i = 0; i < R.length - 1; i++) {
    const k = 1 + 0.28 * Math.sin(i * 0.11) + 0.12 * Math.sin(i * 0.37 + 1) + 0.25 * (i / R.length);
    ctx.lineWidth = u(wr) * k;
    ctx.beginPath();
    ctx.moveTo(R[i]!.x, R[i]!.y);
    ctx.lineTo(R[i + 1]!.x, R[i + 1]!.y);
    ctx.stroke();
  }
  ctx.lineWidth = u(wc);
  for (const k of land.creeks) {
    line(ctx, k);
    ctx.stroke();
  }
  for (const p of land.ponds) {
    line(ctx, lakePoly(p));
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = Math.max(0, u(wr - 12));
    if (ctx.lineWidth > 0) ctx.stroke();
  }
}

function paintWater(ctx: Ctx, land: LandModel) {
  const W = PALETTES[land.input.palette].water;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  waterLayer(ctx, land, 22, 12, W.sand);
  waterLayer(ctx, land, 17, 9, W.shallows);
  waterLayer(ctx, land, 12.5, 6, W.water);
  // A deep centre down the river, and in each pond.
  ctx.strokeStyle = W.deep;
  ctx.lineWidth = u(4.5);
  line(ctx, land.river.slice(3, -3));
  ctx.stroke();
  ctx.fillStyle = W.deep;
  for (const p of land.ponds) {
    line(
      ctx,
      lakePoly(p).map((q) => ({ x: p.cx + (q.x - p.cx) * 0.62, y: p.cy + (q.y - p.cy) * 0.58 })),
    );
    ctx.closePath();
    ctx.fill();
  }
  // A few short ripples (never a centre line, or it looks like a road).
  let s = 4;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  ctx.strokeStyle = rgba(W.ripple, 0.9);
  for (const [pts, step] of [
    [land.river, 5] as const,
    ...land.creeks.map((k) => [k, 7] as const),
  ]) {
    for (let i = 2; i < pts.length - 3; i += step) {
      if (rand() >= 0.16) continue;
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const o = (rand() < 0.5 ? -1 : 1) * u(2.5 + rand());
      ctx.lineWidth = u(1.2 + rand());
      ctx.beginPath();
      ctx.moveTo(a.x + o, a.y + o);
      ctx.lineTo(b.x + o, b.y + o);
      ctx.stroke();
    }
  }
  ctx.lineWidth = u(1.6);
  for (const p of land.ponds) {
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2;
      const r = 0.2 + rand() * 0.6;
      const x = p.cx + p.rx * r * Math.cos(a);
      const y = p.cy + p.ry * r * Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(x - u(6), y);
      ctx.lineTo(x + u(6), y);
      ctx.stroke();
    }
  }
}

function sketchWater(ctx: Ctx, land: LandModel) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.75;
  waterLayer(ctx, land, 16, 9, PAPER.ink);
  ctx.globalAlpha = 1;
  waterLayer(ctx, land, 13, 6.5, '#EEE6CF');
  ctx.strokeStyle = rgba('#8FA6AC', 0.35);
  ctx.lineWidth = u(1.2);
  for (const o of [-3, 3]) {
    line(
      ctx,
      land.river.filter((_, i) => i % 2 === 0).map((p) => ({ x: p.x + u(o * 0.3), y: p.y + u(o) })),
    );
    ctx.stroke();
  }
}

// ── Trees ────────────────────────────────────────────────────────────────────

function paintCrowns(ctx: Ctx, crowns: readonly Crown[], land: LandModel) {
  const pal = PALETTES[land.input.palette];
  const FT = pal.crown;
  const shadow = rgba(pal.crownShadow, 0.55);
  const conifers = MAP_STYLE.land.conifers;
  for (const c of crowns) {
    const { x, y, r } = c;
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(x + r * 0.38, y + r * 0.5, r, 0, Math.PI * 2);
    ctx.fill();
    const con = c.u < conifers;
    let base: string;
    let hi: string;
    let dk: string;
    if (c.autumn >= 0 && !con) {
      const a = pal.autumn[c.autumn]!;
      dk = a[0]!;
      base = a[1]!;
      hi = a[2]!;
    } else {
      const idx = Math.min(3, Math.max(0, c.tone));
      base = FT[Math.max(0, idx - (con ? 1 : 0))]!;
      hi = FT[Math.min(3, idx + 1)]!;
      dk = FT[Math.max(0, idx - 1)]!;
    }
    if (con) {
      const k = 8;
      ctx.fillStyle = dk;
      ctx.beginPath();
      for (let i = 0; i < k * 2; i++) {
        const a = (i * Math.PI) / k + c.u * 3;
        const rad = r * (i % 2 === 0 ? 1.05 : 0.62);
        const px = x + rad * Math.cos(a);
        const py = y + rad * Math.sin(a);
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.arc(x - r * 0.12, y - r * 0.14, r * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.arc(x - r * 0.16, y - r * 0.18, r * 0.78, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(x - r * 0.34, y - r * 0.38, r * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function sketchCrowns(ctx: Ctx, crowns: readonly Crown[]) {
  const share = MAP_STYLE.land.sketchTrees;
  ctx.strokeStyle = rgba('#7D7766', 0.42);
  ctx.lineWidth = u(1);
  for (const c of crowns) {
    if (c.u < 1 - share) continue;
    ctx.beginPath();
    ctx.arc(c.x, c.y - c.r * 0.2, c.r * 0.55, Math.PI * 0.85, Math.PI * 2.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c.x, c.y + c.r * 0.35);
    ctx.lineTo(c.x, c.y + c.r * 0.9);
    ctx.stroke();
  }
}

function paintContours(ctx: Ctx, land: LandModel, color: string, alpha: number, width: number) {
  for (const c of land.contours) {
    ctx.strokeStyle = rgba(color, Math.min(1, alpha * (c.major ? 1.6 : 1)));
    ctx.lineWidth = u(width * (c.major ? 1.7 : 1));
    ctx.beginPath();
    for (let i = 0; i < c.pts.length; i += 2) {
      if (i) ctx.lineTo(c.pts[i]!, c.pts[i + 1]!);
      else ctx.moveTo(c.pts[i]!, c.pts[i + 1]!);
    }
    ctx.stroke();
  }
}

function paintDetails(ctx: Ctx, land: LandModel) {
  for (const f of land.flowers) {
    ctx.fillStyle = rgba(f.color, 0.95);
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = rgba('#6F8F55', 0.55);
  ctx.lineWidth = u(0.9);
  ctx.beginPath();
  for (const g of land.grass) {
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + g.dx, g.y + g.dy);
  }
  ctx.stroke();
  ctx.lineWidth = u(1);
  for (const dark of [false, true]) {
    ctx.strokeStyle = rgba(PALETTES[land.input.palette].rock[0]!, dark ? 0.5 : 0.35);
    ctx.beginPath();
    for (const c of land.cracks) {
      if (c.dark !== dark) continue;
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + c.dx, c.y + c.dy);
    }
    ctx.stroke();
  }
}

/** Stamps, back to front, each with a soft oval ground shadow. A missing image is skipped. */
function paintStamps(ctx: Ctx, stamps: readonly Stamp[], images: StampImages) {
  for (const s of [...stamps].sort((a, b) => a.y - b.y)) {
    const img = images[s.kind];
    if (!img) continue;
    const iw = 'naturalWidth' in img ? img.naturalWidth : img.width;
    const ih = 'naturalHeight' in img ? img.naturalHeight : img.height;
    if (!iw || !ih) continue;
    const h = s.h;
    const w = (h * iw) / ih;
    if (s.kind !== 'waterfall') {
      ctx.fillStyle = 'rgba(28,51,61,0.28)';
      ctx.beginPath();
      ctx.ellipse(s.x + w * 0.08, s.y, w * 0.42, w * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.drawImage(img as CanvasImageSource, s.x - w / 2, s.y - h, w, h);
  }
}

/** Hatching in the deep shadows and on rock: a diagonal pattern laid over runs of shadow. */
function paintHatch(ctx: Ctx, land: LandModel, scale: number) {
  const tileSize = Math.max(4, Math.round(10 * (scale / 2) * 2));
  const tile = makeCanvas(tileSize, tileSize);
  const t = ctx2d(tile);
  t.strokeStyle = 'rgba(80,70,52,0.18)';
  t.lineWidth = Math.max(1, 1.6 * (scale / 2));
  for (const o of [-tileSize, 0, tileSize]) {
    t.beginPath();
    t.moveTo(o, tileSize);
    t.lineTo(o + tileSize, 0);
    t.stroke();
  }
  const pattern = ctx.createPattern(tile as CanvasImageSource, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = pattern;
  // Blocks of a few cells; runs along each row merged into one rectangle.
  const block = Math.max(1, Math.round(u(4) / land.cell));
  const px = land.cell * block * scale;
  for (let by = 0; by * block < land.gh; by++) {
    let start = -1;
    const bw = Math.ceil(land.gw / block);
    for (let bx = 0; bx <= bw; bx++) {
      const on =
        bx < bw &&
        land.hatch[
          Math.min(land.gh - 1, by * block) * land.gw + Math.min(land.gw - 1, bx * block)
        ] === 1;
      if (on && start < 0) start = bx;
      if (!on && start >= 0) {
        ctx.fillRect(start * px, by * px, (bx - start) * px, px);
        start = -1;
      }
    }
  }
  ctx.restore();
}

// ── The two images ───────────────────────────────────────────────────────────

export interface Painted {
  painted: AnyCanvas;
  sketch: AnyCanvas;
  scale: number;
  ms: number;
}

/**
 * Paints both images of the land at `scale` canvas pixels per world pixel.
 * Coordinates inside are world pixels.
 */
export function paintLand(
  land: LandModel,
  features: LandFeatures,
  images: StampImages,
  scale: number,
): Painted {
  const t0 = performance.now();
  const W = Math.ceil(land.width * scale);
  const H = Math.ceil(land.height * scale);
  const world = (ctx: Ctx) =>
    ctx.setTransform(scale, 0, 0, scale, -land.x0 * scale, -land.y0 * scale);

  // Painted.
  const painted = makeCanvas(W, H);
  const p = ctx2d(painted);
  const base = makeCanvas(land.gw, land.gh);
  const bctx = ctx2d(base);
  const img = bctx.createImageData(land.gw, land.gh);
  img.data.set(land.rgba);
  bctx.putImageData(img, 0, 0);
  p.imageSmoothingEnabled = true;
  p.imageSmoothingQuality = 'high';
  p.drawImage(
    base as CanvasImageSource,
    0,
    0,
    land.gw * land.cell * scale,
    land.gh * land.cell * scale,
  );
  world(p);
  const pal = PALETTES[land.input.palette];
  paintContours(p, land, pal.contour, MAP_STYLE.land.contourAlpha, 0.9);
  paintDetails(p, land);
  paintWater(p, land);
  paintCrowns(p, land.crowns, land);
  paintStamps(p, features.stamps, images);
  applyGrain(p, W, H, grainTile(land.input.runSeed + 2, 1));
  // Warm light from the top left, a cool shade toward the bottom right.
  p.setTransform(1, 0, 0, 1, 0, 0);
  const warm = p.createLinearGradient(0, 0, W * 0.6, H * 0.6);
  warm.addColorStop(0, 'rgba(255,227,168,0.16)');
  warm.addColorStop(1, 'rgba(255,227,168,0)');
  p.fillStyle = warm;
  p.fillRect(0, 0, W, H);
  const cool = p.createLinearGradient(W * 0.45, H * 0.45, W, H);
  cool.addColorStop(0, 'rgba(18,28,44,0)');
  cool.addColorStop(1, 'rgba(18,28,44,0.1)');
  p.fillStyle = cool;
  p.fillRect(0, 0, W, H);

  // Sketch.
  const sketch = makeCanvas(W, H);
  const k = ctx2d(sketch);
  k.fillStyle = PAPER.base;
  k.fillRect(0, 0, W, H);
  world(k);
  paintContours(k, land, PAPER.graphite, MAP_STYLE.land.contourAlpha, 0.8);
  sketchWater(k, land);
  sketchCrowns(k, land.crowns);
  paintHatch(k, land, scale);
  applyGrain(k, W, H, grainTile(land.input.runSeed + 4, 0.6));

  return { painted, sketch, scale, ms: performance.now() - t0 };
}
