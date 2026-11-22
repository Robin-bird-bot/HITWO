/**
 * The map edge (Phase 10.6, reference/topo_edge.py): the land printed on a
 * sheet of paper lying on a wood table.
 *
 * - The sheet: a cream paper margin around the land (the pencil sketch's
 *   paper color and grain), a printed double border near the paper's edge, a
 *   line where the land starts, a slightly torn edge and a soft shadow. It's
 *   drawn once per land, straight (not rotated), in world pixels.
 * - The table: wood planks with grain and darker seams, made once at stage
 *   size and repeated behind the sheet.
 */
import { MAP_STYLE, u } from '../../../config/mapStyle';
import { PAPER } from './land/palette';
import { simplex } from './land/grid';

const S = MAP_STYLE.sheet;

export interface SheetRect {
  /** The sheet, margin included. */
  x0: number;
  y0: number;
  width: number;
  height: number;
  /** The land printed on it. */
  land: { x0: number; y0: number; width: number; height: number };
}

/** Room around the sheet for its shadow, in world pixels. */
export const sheetPad = (): number =>
  Math.ceil(u(S.shadow.blur) * 3 + u(Math.max(S.shadow.x, S.shadow.y)));

/** A small, stable hash in 0–1 (no randomness: the same sheet every time). */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** The torn edge: points around the sheet, each pushed in a little. */
function tornEdge(w: number, h: number): [number, number][] {
  const step = u(6);
  const tear = u(S.tear);
  const pts: [number, number][] = [];
  const side = (n: number, at: (t: number) => [number, number], inward: [number, number]) => {
    for (let i = 0; i < n; i++) {
      const [x, y] = at(i / n);
      const d = tear * hash(pts.length + 1);
      pts.push([x + inward[0] * d, y + inward[1] * d]);
    }
  };
  side(Math.ceil(w / step), (t) => [t * w, 0], [0, 1]);
  side(Math.ceil(h / step), (t) => [w, t * h], [-1, 0]);
  side(Math.ceil(w / step), (t) => [w - t * w, h], [0, -1]);
  side(Math.ceil(h / step), (t) => [0, h - t * h], [1, 0]);
  return pts;
}

/** Paper grain as a small repeating tile: faint light and dark specks. */
function grainTile(): CanvasPattern | null {
  const g = document.createElement('canvas');
  g.width = 128;
  g.height = 128;
  const ctx = g.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) {
    const v = hash(i * 0.731 + 5);
    const dark = v < 0.5;
    img.data.set(
      dark ? [60, 50, 30, Math.round((0.5 - v) * 40)] : [255, 250, 235, Math.round((v - 0.5) * 50)],
      i * 4,
    );
  }
  ctx.putImageData(img, 0, 0);
  return ctx.createPattern(g, 'repeat');
}

/**
 * Paints the paper sheet into a canvas at `scale` canvas pixels per world
 * pixel, with its shadow: the canvas covers the sheet plus `sheetPad()` on
 * every side.
 */
export function paintSheet(c: HTMLCanvasElement, rect: SheetRect, scale: number): void {
  const pad = sheetPad();
  c.width = Math.round((rect.width + 2 * pad) * scale);
  c.height = Math.round((rect.height + 2 * pad) * scale);
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(scale, 0, 0, scale, pad * scale, pad * scale);
  const edge = tornEdge(rect.width, rect.height);
  const path = new Path2D();
  edge.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();

  // The shadow on the table, then the paper.
  ctx.save();
  ctx.shadowColor = `rgba(0, 0, 0, ${S.shadow.alpha})`;
  ctx.shadowBlur = u(S.shadow.blur) * scale;
  ctx.shadowOffsetX = u(S.shadow.x) * scale;
  ctx.shadowOffsetY = u(S.shadow.y) * scale;
  ctx.fillStyle = PAPER.base;
  ctx.fill(path);
  ctx.restore();
  ctx.save();
  ctx.clip(path);
  const grain = grainTile();
  if (grain) {
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, rect.width, rect.height);
  }

  // The printed double border near the edge, and a line where the land starts.
  ctx.strokeStyle = S.line;
  S.borders.forEach((inset, i) => {
    const d = u(inset);
    ctx.lineWidth = u(S.lineWidths[i] ?? 1);
    ctx.strokeRect(d, d, rect.width - 2 * d, rect.height - 2 * d);
  });
  ctx.lineWidth = u(1);
  const lx = rect.land.x0 - rect.x0;
  const ly = rect.land.y0 - rect.y0;
  ctx.strokeRect(lx, ly, rect.land.width, rect.land.height);
  ctx.restore();
}

/**
 * The wood table (topo_edge.py → wood()): warm brown planks with grain,
 * darker seams and end joints, lit a little from the top left. Stage-sized
 * (`w` × `h`), meant to repeat. The vignette is drawn on the screen instead.
 */
export function paintTable(w: number, h: number): HTMLCanvasElement {
  const T = MAP_STYLE.table;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const img = ctx.createImageData(w, h);
  const grain = simplex(5);
  const fine = simplex(6);
  const base = [0x8a, 0x5b, 0x3b];
  const plankH = T.plank;
  for (let y = 0; y < h; y++) {
    const plank = Math.floor(y / plankH);
    const tint = 1 + (hash(plank + 3) - 0.5) * 0.12;
    const joint = Math.floor(300 + hash(plank + 40) * 900) % w;
    for (let x = 0; x < w; x++) {
      // Long grain along the planks, finer streaks, and rings.
      const g = grain((x * 0.08) / 260, y / 260) * 0.6 + grain((x * 0.16) / 130, y / 130) * 0.3;
      const f = fine((x * 0.05) / 30, y / 30);
      const rings = Math.sin((y + g * 90) / 7) * 0.5 + 0.5;
      let k = tint * (0.86 + 0.14 * rings) * (1 + 0.1 * f);
      if (y % plankH < 2.2) k *= 0.55;
      if (x === joint || x === joint + 1) k *= 0.6;
      k *= 1 + 0.1 * (1 - (x / w + y / h) / 2);
      const i = (y * w + x) * 4;
      img.data[i] = Math.min(255, base[0]! * k);
      img.data[i + 1] = Math.min(255, base[1]! * k);
      img.data[i + 2] = Math.min(255, base[2]! * k);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

let tableUrl: string | undefined;

/** The table as an image URL, made once and reused. */
export function tableImage(): string {
  if (tableUrl) return tableUrl;
  tableUrl = paintTable(800, 500).toDataURL('image/jpeg', 0.85);
  return tableUrl;
}
