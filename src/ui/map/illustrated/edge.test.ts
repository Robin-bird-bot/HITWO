/**
 * The map edge and corners (Phase 10.6 part A and the map-corners update):
 * the camera stops with the whole sheet on screen, the sheet isn't rotated,
 * and the corner pieces sit in the land's corners clear of tiles, paths and
 * place names.
 */
import { describe, expect, it } from 'vitest';
import { MAP_STYLE, u } from '../../../config/mapStyle';
import { STARTING_PARTY } from '../../../content/characters';
import { createGame } from '../../../engine';
import { MAP_VIEW, ZOOM, clampCamera, sheetBounds } from '../mapLayout';
import { mapGeometry } from './geometry';
import { cornerBoxes } from './land/corners';
import { buildFeatures } from './land/features';
import { landInput, OREGON_NAMES } from './land/input';
import { buildLand, landRect } from './land/model';
import { landDebugOf } from './mapDebug';

const M = u(MAP_STYLE.sheet.margin);
const sheetOf = (seed: number) => {
  const game = createGame({ seed, hikers: STARTING_PARTY });
  const geo = mapGeometry(game.section, { style: 'illustrated', runSeed: seed, sectionIndex: 0 });
  const input = landInput(game.section, geo, { runSeed: seed, sectionIndex: 0, cellUnits: 4 });
  const land = landRect(input.tiles, input.hexR);
  return {
    game,
    geo,
    input,
    land,
    sheet: {
      x0: land.x0 - M,
      y0: land.y0 - M,
      width: land.width + 2 * M,
      height: land.height + 2 * M,
    },
  };
};

describe('the camera on the paper sheet', () => {
  const { sheet } = sheetOf(3);
  const b = sheetBounds(sheet, MAP_STYLE.camera.fitMargin, MAP_STYLE.camera.edgeAt);

  it('zooming out stops with the whole sheet on screen, a little table around it', () => {
    const out = clampCamera({ x: 0, y: 0, zoom: 0.01 }, b);
    expect(out.zoom).toBe(b.minZoom);
    const m = MAP_STYLE.camera.fitMargin;
    expect(sheet.width * out.zoom).toBeLessThanOrEqual(MAP_VIEW.w * (1 - 2 * m) + 1e-6);
    expect(sheet.height * out.zoom).toBeLessThanOrEqual(MAP_VIEW.h * (1 - 2 * m) + 1e-6);
    // ...and one side fills it, so it's as big as it can be.
    const fills =
      Math.abs(sheet.width * out.zoom - MAP_VIEW.w * (1 - 2 * m)) < 1e-6 ||
      Math.abs(sheet.height * out.zoom - MAP_VIEW.h * (1 - 2 * m)) < 1e-6;
    expect(fills).toBe(true);
    expect(clampCamera({ x: 0, y: 0, zoom: 99 }, b).zoom).toBe(ZOOM.max);
  });

  it('panning stops once the sheet’s edge is 40% of the way across the view', () => {
    const zoom = 1;
    const far = clampCamera({ x: -1e6, y: -1e6, zoom }, b);
    // The sheet's left edge on screen, as a share of the view from its left.
    const left = ((sheet.x0 - (far.x - MAP_VIEW.w / 2 / zoom)) * zoom) / MAP_VIEW.w;
    const top = ((sheet.y0 - (far.y - MAP_VIEW.h / 2 / zoom)) * zoom) / MAP_VIEW.h;
    expect(left).toBeCloseTo(MAP_STYLE.camera.edgeAt, 6);
    expect(top).toBeCloseTo(MAP_STYLE.camera.edgeAt, 6);
  });
});

describe('the sheet', () => {
  it('lies straight around the land, so tiles stay where the geometry puts them', () => {
    const { sheet, land, geo } = sheetOf(5);
    expect(sheet.x0).toBeLessThan(land.x0);
    expect(sheet.x0 + sheet.width).toBeGreaterThan(land.x0 + land.width);
    for (const c of Object.values(geo.centers)) {
      expect(c.x).toBeGreaterThan(land.x0);
      expect(c.x).toBeLessThan(land.x0 + land.width);
      expect(c.y).toBeGreaterThan(land.y0);
      expect(c.y).toBeLessThan(land.y0 + land.height);
    }
    // The model's land is the same box (the sheet is drawn around the real land).
    const { input } = sheetOf(5);
    const model = buildLand(input);
    expect({ x0: model.x0, y0: model.y0, width: model.width, height: model.height }).toEqual(land);
  });
});

describe('the corner pieces', () => {
  for (const seed of [3, 11, 42]) {
    it(`sit in the land’s corners, clear of tiles, paths and place names (seed ${seed})`, () => {
      const { land, input } = sheetOf(seed);
      const { section, compass } = cornerBoxes(land);
      const inside = (b: typeof section) =>
        b.x0 >= land.x0 &&
        b.y0 >= land.y0 &&
        b.x1 <= land.x0 + land.width &&
        b.y1 <= land.y0 + land.height;
      expect(inside(section)).toBe(true);
      expect(inside(compass)).toBe(true);
      // Bottom left and top right.
      expect(section.x0 - land.x0).toBeCloseTo(u(MAP_STYLE.corners.inset), 6);
      expect(land.y0 + land.height - section.y1).toBeCloseTo(u(MAP_STYLE.corners.inset), 6);
      expect(land.x0 + land.width - compass.x1).toBeCloseTo(u(MAP_STYLE.corners.inset), 6);
      expect(compass.y0 - land.y0).toBeCloseTo(u(MAP_STYLE.corners.inset), 6);
      const hit = (b: typeof section, x: number, y: number, r: number) =>
        x + r > b.x0 && x - r < b.x1 && y + r > b.y0 && y - r < b.y1;
      for (const t of input.tiles) {
        expect(hit(section, t.x, t.y, input.hexR)).toBe(false);
        expect(hit(compass, t.x, t.y, input.hexR)).toBe(false);
      }
      for (const path of input.paths) {
        for (const { x, y } of path.pts) {
          expect(hit(section, x, y, 0)).toBe(false);
          expect(hit(compass, x, y, 0)).toBe(false);
        }
      }
      const { places } = buildFeatures(buildLand(input), OREGON_NAMES);
      for (const p of places) {
        for (const c of [section, compass]) {
          const overlap = p.box.x1 > c.x0 && p.box.x0 < c.x1 && p.box.y1 > c.y0 && p.box.y0 < c.y1;
          expect(overlap, p.name).toBe(false);
        }
      }
    });
  }
});

describe('Show whole map', () => {
  it('paints the whole land; the debug panel’s paint tools win while they’re on', () => {
    expect(landDebugOf({}, true).reveal).toBe('whole');
    expect(landDebugOf({}, false).reveal).toBeUndefined();
    expect(landDebugOf({ reveal: 'none' }, true).reveal).toBe('none');
  });

  it('only changes the land: the tiles’ own reveal state is untouched', () => {
    const { game } = sheetOf(7);
    const before = JSON.stringify(game.section.tiles);
    landDebugOf({}, true);
    expect(JSON.stringify(game.section.tiles)).toBe(before);
  });
});
