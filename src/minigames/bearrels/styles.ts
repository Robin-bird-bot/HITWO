/**
 * Bearrels' three art styles (docs/design/10-minigames.md, "Art styles") as
 * geometry: where each style draws the barrels, the hikers and the crosshair
 * on the 4:3 game screen (1280 × 960), where a drop lands, and the in-game
 * UI's boxes. One scene model, three renderers: nothing in the game's state
 * depends on the style, so switching styles mid-round only redraws.
 *
 * - **Earthy pixel** and **Teal pixel** are drawn at 280 × 210 from Wyatt's
 *   sprites, exactly where each style's layout.json says, then scaled up.
 * - **Silhouette** is the first version's SVG scene (1280 × 720) shown at
 *   4:3, with a sky strip above and a ground strip below.
 */
import { BALANCE } from '../../config/balance';
import SILHOUETTE from '../../../public/assets/minigames/bearrels/layout.json';
import EARTH from '../../../public/assets/minigames/bearrels/pixel-earth/layout.json';
import TEAL from '../../../public/assets/minigames/bearrels/pixel-teal/layout.json';
import { barrelLayout, hikerSpots } from './logic';

const B = BALANCE.minigames.bearrels;

export type ArtStyle = 'earth' | 'teal' | 'silhouette';
export type PixelStyle = Exclude<ArtStyle, 'silhouette'>;

/** The styles, in the testing tab's order. Earthy pixel is the default. */
export const ART_STYLES = [
  { id: 'earth', label: 'Earthy pixel' },
  { id: 'teal', label: 'Teal pixel' },
  { id: 'silhouette', label: 'Silhouette' },
] as const satisfies readonly { id: ArtStyle; label: string }[];

export const isArtStyle = (v: unknown): v is ArtStyle => ART_STYLES.some((s) => s.id === v);

/** The style a remembered value names, or the default. */
export const toArtStyle = (v: unknown): ArtStyle => (isArtStyle(v) ? v : ART_STYLES[0].id);

/** The next style, for the Style button and the S key. */
export function nextStyle(s: ArtStyle): ArtStyle {
  const i = ART_STYLES.findIndex((x) => x.id === s);
  return ART_STYLES[(i + 1) % ART_STYLES.length]!.id;
}

export const styleLabel = (s: ArtStyle): string => ART_STYLES.find((x) => x.id === s)?.label ?? s;

// ── The game screen ────────────────────────────────────────────────────────

/** Every minigame is laid out at 1280 × 960 (4:3), the turned GPS's screen. */
export const GAME = { width: 1280, height: 960 } as const;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height;

const inside = (r: Rect, x: number, y: number) =>
  x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height;

// ── Silhouette ─────────────────────────────────────────────────────────────

/** The silhouette scene is 1280 × 720; at 4:3 its view starts this far above it. */
export const SILHOUETTE_TOP = -SILHOUETTE.viewBox_4x3[1]!;
export const SILHOUETTE_VIEW = SILHOUETTE.viewBox_4x3.join(' ');
/** The sky and ground strips that fill the 4:3 view (layout.json `extend_for_4x3`). */
export const SILHOUETTE_STRIPS = [SILHOUETTE.extend_for_4x3.sky, SILHOUETTE.extend_for_4x3.ground];

// ── The pixel styles ───────────────────────────────────────────────────────

/** The pixel styles are drawn at this size, then scaled up. */
export const PIXEL = { width: 280, height: 210 } as const;

export type PixelLayout = typeof EARTH;
export const PIXEL_LAYOUTS: Readonly<Record<PixelStyle, PixelLayout>> = {
  earth: EARTH,
  teal: TEAL,
};

/** Each hiker sprite's size in pixels, by its file's scale (hiker-<id>-<scale>.png). */
export const HIKER_SPRITES = {
  100: { w: 30, h: 28 },
  80: { w: 22, h: 20 },
  62: { w: 18, h: 16 },
} as const;
export type HikerSpriteScale = keyof typeof HIKER_SPRITES;

/**
 * Each pixel style's sprite sizes, from the files (a test checks them), and
 * the first row with any art in each bear sprite, so the bear can rise from
 * where its hidden ears are.
 */
export const PIXEL_SPRITES = {
  earth: {
    bear: { w: 64, h: 66, hiddenTop: 53, upTop: 5 },
    log: { w: 96, h: 14 },
    shadows: { 'shadow-28.png': { w: 40, h: 8 }, 'shadow-23.png': { w: 34, h: 8 } },
  },
  teal: {
    bear: { w: 58, h: 62, hiddenTop: 49, upTop: 4 },
    log: { w: 92, h: 13 },
    shadows: { 'shadow-30.png': { w: 40, h: 8 }, 'shadow-27.png': { w: 36, h: 8 } },
  },
} as const satisfies Record<
  PixelStyle,
  {
    bear: { w: number; h: number; hiddenTop: number; upTop: number };
    log: { w: number; h: number };
    shadows: Record<string, { w: number; h: number }>;
  }
>;
/** The muzzle flash sprite is square. */
export const MUZZLE_SIZE = 15;

/** How far below its "up" place the bear starts rising: its head where the hidden ears are. */
export function bearRise(style: PixelStyle): number {
  const b = PIXEL_LAYOUTS[style].bear;
  const s = PIXEL_SPRITES[style].bear;
  return b.hidden.y + s.hiddenTop - (b.up.y + s.upTop);
}

/** Where a pixel scene sits on the game screen: a pixel (px, py) is drawn at (x + px × unit, y + py × unit). */
export interface Frame {
  x: number;
  y: number;
  unit: number;
}

/** The pixel scene filling the whole screen (previews, and before it's measured). */
export const FILL: Frame = { x: 0, y: 0, unit: GAME.width / PIXEL.width };

/**
 * The largest whole-number pixel scale that fits, letterboxed: `shownWidth`
 * is how wide the game screen is drawn, in device pixels.
 */
export function pixelFrame(shownWidth: number): Frame {
  const k = Math.floor(Math.min(shownWidth / PIXEL.width, (shownWidth * 0.75) / PIXEL.height));
  if (!Number.isFinite(k) || k < 1) return FILL;
  const unit = (k * GAME.width) / shownWidth;
  return {
    x: (GAME.width - PIXEL.width * unit) / 2,
    y: (GAME.height - PIXEL.height * unit) / 2,
    unit,
  };
}

const clampBarrels = (n: number) => Math.min(6, Math.max(3, Math.round(n))) as 3 | 4 | 5 | 6;

/** A pixel style's barrels for n barrels, in pixels (layout.json `barrels`). */
export const pixelBarrels = (style: PixelStyle, n: number) =>
  PIXEL_LAYOUTS[style].barrels[String(clampBarrels(n)) as '3' | '4' | '5' | '6'];

/** The sprite scale for this many hikers behind one barrel (layout.json `scale_by_count`). */
export function hikerSpriteScale(count: number): HikerSpriteScale {
  return count <= 1 ? 100 : count === 2 ? 80 : 62;
}

/**
 * Where each hiker behind a pixel barrel goes, in pixels (layout.json
 * `hikers.placement`): the k-th of g at left = x + (k − (g − 1) ÷ 2) × w × 0.75 − w ÷ 2,
 * top = barrel.y − h × 0.55, rounded to whole pixels.
 */
export function pixelHikers(
  barrel: { y: number; center: readonly number[] },
  count: number,
): { left: number; top: number; scale: HikerSpriteScale; w: number; h: number }[] {
  const scale = hikerSpriteScale(count);
  const { w, h } = HIKER_SPRITES[scale];
  const x = barrel.center[0] ?? 0;
  return Array.from({ length: count }, (_, k) => ({
    left: Math.round(x + (k - (count - 1) / 2) * w * 0.75 - w / 2),
    top: Math.round(barrel.y - h * 0.55),
    scale,
    w,
    h,
  }));
}

// ── Any style, on the game screen ──────────────────────────────────────────

/** A barrel on the game screen: its box and center. */
export interface BarrelSpot extends Rect {
  cx: number;
  cy: number;
}

/** Each barrel's box on the game screen (1280 × 960), in this style. */
export function barrelBoxes(style: ArtStyle, n: number, frame: Frame = FILL): BarrelSpot[] {
  if (style === 'silhouette') {
    return barrelLayout(n).map((b) => ({
      left: b.x - b.width / 2,
      top: b.top + SILHOUETTE_TOP,
      width: b.width,
      height: b.height,
      cx: b.x,
      cy: b.top + SILHOUETTE_TOP + b.height / 2,
    }));
  }
  const u = frame.unit;
  return pixelBarrels(style, n).map((b) => ({
    left: frame.x + b.x * u,
    top: frame.y + b.y * u,
    width: b.w * u,
    height: b.h * u,
    cx: frame.x + (b.center[0] ?? 0) * u,
    cy: frame.y + (b.center[1] ?? 0) * u,
  }));
}

/**
 * The middle of each hiker's figure behind a barrel, on the game screen, in
 * token order (where a dropped hiker slides to, and where they're pressed).
 */
export function hikerCenters(
  style: ArtStyle,
  n: number,
  barrel: number,
  count: number,
  frame: Frame = FILL,
): { x: number; y: number }[] {
  if (style === 'silhouette') {
    const box = barrelLayout(n)[barrel];
    if (!box) return [];
    return hikerSpots(box, count).map((s) => ({ x: s.x, y: s.y + SILHOUETTE_TOP }));
  }
  const b = pixelBarrels(style, n)[barrel];
  if (!b) return [];
  const u = frame.unit;
  return pixelHikers(b, count).map((h) => ({
    x: frame.x + (h.left + h.w / 2) * u,
    y: frame.y + (h.top + h.h / 2) * u,
  }));
}

/**
 * The crosshair's center for a place along the barrel row: `at` is a barrel
 * index, and in between while it sweeps (1.5 is halfway from barrel 2 to 3).
 */
export function crosshairPoint(
  style: ArtStyle,
  n: number,
  at: number,
  frame: Frame = FILL,
): { x: number; y: number } {
  const boxes = barrelBoxes(style, n, frame);
  const last = boxes.length - 1;
  const t = Math.min(last, Math.max(0, at));
  const a = boxes[Math.floor(t)]!;
  const b = boxes[Math.ceil(t)]!;
  const f = t - Math.floor(t);
  return { x: a.cx + (b.cx - a.cx) * f, y: a.cy + (b.cy - a.cy) * f };
}

/** How far above a barrel's top the tallest hiker behind it reaches (game screen units). */
function peek(style: ArtStyle, box: BarrelSpot, frame: Frame): number {
  if (style === 'silhouette') {
    // A head 56 above the top, about 52 tall above its center, at the "alone" scale.
    return (B.headAbove + 52) * B.hikerScale.one * Math.min(1, box.width / B.maxBarrelWidth);
  }
  return Math.ceil(HIKER_SPRITES[100].h * 0.55) * frame.unit;
}

/**
 * Where a drop or a tap counts for each barrel: the barrel, the space just
 * above it where hikers peek out, and a margin around both.
 */
export function dropAreas(style: ArtStyle, n: number, frame: Frame = FILL): Rect[] {
  const m = B.drag.hitMargin;
  return barrelBoxes(style, n, frame).map((b) => {
    const above = peek(style, b, frame);
    return {
      left: b.left - m,
      top: b.top - above - m,
      width: b.width + 2 * m,
      height: b.height + above + 2 * m,
    };
  });
}

/** The barrel a point on the game screen is over (its drop area), or null. */
export function barrelAt(
  style: ArtStyle,
  n: number,
  point: { x: number; y: number },
  frame: Frame = FILL,
): number | null {
  const areas = dropAreas(style, n, frame);
  const hits = areas.flatMap((r, i) => (inside(r, point.x, point.y) ? [i] : []));
  if (hits.length <= 1) return hits[0] ?? null;
  // Overlapping areas (very close barrels): the nearest middle wins.
  const mid = (r: Rect) => Math.abs(r.left + r.width / 2 - point.x);
  return hits.reduce((best, i) => (mid(areas[i]!) < mid(areas[best]!) ? i : best));
}

// ── The in-game UI ─────────────────────────────────────────────────────────

/**
 * The in-game UI's places on the game screen (1280 × 960), so a test can
 * check that it never covers a barrel. The game's CSS uses these numbers.
 */
export const UI = {
  /** The round, prompt and shots pills along the top. */
  pills: { top: 16, height: 46 },
  /** The hiker tokens, bottom left: each a portrait and a name. */
  tokens: { left: 14, bottom: 8, height: 86, face: 56, width: 64, gap: 8, pad: 10 },
  /** Ready, bottom right. */
  ready: { right: 16, bottom: 12, width: 196, height: 62 },
} as const;

/** The boxes the in-game UI takes, with this many tokens. */
export function uiRects(tokens: number): Rect[] {
  const t = UI.tokens;
  const r = UI.ready;
  const barWidth = 2 * t.pad + tokens * t.width + Math.max(0, tokens - 1) * t.gap;
  return [
    { left: 0, top: UI.pills.top, width: GAME.width, height: UI.pills.height },
    { left: t.left, top: GAME.height - t.bottom - t.height, width: barWidth, height: t.height },
    {
      left: GAME.width - r.right - r.width,
      top: GAME.height - r.bottom - r.height,
      width: r.width,
      height: r.height,
    },
  ];
}
