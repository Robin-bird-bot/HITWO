import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ROSTER, ROSTER_BY_ID } from '../../content/roster';
import { TEST_HIKERS } from '../../content/testHikers';
import { HikerPortrait } from './HikerPortrait';
import {
  cropWindow,
  FACE_Y,
  FAMILY_ICONS,
  familyIcon,
  portraitArt,
  WINDOW_ASPECT,
} from './portraitArt';

const files = (glob: Record<string, unknown>) =>
  Object.keys(glob).map((p) => p.slice(p.lastIndexOf('/') + 1, -'.png'.length));
const PORTRAIT_FILES = files(import.meta.glob('/public/assets/portraits/*.png'));
const FAMILY_FILES = files(import.meta.glob('/public/assets/cards/family/*.png'));

describe('portrait files', () => {
  it("every hiker's portrait is on disk and has a portraits.json entry", () => {
    for (const h of ROSTER) {
      if (!h.portrait) continue;
      expect(PORTRAIT_FILES, h.id).toContain(h.portrait);
      expect(FACE_Y[h.portrait], h.id).toBeGreaterThan(0);
      expect(FACE_Y[h.portrait], h.id).toBeLessThan(1);
    }
  });

  it('every portraits.json entry is a file on disk, and every portrait belongs to a hiker', () => {
    const used = new Set(ROSTER.map((h) => h.portrait));
    for (const file of Object.keys(FACE_Y)) {
      expect(PORTRAIT_FILES).toContain(file);
      expect(used.has(file), file).toBe(true);
    }
    // 31 from Phase 10b, then 7 variants and 4 holiday hikers (holiday-hikers-2).
    expect(Object.keys(FACE_Y)).toHaveLength(42);
  });

  it('every family has an icon file, the star included', () => {
    expect(FAMILY_FILES.sort()).toEqual([...FAMILY_ICONS].sort());
    for (const h of ROSTER) expect(FAMILY_ICONS).toContain(familyIcon(h));
    expect(familyIcon(ROSTER_BY_ID.get('bossGracie')!)).toBe('duo');
    expect(familyIcon(ROSTER_BY_ID.get('pepper')!)).toBe('plush');
  });
});

describe("a hiker's picture", () => {
  it('a portrait, with its faceY', () => {
    expect(portraitArt('wyatt')).toEqual({
      kind: 'portrait',
      src: '/assets/portraits/wyatt.png',
      faceY: 0.337,
    });
    expect(portraitArt('wywee')).toMatchObject({ kind: 'portrait' });
  });

  it('no portrait yet: Ben and Mindy show their family icon', () => {
    expect(portraitArt('ben')).toEqual({ kind: 'icon', icon: 'human' });
    expect(portraitArt('mindy')).toEqual({ kind: 'icon', icon: 'human' });
  });

  it('every variant has its real portrait now, with a faceY (holiday-hikers-2)', () => {
    const variants = ROSTER.filter((h) => h.variantOf);
    expect(variants).toHaveLength(12);
    for (const v of variants) {
      const art = portraitArt(v.id);
      expect(art.kind, v.id).toBe('portrait');
      expect(art.kind === 'portrait' && FACE_Y[v.portrait ?? ''], v.id).toBeTruthy();
    }
    expect(portraitArt('preparedWink')).toMatchObject({
      src: '/assets/portraits/prepared-wink.png',
    });
    expect(portraitArt('showqueenGdog')).toMatchObject({
      src: '/assets/portraits/showqueen-gdog.png',
    });
    expect(PORTRAIT_FILES).not.toContain('planner-wink');
  });

  it('the placeholder party and the test hikers keep their old look', () => {
    expect(portraitArt('hiker-1')).toEqual({
      kind: 'image',
      src: '/assets/portraits/placeholder.png',
    });
    const test = portraitArt(TEST_HIKERS[0]!.id);
    expect(test.kind).toBe('image');
    expect(test.kind === 'image' && test.src.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('draws the forest, the pattern, then the portrait', () => {
    const html = renderToStaticMarkup(
      createElement(HikerPortrait, { hikerId: 'wyatt', view: 'window' }),
    );
    expect(html).toContain('cards/forest.png');
    expect(html).toContain('cards/pixel-pattern.png');
    expect(html.indexOf('pixel-pattern.png')).toBeLessThan(html.indexOf('portraits/wyatt.png'));
    expect(html).toContain('left:0%;top:0%;width:100%');
  });

  it('a stand-in icon for a hiker with no portrait', () => {
    const html = renderToStaticMarkup(createElement(HikerPortrait, { hikerId: 'ben' }));
    expect(html).toContain('cards/family/human.png');
    expect(html).not.toContain('/portraits/');
  });
});

describe('cropping by faceY', () => {
  it('puts the face in the middle of the box', () => {
    // The card back's strip: 300 × 84, the window at full width.
    const { top, width } = cropWindow(300 / 84, 1, 0.4);
    const height = ((width / 100) * (300 / 84)) / WINDOW_ASPECT; // share of the box's height
    expect(width).toBe(100);
    expect(top / 100 + 0.4 * height).toBeCloseTo(0.5);
  });

  it("never shows the window's edges", () => {
    for (const faceY of [0, 0.1, 0.337, 0.5, 0.836, 1]) {
      for (const [aspect, zoom] of [
        [300 / 84, 1],
        [360 / 204, 1],
        [1, 1.6],
        [1, 1],
      ] as const) {
        const { left, top, width } = cropWindow(aspect, zoom, faceY);
        const height = (width / 100) * (aspect / WINDOW_ASPECT) * 100;
        expect(top).toBeLessThanOrEqual(0);
        expect(top + height).toBeGreaterThanOrEqual(100 - 1e-9);
        expect(left).toBeLessThanOrEqual(0);
        expect(left + width).toBeGreaterThanOrEqual(100 - 1e-9);
      }
    }
  });

  it('a square box widens the window enough to cover it', () => {
    expect(cropWindow(1, 1, 0.5).width).toBeCloseTo(WINDOW_ASPECT * 100);
    expect(cropWindow(1, 1.6, 0.5).width).toBeCloseTo(160);
  });
});
