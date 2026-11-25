/**
 * Bearrels in the GPS greens (docs/design/10-minigames.md, "Art: the GPS
 * greens") as geometry: where the barrels, the hikers, the bear and the
 * crosshair go on the 4:3 game screen (1280 × 960), where a drop lands, and
 * the in-game UI's boxes. One scene model, two versions: nothing in the
 * game's state depends on the version, so switching mid-round only redraws.
 *
 * Both versions share one layout.json, in scene units (320 × 240):
 * - **Detailed pixel** files are 1 px per unit, scaled up nearest-neighbor
 *   at a whole-number scale where it fits;
 * - **Drawn 2D** files are 4 px per unit, drawn at a quarter size, smooth.
 */
import { BALANCE } from '../../config/balance';
import LAYOUT from '../../../public/assets/minigames/bearrels/layout.json';

const B = BALANCE.minigames.bearrels;

export type ArtStyle = 'pixel' | 'drawn';

/** The versions, in the testing tab's order. Detailed pixel is the default. */
export const ART_STYLES = [
  { id: 'pixel', label: 'Detailed pixel' },
  { id: 'drawn', label: 'Drawn 2D' },
] as const satisfies readonly { id: ArtStyle; label: string }[];

export const isArtStyle = (v: unknown): v is ArtStyle => ART_STYLES.some((s) => s.id === v);

/** The version a remembered value names; anything else (an old style too) is Detailed pixel. */
export const toArtStyle = (v: unknown): ArtStyle => (isArtStyle(v) ? v : ART_STYLES[0].id);

/** The other version, for the Style button and the S key. */
export function nextStyle(s: ArtStyle): ArtStyle {
  const i = ART_STYLES.findIndex((x) => x.id === s);
  return ART_STYLES[(i + 1) % ART_STYLES.length]!.id;
}

export const styleLabel = (s: ArtStyle): string => ART_STYLES.find((x) => x.id === s)?.label ?? s;

/** Each version's art folder (public/assets/minigames/bearrels/…) and file pixels per scene unit. */
export const FOLDER: Readonly<Record<ArtStyle, string>> = {
  pixel: 'gps-pixel',
  drawn: 'gps-drawn',
};
export const PX_PER_UNIT: Readonly<Record<ArtStyle, number>> = {
  pixel: LAYOUT.pxPerUnit['gps-pixel'],
  drawn: LAYOUT.pxPerUnit['gps-drawn'],
};

// ── The screen and the scene ───────────────────────────────────────────────

/** Every minigame is laid out at 1280 × 960 (4:3), the turned GPS's screen. */
export const GAME = { width: 1280, height: 960 } as const;

/** The scene, in scene units. */
export const SCENE = { width: LAYOUT.sceneSize[0]!, height: LAYOUT.sceneSize[1]! } as const;

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

/** Where the scene sits on the game screen: a scene unit (sx, sy) is drawn at (x + sx × unit, y + sy × unit). */
export interface Frame {
  x: number;
  y: number;
  unit: number;
}

/** The scene filling the whole screen (Drawn 2D always; Detailed pixel before it's measured). */
export const FILL: Frame = { x: 0, y: 0, unit: GAME.width / SCENE.width };

/**
 * The largest whole-number scale that fits, letterboxed: `shownWidth` is how
 * wide the game screen is drawn, in device pixels.
 */
export function pixelFrame(shownWidth: number): Frame {
  const k = Math.floor(Math.min(shownWidth / SCENE.width, (shownWidth * 0.75) / SCENE.height));
  if (!Number.isFinite(k) || k < 1) return FILL;
  const unit = (k * GAME.width) / shownWidth;
  return {
    x: (GAME.width - SCENE.width * unit) / 2,
    y: (GAME.height - SCENE.height * unit) / 2,
    unit,
  };
}

/** The frame a version draws in: Detailed pixel at its measured whole-number scale, Drawn 2D filled. */
export const frameFor = (style: ArtStyle, measured: Frame): Frame =>
  style === 'pixel' ? measured : FILL;

// ── The sprites ────────────────────────────────────────────────────────────

/** Each sprite's file size in pixels, per version (a test checks them against the files). */
export const SPRITE_PX: Readonly<
  Record<ArtStyle, Readonly<Record<string, readonly [number, number]>>>
> = {
  pixel: {
    'background.png': [320, 240],
    'foreground.png': [320, 48],
    'log.png': [92, 18],
    'bear-hidden.png': [88, 24],
    'bear-aim-center.png': [88, 84],
    'bear-aim-side.png': [88, 84],
    'crosshair.png': [28, 28],
    'muzzle-flash.png': [34, 34],
    'barrel-34.png': [34, 42],
    'barrel-32.png': [32, 40],
    'barrel-26.png': [26, 32],
    'shadow-34.png': [48, 6],
    'shadow-32.png': [45, 6],
    'shadow-26.png': [36, 6],
    'hiker-100': [30, 42],
    'hiker-80': [24, 42],
    'hiker-62': [19, 42],
  },
  drawn: {
    'background.png': [1280, 960],
    'foreground.png': [1280, 192],
    'log.png': [368, 72],
    'bear-hidden.png': [352, 96],
    'bear-aim-center.png': [352, 336],
    'bear-aim-side.png': [352, 336],
    'crosshair.png': [112, 112],
    'muzzle-flash.png': [136, 136],
    'barrel-34.png': [136, 168],
    'barrel-32.png': [128, 160],
    'barrel-26.png': [104, 128],
    'shadow-34.png': [190, 24],
    'shadow-32.png': [179, 24],
    'shadow-26.png': [146, 24],
    'hiker-100': [120, 168],
    'hiker-80': [96, 168],
    'hiker-62': [74, 168],
  },
};

/** A sprite's size in scene units, in this version. */
export function spriteSize(style: ArtStyle, key: string): { w: number; h: number } {
  const px = SPRITE_PX[style][key] ?? [0, 0];
  return { w: px[0] / PX_PER_UNIT[style], h: px[1] / PX_PER_UNIT[style] };
}

/** Where the background, foreground and log go (scene units). */
export const PLACES = {
  background: { x: LAYOUT.background[0]!, y: LAYOUT.background[1]! },
  foreground: { x: LAYOUT.foreground[0]!, y: LAYOUT.foreground[1]! },
  log: { x: LAYOUT.log[0]!, y: LAYOUT.log[1]! },
} as const;

// ── The barrels ────────────────────────────────────────────────────────────

const BOTTOM = LAYOUT.barrelBottom;

const clampBarrels = (n: number) => Math.min(6, Math.max(3, Math.round(n))) as 3 | 4 | 5 | 6;

/** The barrel row for n barrels (layout.json `barrels`): file, size, middles, top, and the bear's pose for each. */
export const barrelRow = (n: number) =>
  LAYOUT.barrels[String(clampBarrels(n)) as '3' | '4' | '5' | '6'];

/** A barrel in scene units: its box and middle. */
export interface BarrelSpot extends Rect {
  x: number;
}

/** Each barrel in scene units. */
export function sceneBarrels(n: number): BarrelSpot[] {
  const row = barrelRow(n);
  return row.x.map((x) => ({ x, left: x - row.w / 2, top: row.top, width: row.w, height: row.h }));
}

/** A barrel's shadow: layout.json `shadow`, at [x − w × 0.7 + 3, bottom − 3]. */
export function shadowSpot(n: number, i: number): { file: string; x: number; y: number } {
  const row = barrelRow(n);
  const x = row.x[i] ?? 0;
  return { file: `shadow-${row.w}.png`, x: x - row.w * 0.7 + 3, y: BOTTOM - 3 };
}

/** Each barrel's box and middle on the game screen. */
export function barrelBoxes(n: number, frame: Frame = FILL): (Rect & { cx: number; cy: number })[] {
  const u = frame.unit;
  return sceneBarrels(n).map((b) => ({
    left: frame.x + b.left * u,
    top: frame.y + b.top * u,
    width: b.width * u,
    height: b.height * u,
    cx: frame.x + b.x * u,
    cy: frame.y + (b.top + b.height / 2) * u,
  }));
}

// ── The hikers ─────────────────────────────────────────────────────────────

export type HikerScale = 100 | 80 | 62;

/** The sprite size for this many hikers at one barrel (layout.json `scaleByCount`). */
export function hikerScale(count: number): HikerScale {
  return count <= 1 ? 100 : count === 2 ? 80 : 62;
}

const SPREAD: Readonly<Record<number, number>> = LAYOUT.hikers.spreadByCount;

/**
 * Where each hiker at a barrel crouches, in scene units (layout.json
 * `hikers`): their middles spread across the barrel, the top line
 * bottom − h × 0.82 + (1 − scale) × 8, in front of the barrel.
 */
export function hikerSlots(
  style: ArtStyle,
  n: number,
  barrel: number,
  count: number,
): { left: number; top: number; w: number; h: number; scale: HikerScale; x: number }[] {
  const row = barrelRow(n);
  const x = row.x[barrel];
  if (x === undefined || count < 1) return [];
  const scale = hikerScale(count);
  const size = spriteSize(style, `hiker-${scale}`);
  const spread = row.w * (SPREAD[Math.min(4, count)] ?? 0);
  const top = BOTTOM - row.h * 0.82 + (1 - scale / 100) * 8;
  return Array.from({ length: count }, (_, k) => {
    const cx = count === 1 ? x : x - spread / 2 + (spread * k) / (count - 1);
    return { left: cx - size.w / 2, top, w: size.w, h: size.h, scale, x: cx };
  });
}

/** The middle of each hiker's figure at a barrel, on the game screen (where a drop slides to). */
export function hikerCenters(
  style: ArtStyle,
  n: number,
  barrel: number,
  count: number,
  frame: Frame = FILL,
): { x: number; y: number }[] {
  return hikerSlots(style, n, barrel, count).map((h) => ({
    x: frame.x + h.x * frame.unit,
    y: frame.y + (h.top + h.h * 0.45) * frame.unit,
  }));
}

// ── The bear and the crosshair ─────────────────────────────────────────────

export type AimPose = 'left' | 'center' | 'right';

/** The bear's pose from the crosshair's x (layout.json `poseRule`): under 130 left, over 190 right. */
export function bearPose(x: number | null): AimPose {
  if (x === null) return 'center';
  return x < 130 ? 'left' : x > 190 ? 'right' : 'center';
}

export const BEAR = {
  hidden: {
    file: LAYOUT.bear.hidden.file,
    x: LAYOUT.bear.hidden.at[0]!,
    y: LAYOUT.bear.hidden.at[1]!,
  },
  aim: {
    center: { file: LAYOUT.bear.aim.center.file, mirror: false },
    left: { file: LAYOUT.bear.aim.left.file, mirror: false },
    right: { file: LAYOUT.bear.aim.right.file, mirror: true },
  },
  /** All aiming poses share one place. */
  aimAt: { x: LAYOUT.bear.aim.center.at[0]!, y: LAYOUT.bear.aim.center.at[1]! },
  /** The bear pops up from this far below his aiming place, and is never seen below this line. */
  rise: 18,
  clipBelowY: LAYOUT.bear.clipBelowY,
} as const;

/** Where the muzzle flash goes for each pose (layout.json `bear.muzzle`). */
export function muzzlePoint(pose: AimPose): { x: number; y: number } {
  const p = LAYOUT.bear.muzzle[pose];
  return { x: p[0]!, y: p[1]! };
}

/** The crosshair's middle, in scene units: on a barrel, or between two while it sweeps (1.5 is halfway from barrel 2 to 3). */
export function crosshairPoint(n: number, at: number): { x: number; y: number } {
  const row = barrelRow(n);
  const last = row.x.length - 1;
  const t = Math.min(last, Math.max(0, at));
  const a = row.x[Math.floor(t)] ?? 0;
  const b = row.x[Math.ceil(t)] ?? a;
  return { x: a + (b - a) * (t - Math.floor(t)), y: BOTTOM - row.h * 0.55 };
}

// ── Where a drop or a tap lands ────────────────────────────────────────────

/**
 * Each barrel's drop and tap area on the game screen: the barrel, the
 * hikers crouched in front of it (as wide as four of them spread out), and a
 * margin around both.
 */
export function dropAreas(n: number, frame: Frame = FILL): Rect[] {
  const m = B.drag.hitMargin;
  const row = barrelRow(n);
  const u = frame.unit;
  const four = hikerSlots('pixel', n, 0, 4);
  const one = hikerSlots('pixel', n, 0, 1)[0];
  const halfWide = Math.max(
    row.w / 2,
    four.length ? (four.at(-1)!.left + four.at(-1)!.w - four[0]!.left) / 2 : 0,
  );
  const bottom = one ? one.top + one.h : BOTTOM;
  return row.x.map((x) => ({
    left: frame.x + (x - halfWide) * u - m,
    top: frame.y + row.top * u - m,
    width: 2 * halfWide * u + 2 * m,
    height: (bottom - row.top) * u + 2 * m,
  }));
}

/** The barrel a point on the game screen is over (its drop area), or null. Overlapping areas: the nearest middle. */
export function barrelAt(
  n: number,
  point: { x: number; y: number },
  frame: Frame = FILL,
): number | null {
  const areas = dropAreas(n, frame);
  const hits = areas.flatMap((r, i) => (inside(r, point.x, point.y) ? [i] : []));
  if (hits.length <= 1) return hits[0] ?? null;
  const mid = (r: Rect) => Math.abs(r.left + r.width / 2 - point.x);
  return hits.reduce((best, i) => (mid(areas[i]!) < mid(areas[best]!) ? i : best));
}

// ── The in-game UI ─────────────────────────────────────────────────────────

/**
 * The in-game UI's places on the game screen (1280 × 960), so a test can
 * check that it never covers a barrel. The game's CSS uses these numbers.
 */
export const UI = {
  /** The round, prompt and shots boxes along the top. */
  pills: { top: 16, height: 52 },
  /** The hiker tokens, bottom left: each a portrait and a name. */
  tokens: { left: 14, bottom: 10, height: 88, face: 52, width: 66, gap: 6, pad: 10 },
  /** Ready, bottom right. */
  ready: { right: 16, bottom: 14, width: 196, height: 62 },
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
