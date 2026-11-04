import { describe, expect, it } from 'vitest';
import { generateSection, seedRng } from '../../engine';
import {
  clampCamera,
  focusOn,
  HALF_STEP,
  lastRowOf,
  MAP_VIEW,
  mapBounds,
  panBy,
  ROW_STEP,
  scrollAbove,
  stageToWorld,
  tileCenter,
  visibleRange,
  worldToStage,
  ZOOM,
  zoomAt,
} from './mapLayout';

const section = generateSection(seedRng(123), { biome: 'meadow', tier: 1 });
const bounds = mapBounds(section);
const viewCenter = { x: MAP_VIEW.x + MAP_VIEW.w / 2, y: MAP_VIEW.y + MAP_VIEW.h / 2 };

describe('map geometry', () => {
  it('puts the checkpoint at the top and the trailhead at the bottom', () => {
    const last = lastRowOf(section);
    const head = tileCenter(section.tiles[section.trailheadId]!, last);
    const top = tileCenter(section.tiles[section.checkpointId]!, last);
    expect(head.y).toBe(last * ROW_STEP);
    expect(top.y).toBe(0);
  });

  it('spaces tiles like the mockup: 256 px apart in a row, 152 px between rows', () => {
    const t = { id: 'x', row: 3, col: -2, kind: 'normal' as const, special: null, nodes: [] };
    expect(tileCenter(t, 6)).toEqual({ x: -2 * HALF_STEP, y: 3 * ROW_STEP });
    expect(2 * HALF_STEP).toBe(256);
  });

  it('includes every tile inside the bounds', () => {
    const last = lastRowOf(section);
    for (const t of Object.values(section.tiles)) {
      const c = tileCenter(t, last);
      expect(c.x).toBeGreaterThan(bounds.minX);
      expect(c.x).toBeLessThan(bounds.maxX);
      expect(c.y).toBeGreaterThan(bounds.minY);
      expect(c.y).toBeLessThan(bounds.maxY);
    }
  });
});

describe('camera', () => {
  it('converts between world and stage points both ways', () => {
    const cam = { x: 40, y: 300, zoom: 1.2 };
    const p = { x: 100, y: 500 };
    const back = stageToWorld(cam, worldToStage(cam, p));
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
    expect(worldToStage(cam, { x: cam.x, y: cam.y })).toEqual(viewCenter);
  });

  it('keeps the camera inside the map', () => {
    const far = clampCamera({ x: 99999, y: -99999, zoom: 1 }, bounds);
    const halfH = MAP_VIEW.h / 2;
    expect(far.y).toBeCloseTo(bounds.minY + halfH);
    const panned = panBy(far, 0, 99999, bounds);
    expect(panned.y).toBe(far.y);
  });

  it('centres a map that is narrower than the view', () => {
    const cam = clampCamera({ x: 99999, y: 0, zoom: 1 }, bounds);
    if (bounds.maxX - bounds.minX <= MAP_VIEW.w) {
      expect(cam.x).toBeCloseTo((bounds.minX + bounds.maxX) / 2);
    }
  });

  it('limits zoom', () => {
    expect(clampCamera({ x: 0, y: 0, zoom: 10 }, bounds).zoom).toBe(ZOOM.max);
    expect(clampCamera({ x: 0, y: 0, zoom: 0.01 }, bounds).zoom).toBe(ZOOM.min);
  });

  it('zooms around the pointer, keeping the point under it still', () => {
    const cam = focusOn({ x: 0, y: 600 }, 1, bounds);
    const anchor = { x: 700, y: 520 };
    const before = stageToWorld(cam, anchor);
    const zoomed = zoomAt(cam, 1.25, anchor, bounds);
    const after = stageToWorld(zoomed, anchor);
    expect(zoomed.zoom).toBeCloseTo(1.25);
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
  });

  it('reports no parallax scroll at the bottom, and more as the map scrolls up', () => {
    const bottom = clampCamera({ x: 0, y: 99999, zoom: 1 }, bounds);
    expect(scrollAbove(bottom, bounds)).toBe(0);
    const higher = panBy(bottom, 0, 200, bounds);
    expect(scrollAbove(higher, bounds)).toBeCloseTo(200);
  });

  it('describes what the camera shows for the side rail', () => {
    const top = clampCamera({ x: 0, y: -99999, zoom: 1 }, bounds);
    expect(visibleRange(top, bounds).top).toBe(0);
    const bottom = clampCamera({ x: 0, y: 99999, zoom: 1 }, bounds);
    expect(visibleRange(bottom, bounds).bottom).toBeCloseTo(1);
  });
});
