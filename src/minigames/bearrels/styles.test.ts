/**
 * Bearrels in the GPS greens as geometry (gps-greens update): both versions
 * draw 3 to 6 barrels where layout.json says, the UI never covers a barrel,
 * the bear's pose follows the crosshair with the flash at that pose's
 * muzzle, hikers are sized and spread as the layout says, and drops land on
 * the right barrel.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import LAYOUT from '../../../public/assets/minigames/bearrels/layout.json';
import {
  ART_STYLES,
  barrelAt,
  barrelBoxes,
  barrelRow,
  BEAR,
  bearPose,
  crosshairPoint,
  dropAreas,
  FILL,
  FOLDER,
  frameFor,
  GAME,
  hikerSlots,
  muzzlePoint,
  nextStyle,
  overlaps,
  pixelFrame,
  SCENE,
  sceneBarrels,
  shadowSpot,
  SPRITE_PX,
  spriteSize,
  toArtStyle,
  uiRects,
  type ArtStyle,
} from './styles';

const COUNTS = [3, 4, 5, 6] as const;
const STYLES: ArtStyle[] = ['pixel', 'drawn'];
/** Some screens: a laptop, a big monitor at 2×, a small window, a phone at 3×. */
const FRAMES = [FILL, pixelFrame(1147), pixelFrame(2294), pixelFrame(900), pixelFrame(1287)];

/** Every sprite the game loads, as data URLs. */
const FILES = import.meta.glob('/public/assets/minigames/bearrels/gps-*/*.png', {
  query: '?inline',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** A PNG's size, from its header. */
function pngSize(path: string): [number, number] {
  const url = FILES[`/public/assets/minigames/bearrels/${path}`];
  if (!url) throw new Error(`missing ${path}`);
  const bytes = atob(url.slice(url.indexOf(',') + 1));
  const u32 = (at: number) => [0, 1, 2, 3].reduce((n, i) => n * 256 + bytes.charCodeAt(at + i), 0);
  return [u32(16), u32(20)];
}

describe('the two versions', () => {
  it('Detailed pixel first (the default), then Drawn 2D; S switches; an old style falls back to Detailed pixel', () => {
    expect(ART_STYLES.map((s) => s.label)).toEqual(['Detailed pixel', 'Drawn 2D']);
    expect(nextStyle('pixel')).toBe('drawn');
    expect(nextStyle('drawn')).toBe('pixel');
    for (const old of ['earth', 'teal', 'silhouette', undefined, 3]) {
      expect(toArtStyle(old)).toBe('pixel');
    }
    expect(toArtStyle('drawn')).toBe('drawn');
  });

  it('the scene is 320 × 240; Drawn 2D always fills, Detailed pixel uses its whole-number scale', () => {
    expect(SCENE).toEqual({ width: 320, height: 240 });
    expect(FILL.unit).toBe(4);
    const measured = pixelFrame(2294);
    expect(frameFor('pixel', measured)).toBe(measured);
    expect(frameFor('drawn', measured)).toBe(FILL);
  });
});

describe('the barrels', () => {
  it.each(COUNTS)('%i barrels: exactly where layout.json says, in both versions', (n) => {
    const given = LAYOUT.barrels[String(n) as '3'];
    const row = sceneBarrels(n);
    expect(row).toHaveLength(n);
    row.forEach((b, i) => {
      expect(b.x).toBe(given.x[i]);
      expect(b.left).toBeCloseTo(given.x[i]! - given.w / 2);
      expect(b.top).toBe(given.top);
      expect(b.top + b.height).toBe(LAYOUT.barrelBottom);
      // The shadow: [x − w × 0.7 + 3, bottom − 3].
      expect(shadowSpot(n, i)).toEqual({
        file: `shadow-${given.w}.png`,
        x: given.x[i]! - given.w * 0.7 + 3,
        y: LAYOUT.barrelBottom - 3,
      });
    });
    // Both versions draw the barrel file at the same size in scene units.
    for (const style of STYLES) {
      expect(spriteSize(style, given.file)).toEqual({ w: given.w, h: given.h });
    }
  });

  it.each(COUNTS)('%i barrels: inside the screen, apart, and the UI never covers one', (n) => {
    for (const frame of FRAMES) {
      const boxes = barrelBoxes(n, frame);
      boxes.forEach((b, i) => {
        expect(b.left).toBeGreaterThanOrEqual(0);
        expect(b.left + b.width).toBeLessThanOrEqual(GAME.width);
        expect(b.top + b.height).toBeLessThanOrEqual(GAME.height);
        const next = boxes[i + 1];
        if (next) expect(b.left + b.width).toBeLessThan(next.left);
        for (const ui of uiRects(BALANCE.minigames.bearrels.hikers.max)) {
          expect(overlaps(b, ui), `${n} barrels, barrel ${i + 1}`).toBe(false);
        }
      });
    }
  });
});

describe('the bear', () => {
  it('his pose follows the crosshair: under 130 left, over 190 right, otherwise the middle', () => {
    expect(bearPose(64)).toBe('left');
    expect(bearPose(129.9)).toBe('left');
    expect(bearPose(130)).toBe('center');
    expect(bearPose(160)).toBe('center');
    expect(bearPose(190)).toBe('center');
    expect(bearPose(190.1)).toBe('right');
    expect(bearPose(256)).toBe('right');
    expect(bearPose(null)).toBe('center');
  });

  it.each(COUNTS)(
    '%i barrels: aiming at each barrel uses the pose layout.json lists for it',
    (n) => {
      const row = barrelRow(n);
      row.x.forEach((_, i) => {
        expect(bearPose(crosshairPoint(n, i).x)).toBe(row.pose[i]);
      });
    },
  );

  it('the flash sits on each pose’s muzzle; the right pose is the side sprite mirrored', () => {
    expect(muzzlePoint('center')).toEqual({ x: 151, y: 112 });
    expect(muzzlePoint('left')).toEqual({ x: 139, y: 115 });
    expect(muzzlePoint('right')).toEqual({ x: 181, y: 115 });
    expect(BEAR.aim.right).toEqual({ file: 'bear-aim-side.png', mirror: true });
    expect(BEAR.aim.left).toEqual({ file: 'bear-aim-side.png', mirror: false });
    // Mirrored about the sprite's middle, the left muzzle lands near the right one.
    const w = spriteSize('pixel', 'bear-aim-side.png').w;
    const mirroredLeft = BEAR.aimAt.x + w - (muzzlePoint('left').x - BEAR.aimAt.x);
    expect(Math.abs(mirroredLeft - muzzlePoint('right').x)).toBeLessThanOrEqual(2);
  });

  it('pops up from 18 units lower, and is never seen below y 160', () => {
    expect(BEAR.rise).toBe(18);
    expect(BEAR.clipBelowY).toBe(160);
    expect(BEAR.aimAt.y + BEAR.rise + spriteSize('pixel', 'bear-aim-center.png').h).toBeGreaterThan(
      160,
    );
  });
});

describe('hikers in front of a barrel', () => {
  it('1 hiker 100, 2 hikers 80, 3 or 4 hikers 62, spread across the barrel as layout.json says', () => {
    const row = barrelRow(4);
    const x = row.x[1]!;
    const slots = (count: number) => hikerSlots('pixel', 4, 1, count);
    expect(slots(1)).toEqual([expect.objectContaining({ scale: 100, x, w: 30, h: 42 })]);
    for (const [count, scale, spreadBy] of [
      [2, 80, 0.5],
      [3, 62, 0.62],
      [4, 62, 0.72],
    ] as const) {
      const s = slots(count);
      expect(s.map((h) => h.scale)).toEqual(Array(count).fill(scale));
      const spread = row.w * spreadBy;
      expect(s[0]!.x).toBeCloseTo(x - spread / 2);
      expect(s.at(-1)!.x).toBeCloseTo(x + spread / 2);
      // top = bottom − h × 0.82 + (1 − scale) × 8
      expect(s[0]!.top).toBeCloseTo(LAYOUT.barrelBottom - row.h * 0.82 + (1 - scale / 100) * 8);
    }
  });

  it('they reach below the foreground’s top, so the grass hides their lower half', () => {
    const [h] = hikerSlots('drawn', 3, 0, 1);
    expect(h!.top + h!.h).toBeGreaterThan(LAYOUT.foreground[1]!);
  });
});

describe('where a drop or tap lands', () => {
  it.each(COUNTS)(
    '%i barrels: on the barrel, on the hikers in front of it, and a margin around both',
    (n) => {
      const m = BALANCE.minigames.bearrels.drag.hitMargin;
      const boxes = barrelBoxes(n);
      const areas = dropAreas(n);
      boxes.forEach((b, i) => {
        expect(barrelAt(n, { x: b.cx, y: b.cy })).toBe(i);
        // A hiker crouched in front, at the barrel's bottom edge.
        expect(barrelAt(n, { x: b.cx, y: b.top + b.height + 20 })).toBe(i);
        expect(areas[i]!.top).toBeLessThanOrEqual(b.top - m);
      });
      expect(barrelAt(n, { x: boxes[0]!.cx, y: 100 })).toBeNull();
    },
  );
});

describe('the sprites match their files', () => {
  it.each(STYLES)('%s: every sprite’s size', (style) => {
    for (const [key, size] of Object.entries(SPRITE_PX[style])) {
      if (key.startsWith('hiker-')) {
        for (const id of Object.keys(LAYOUT.colors.hikers)) {
          expect(
            pngSize(`${FOLDER[style]}/hiker-${id}-${key.slice(6)}.png`),
            `${id} ${key}`,
          ).toEqual(size);
        }
      } else {
        expect(pngSize(`${FOLDER[style]}/${key}`), key).toEqual(size);
      }
    }
  });
});
