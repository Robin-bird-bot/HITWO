import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MAP_STYLE, u } from '../../../config/mapStyle';
import { STARTING_PARTY } from '../../../content/characters';
import { createGame } from '../../../engine';
import { HEX, lastRowOf, mapBounds, tileCenter } from '../mapLayout';
import { MapView } from '../MapView';
import { mapGeometry, pathMiddle } from './geometry';

const game = createGame({ seed: 12, hikers: STARTING_PARTY });
const section = game.section;
const lastRow = lastRowOf(section);
const geo = (style: 'classic' | 'illustrated', runSeed = 12, sectionIndex = 0) =>
  mapGeometry(section, { style, runSeed, sectionIndex });

describe('jitter (section 3)', () => {
  it('moves each tile within ±24 by ±16, sized ×0.90–1.07', () => {
    const g = geo('illustrated');
    let moved = 0;
    for (const t of Object.values(section.tiles)) {
      const grid = tileCenter(t, lastRow);
      const c = g.centers[t.id]!;
      expect(Math.abs(c.x - grid.x)).toBeLessThanOrEqual(u(MAP_STYLE.jitter.x) + 1e-9);
      expect(Math.abs(c.y - grid.y)).toBeLessThanOrEqual(u(MAP_STYLE.jitter.y) + 1e-9);
      expect(g.scales[t.id]).toBeGreaterThanOrEqual(MAP_STYLE.jitter.scaleMin);
      expect(g.scales[t.id]).toBeLessThanOrEqual(MAP_STYLE.jitter.scaleMax);
      if (c.x !== grid.x || c.y !== grid.y) moved += 1;
    }
    expect(moved).toBeGreaterThan(5);
  });

  it('never moves the trailhead or the checkpoint', () => {
    const g = geo('illustrated');
    for (const id of [section.trailheadId, section.checkpointId]) {
      expect(g.centers[id]).toEqual(tileCenter(section.tiles[id]!, lastRow));
      expect(g.scales[id]).toBe(1);
    }
  });

  it('is the same for the same run and section, and different for another', () => {
    expect(geo('illustrated')).toEqual(geo('illustrated'));
    expect(geo('illustrated', 13)).not.toEqual(geo('illustrated'));
    expect(geo('illustrated', 12, 1)).not.toEqual(geo('illustrated'));
  });

  it('Classic stays on the grid, with straight lines', () => {
    const g = geo('classic');
    for (const t of Object.values(section.tiles)) {
      expect(g.centers[t.id]).toEqual(tileCenter(t, lastRow));
    }
    for (const line of section.lines) expect(g.paths[line.id]).toHaveLength(2);
  });
});

describe('winding paths (section 3)', () => {
  it('each path runs from its tile to the other, bending only a little', () => {
    const g = geo('illustrated');
    const amp = u(MAP_STYLE.wind.ampBetweenRows);
    for (const line of section.lines) {
      const pts = g.paths[line.id]!;
      const a = g.centers[line.a]!;
      const b = g.centers[line.b]!;
      expect(pts[0]).toEqual(a);
      expect(pts.at(-1)!.x).toBeCloseTo(b.x);
      expect(pts.at(-1)!.y).toBeCloseTo(b.y);
      // The middle is at most a1 + a2 (1.6 × amp) off the straight line.
      const m = pathMiddle(pts);
      const off = Math.abs((b.x - a.x) * (a.y - m.y) - (a.x - m.x) * (b.y - a.y));
      expect(off / Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(1.6 * amp + 1e-6);
    }
  });
});

describe('the map draws tiles where the geometry puts them', () => {
  it('each tile sits on its moved centre, so clicks land on the moved hex', () => {
    const g = geo('illustrated');
    const html = renderToStaticMarkup(
      createElement(MapView, {
        section,
        hikers: game.hikers,
        targets: [],
        onTileClick: () => {},
        selectedId: null,
        onSelectHiker: () => {},
        camera: { x: 0, y: 0, zoom: 1 },
        setCamera: () => {},
        bounds: mapBounds(section),
        geo: g,
      }),
    );
    const head = section.tiles[section.trailheadId]!;
    const moved = Object.values(section.tiles).find(
      (t) => t.kind === 'normal' && g.centers[t.id]!.x !== tileCenter(t, lastRow).x,
    )!;
    for (const t of [head, moved]) {
      const c = g.centers[t.id]!;
      expect(html).toContain(`left:${c.x - HEX.w / 2}px;top:${c.y - HEX.h / 2}px`);
    }
  });
});
