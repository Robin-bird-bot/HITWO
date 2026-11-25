/**
 * Bearrels' art styles as geometry (Nov 24 follow-up): every style draws 3 to
 * 6 barrels where its layout says, the in-game UI never covers a barrel, the
 * pixel styles scale by whole numbers, and drops land on the right barrel.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { barrelLayout } from './logic';
import {
  ART_STYLES,
  barrelAt,
  barrelBoxes,
  bearRise,
  crosshairPoint,
  dropAreas,
  FILL,
  GAME,
  HIKER_SPRITES,
  hikerCenters,
  MUZZLE_SIZE,
  nextStyle,
  overlaps,
  PIXEL,
  PIXEL_LAYOUTS,
  PIXEL_SPRITES,
  pixelBarrels,
  pixelFrame,
  pixelHikers,
  SILHOUETTE_TOP,
  toArtStyle,
  uiRects,
  type ArtStyle,
  type PixelStyle,
} from './styles';

const COUNTS = [3, 4, 5, 6] as const;
const STYLES: ArtStyle[] = ['earth', 'teal', 'silhouette'];
const PIXELS: PixelStyle[] = ['earth', 'teal'];
/** Some screens: a laptop, a big monitor at 2×, a small window, a phone at 3×. */
const FRAMES = [
  FILL,
  pixelFrame(1147),
  pixelFrame(2294),
  pixelFrame(900),
  pixelFrame(1100 * 3 * 0.39),
];

/** Every pixel sprite the game loads, as data URLs. */
const FILES = import.meta.glob('/public/assets/minigames/bearrels/pixel-*/*.png', {
  query: '?inline',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** A PNG's size, from its header. */
function pngSize(path: string): { w: number; h: number } {
  const url = FILES[`/public/assets/${path}`];
  if (!url) throw new Error(`missing ${path}`);
  const bytes = atob(url.slice(url.indexOf(',') + 1));
  const u32 = (at: number) => [0, 1, 2, 3].reduce((n, i) => n * 256 + bytes.charCodeAt(at + i), 0);
  return { w: u32(16), h: u32(20) };
}

describe('the three art styles', () => {
  it('Earthy pixel first (the default), then Teal pixel and Silhouette; S cycles through them', () => {
    expect(ART_STYLES.map((s) => s.label)).toEqual(['Earthy pixel', 'Teal pixel', 'Silhouette']);
    expect(toArtStyle('nonsense')).toBe('earth');
    expect(toArtStyle('teal')).toBe('teal');
    expect(nextStyle('earth')).toBe('teal');
    expect(nextStyle('teal')).toBe('silhouette');
    expect(nextStyle('silhouette')).toBe('earth');
  });
});

describe('barrels in every style', () => {
  it.each(PIXELS.flatMap((style) => COUNTS.map((n) => [style, n] as const)))(
    '%s, %i barrels: exactly where layout.json says, at any whole-number scale',
    (style, n) => {
      const given = PIXEL_LAYOUTS[style].barrels[String(n) as '3'];
      expect(given).toHaveLength(n);
      for (const frame of FRAMES) {
        const boxes = barrelBoxes(style, n, frame);
        boxes.forEach((b, i) => {
          const g = given[i]!;
          expect(b.left).toBeCloseTo(frame.x + g.x * frame.unit);
          expect(b.top).toBeCloseTo(frame.y + g.y * frame.unit);
          expect(b.width).toBeCloseTo(g.w * frame.unit);
          expect(b.height).toBeCloseTo(g.h * frame.unit);
          expect(b.cx).toBeCloseTo(frame.x + g.center[0]! * frame.unit);
        });
      }
    },
  );

  it.each(COUNTS)(
    'Silhouette, %i barrels: the first version’s row, 120 lower in the 4:3 view',
    (n) => {
      const boxes = barrelBoxes('silhouette', n);
      barrelLayout(n).forEach((b, i) => {
        expect(boxes[i]).toMatchObject({
          left: b.x - b.width / 2,
          top: b.top + SILHOUETTE_TOP,
          width: b.width,
          cx: b.x,
        });
      });
      expect(SILHOUETTE_TOP).toBe(120);
    },
  );

  it.each(STYLES.flatMap((style) => COUNTS.map((n) => [style, n] as const)))(
    '%s, %i barrels: inside the screen, no two touching, and the UI never covers one',
    (style, n) => {
      for (const frame of style === 'silhouette' ? [FILL] : FRAMES) {
        const boxes = barrelBoxes(style, n, frame);
        for (const [i, b] of boxes.entries()) {
          expect(b.left).toBeGreaterThanOrEqual(0);
          expect(b.left + b.width).toBeLessThanOrEqual(GAME.width);
          expect(b.top + b.height).toBeLessThanOrEqual(GAME.height);
          const next = boxes[i + 1];
          if (next) expect(b.left + b.width).toBeLessThan(next.left);
          for (const ui of uiRects(BALANCE.minigames.bearrels.hikers.max)) {
            expect(overlaps(b, ui), `${style} ${n} barrel ${i + 1}`).toBe(false);
          }
        }
      }
    },
  );
});

describe('the pixel styles’ scale', () => {
  it('a whole number of device pixels per scene pixel, letterboxed in the middle', () => {
    for (const shown of [1147, 2294, 900, 1287, 3000]) {
      const f = pixelFrame(shown);
      // Device pixels per scene pixel.
      const k = (f.unit * shown) / GAME.width;
      expect(k).toBeCloseTo(Math.round(k));
      expect(Math.round(k)).toBe(Math.floor(shown / PIXEL.width));
      expect(f.x).toBeCloseTo((GAME.width - PIXEL.width * f.unit) / 2);
      expect(f.y).toBeCloseTo((GAME.height - PIXEL.height * f.unit) / 2);
      expect(f.unit).toBeLessThanOrEqual(FILL.unit);
    }
  });

  it('too small for one whole pixel (or not measured): it fills the screen', () => {
    expect(pixelFrame(200)).toEqual(FILL);
    expect(pixelFrame(0)).toEqual(FILL);
    expect(FILL.unit * PIXEL.height).toBeCloseTo(GAME.height);
  });
});

describe('hikers behind a pixel barrel (layout.json placement)', () => {
  it('100 alone, 80 for two, 62 for three or four; spread around the barrel, peeking over its top', () => {
    const b = pixelBarrels('earth', 3)[1]!;
    const one = pixelHikers(b, 1);
    expect(one[0]).toMatchObject({ scale: 100, left: 140 - 15, top: Math.round(152 - 28 * 0.55) });
    const two = pixelHikers(b, 2);
    expect(two.map((h) => h.scale)).toEqual([80, 80]);
    // k − (g − 1) ÷ 2 = ∓0.5, times w × 0.75, minus w ÷ 2.
    expect(two.map((h) => h.left)).toEqual([
      Math.round(140 - 0.5 * 22 * 0.75 - 11),
      Math.round(140 + 0.5 * 22 * 0.75 - 11),
    ]);
    expect(pixelHikers(b, 4).map((h) => h.scale)).toEqual([62, 62, 62, 62]);
  });

  it('a hiker’s middle is the same point in every renderer’s terms (where a drop slides to)', () => {
    const [c] = hikerCenters('teal', 4, 2, 1);
    const b = barrelBoxes('teal', 4)[2]!;
    expect(c!.x).toBeCloseTo(b.cx, -1);
    expect(c!.y).toBeLessThan(b.top + b.height / 2);
  });
});

describe('the crosshair', () => {
  it('sits on a barrel’s middle, and moves smoothly between barrels while sweeping', () => {
    for (const style of STYLES) {
      const boxes = barrelBoxes(style, 5);
      expect(crosshairPoint(style, 5, 3)).toEqual({ x: boxes[3]!.cx, y: boxes[3]!.cy });
      const half = crosshairPoint(style, 5, 1.5);
      expect(half.x).toBeCloseTo((boxes[1]!.cx + boxes[2]!.cx) / 2);
    }
  });
});

describe('where a drop or tap lands', () => {
  it.each(STYLES)('%s: on a barrel, the space just above it, and a margin around both', (style) => {
    const m = BALANCE.minigames.bearrels.drag.hitMargin;
    for (const n of COUNTS) {
      const boxes = barrelBoxes(style, n);
      const areas = dropAreas(style, n);
      boxes.forEach((b, i) => {
        expect(barrelAt(style, n, { x: b.cx, y: b.cy })).toBe(i);
        expect(barrelAt(style, n, { x: b.cx, y: b.top - 8 })).toBe(i);
        expect(barrelAt(style, n, { x: b.left - m + 1, y: b.cy })).toBe(i);
        expect(areas[i]!.top).toBeLessThan(b.top - m);
      });
      // Between two barrels, past both margins: nothing.
      const a = boxes[0]!;
      const b = boxes[1]!;
      const gap = (a.left + a.width + b.left) / 2;
      if (b.left - (a.left + a.width) > 2 * m + 2) {
        expect(barrelAt(style, n, { x: gap, y: a.cy })).toBeNull();
      }
      // High in the sky: nothing.
      expect(barrelAt(style, n, { x: a.cx, y: 40 })).toBeNull();
    }
  });
});

describe('the pixel sprites match their files', () => {
  it.each(PIXELS)(
    '%s: bear, log, barrels, shadows, crosshair, muzzle flash and hikers',
    (style) => {
      const dir = `minigames/bearrels/pixel-${style}/`;
      const L = PIXEL_LAYOUTS[style];
      const S = PIXEL_SPRITES[style];
      expect(pngSize(dir + L.background)).toEqual({ w: PIXEL.width, h: PIXEL.height });
      expect(pngSize(dir + L.bear.up.file)).toEqual({ w: S.bear.w, h: S.bear.h });
      expect(pngSize(dir + L.bear.hidden.file)).toEqual({ w: S.bear.w, h: S.bear.h });
      expect(pngSize(dir + L.log.file)).toEqual(S.log);
      expect(pngSize(dir + L.crosshair.file)).toEqual({ w: L.crosshair.size, h: L.crosshair.size });
      expect(pngSize(dir + L.bear.muzzle_flash.file)).toEqual({ w: MUZZLE_SIZE, h: MUZZLE_SIZE });
      for (const [file, size] of Object.entries(S.shadows))
        expect(pngSize(dir + file)).toEqual(size);
      for (const n of COUNTS) {
        for (const b of pixelBarrels(style, n)) {
          expect(pngSize(dir + b.file)).toEqual({ w: b.w, h: b.h });
          expect(Object.keys(S.shadows)).toContain(b.shadow.file);
        }
      }
      for (const id of Object.keys(L.hikers.colors)) {
        for (const [scale, size] of Object.entries(HIKER_SPRITES)) {
          expect(pngSize(`${dir}hiker-${id}-${scale}.png`)).toEqual(size);
        }
      }
      // The bear rises from where its hidden ears are, and only from below.
      expect(bearRise(style)).toBeGreaterThan(0);
    },
  );
});
