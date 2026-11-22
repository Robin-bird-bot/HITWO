/**
 * The illustrated map's land (Phase 10.5, section 12's tests). Built on a
 * coarse grid (4 prototype units a cell) so the tests stay quick; the game
 * uses 1.
 */
import { describe, expect, it, vi } from 'vitest';
import { u } from '../../../../config/mapStyle';
import { STARTING_PARTY } from '../../../../content/characters';
import { createGame, type Section } from '../../../../engine';
import { mapGeometry } from '../geometry';
import { buildFeatures, polyDist, stampBox } from './features';
import { landInput, OREGON_NAMES } from './input';
import { maskAt, maskGrid, paintMask, revealedTiles } from './mask';
import { buildLand, riverChain, type LandInput } from './model';

const CELL = 4;
// Building land is real work: give it room when the whole suite runs at once.
vi.setConfig({ testTimeout: 60_000 });

/** A real trail, with nodes set so every rule has something to do. */
function trail(seed = 21, sectionIndex = 0): { section: Section; input: LandInput } {
  const section = structuredClone(createGame({ seed, hikers: STARTING_PARTY }).section);
  const normal = Object.values(section.tiles)
    .filter((t) => t.kind === 'normal')
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const set = (i: number, types: ('forest' | 'river' | 'wildlife' | 'mountain')[]) => {
    const t = normal[i % normal.length]!;
    t.nodes = types.map((type) => ({ type, revealed: false }));
  };
  set(0, ['river', 'forest']);
  set(3, ['river', 'river']);
  set(5, ['mountain', 'mountain']);
  set(6, ['forest', 'forest']);
  set(8, ['wildlife']);
  set(9, ['river']);
  const geo = mapGeometry(section, { style: 'illustrated', runSeed: seed, sectionIndex });
  return {
    section,
    input: landInput(section, geo, { runSeed: seed, sectionIndex, cellUnits: CELL }),
  };
}

const timed = <T>(f: () => T): [T, number] => {
  const t = performance.now();
  const out = f();
  return [out, performance.now() - t];
};

describe('the land is the same for the same run (deterministic)', () => {
  it('same seed, section and tiles: identical fields and names; another seed: different', () => {
    const a = trail();
    const [landA, ms] = timed(() => buildLand(a.input));
    const landB = buildLand(trail().input);
    expect(landA.hash).toBe(landB.hash);
    expect(buildFeatures(landA, OREGON_NAMES).places).toEqual(
      buildFeatures(landB, OREGON_NAMES).places,
    );
    const other = buildLand({ ...a.input, runSeed: 22 });
    expect(other.hash).not.toBe(landA.hash);
    // Logged, not a failure: the game's own grid is finer (see the debug panel).
    console.info(`land at ${CELL} units a cell: ${ms.toFixed(0)} ms`);
  });
});

describe('the land is built from the nodes', () => {
  const { section, input } = trail();
  const land = buildLand(input);
  const features = buildFeatures(land, OREGON_NAMES);
  const R = input.hexR;
  const riverTiles = input.tiles.filter((t) => t.nodes.includes('river'));

  it('water passes within a tile radius of every River tile: the river, or a creek', () => {
    expect(riverTiles.length).toBeGreaterThan(1);
    for (const t of riverTiles) {
      const d = Math.min(polyDist(t, land.river), ...land.creeks.map((k) => polyDist(t, k)));
      expect(d, t.id).toBeLessThan(R);
    }
    // The main river runs through the chain it can reach, top to bottom.
    expect(land.riverTiles).toEqual(riverChain(input.tiles, 152).map((t) => t.id));
    expect(land.river[0]!.y).toBeLessThan(land.y0 + 1);
    expect(land.river.at(-1)!.y).toBeGreaterThan(land.y0 + land.height - 1);
  });

  it('every River ×2 tile has a pond, peeking out from under it', () => {
    const doubles = input.tiles.filter((t) => t.nodes.filter((n) => n === 'river').length >= 2);
    expect(doubles.length).toBeGreaterThan(0);
    for (const t of doubles) {
      expect(land.ponds.some((p) => Math.hypot(p.cx - t.x, p.cy - t.y) < R * 1.2)).toBe(true);
    }
  });

  it('peaks sit near Mountain tiles', () => {
    for (const t of input.tiles.filter((x) => x.nodes.includes('mountain'))) {
      let most = 0;
      const reach = u(170);
      for (let gy = 0; gy < land.gh; gy++) {
        for (let gx = 0; gx < land.gw; gx++) {
          const x = land.x0 + gx * land.cell;
          const y = land.y0 + gy * land.cell;
          if (Math.hypot(x - t.x, y - t.y) < reach)
            most = Math.max(most, land.peak[gy * land.gw + gx]!);
        }
      }
      expect(most, t.id).toBeGreaterThan(0.6);
    }
  });

  it('no forest inside any tile hex', () => {
    for (const t of input.tiles) {
      for (let gy = 0; gy < land.gh; gy++) {
        for (let gx = 0; gx < land.gw; gx++) {
          const x = land.x0 + (gx + 0.5) * land.cell;
          const y = land.y0 + (gy + 0.5) * land.cell;
          // The hex's inner circle: everything inside it is the hex.
          if (Math.hypot(x - t.x, y - t.y) < R * t.scale * 0.85) {
            expect(land.forestMask[gy * land.gw + gx], t.id).toBe(0);
          }
        }
      }
    }
    expect(land.crowns.length).toBeGreaterThan(50);
    for (const c of land.crowns) {
      for (const t of input.tiles)
        expect(Math.hypot(c.x - t.x, c.y - t.y)).toBeGreaterThan(R * t.scale * 0.8);
    }
  });

  it('stamps: none in a tile hex, none on a path', () => {
    expect(features.stamps.length).toBeGreaterThan(5);
    for (const s of features.stamps) {
      const b = stampBox(s);
      for (const t of input.tiles) {
        const r = R * t.scale * 0.85;
        const inside = t.x > b.x0 - r && t.x < b.x1 + r && t.y > b.y0 - r && t.y < b.y1 + r;
        if (inside)
          expect(
            Math.hypot(s.x - t.x, s.y - s.h / 2 - t.y),
            `${s.kind} in ${t.id}`,
          ).toBeGreaterThan(r);
      }
      if (s.kind === 'waterfall') continue;
      for (const p of input.paths) {
        expect(
          polyDist({ x: s.x, y: s.y - s.h * 0.25 }, p.pts),
          `${s.kind} on ${p.id}`,
        ).toBeGreaterThan(s.w / 2);
      }
    }
    expect(features.stamps.some((s) => s.kind === 'cabin')).toBe(true);
  });

  it('labels never sit under a tile or on each other', () => {
    const { places } = features;
    expect(places.length).toBeGreaterThan(2);
    for (const p of places) {
      for (const t of input.tiles) {
        const r = R * t.scale;
        const over =
          p.box.x1 > t.x - r && p.box.x0 < t.x + r && p.box.y1 > t.y - r && p.box.y0 < t.y + r;
        expect(over, `${p.name} over ${t.id}`).toBe(false);
      }
      for (const q of places) {
        if (q === p) continue;
        const over =
          p.box.x1 > q.box.x0 && p.box.x0 < q.box.x1 && p.box.y1 > q.box.y0 && p.box.y0 < q.box.y1;
        expect(over, `${p.name} on ${q.name}`).toBe(false);
      }
    }
    expect(section.tiles).toBeDefined();
  });
});

describe('names (section 10)', () => {
  it('no name repeats across a 3-section run, and a reload gives the same names', () => {
    const all: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { input } = trail(31 + i, i);
      // Same run: the run seed is shared by its sections.
      const land = buildLand({ ...input, runSeed: 31 });
      all.push(...buildFeatures(land, OREGON_NAMES).places.map((p) => p.name));
    }
    expect(all.length).toBeGreaterThan(5);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('the reveal mask (section 6)', () => {
  const { section, input } = trail();
  const land = buildLand(input);
  const spots = (ids: string[]) =>
    ids.map((id) => {
      const t = input.tiles.find((x) => x.id === id)!;
      return { id, x: t.x, y: t.y, trailhead: t.kind === 'trailhead' };
    });

  it('the trailhead area is painted from the start; a revealed tile adds paint around it', () => {
    const start = revealedTiles(section);
    // The trailhead, and any tile whose nodes already show.
    expect(start).toContain(section.trailheadId);
    for (const id of start) {
      const t = section.tiles[id]!;
      expect(t.kind === 'trailhead' || t.visited || t.nodes.some((n) => n.revealed)).toBe(true);
    }
    expect(start).not.toContain(section.checkpointId);
    const g = maskGrid(land, input.runSeed, input.sectionIndex);
    paintMask(g, spots(start));
    const head = section.tiles[section.trailheadId]!;
    const far = input.tiles.find((t) => t.kind === 'checkpoint')!;
    expect(
      maskAt(
        g,
        input.tiles.find((t) => t.id === head.id)!.x,
        input.tiles.find((t) => t.id === head.id)!.y,
      ),
    ).toBe(1);
    expect(maskAt(g, far.x, far.y)).toBe(0);
    paintMask(g, spots([...start, far.id]));
    expect(maskAt(g, far.x, far.y)).toBe(1);
  });

  it('is the same when rebuilt (a reload), and a growing disc covers less', () => {
    const ids = [section.trailheadId, ...Object.keys(section.tiles).slice(0, 3)];
    const a = maskGrid(land, input.runSeed, input.sectionIndex);
    const b = maskGrid(land, input.runSeed, input.sectionIndex);
    paintMask(a, spots(ids));
    paintMask(b, spots(ids));
    expect(a.alpha).toEqual(b.alpha);
    const half = maskGrid(land, input.runSeed, input.sectionIndex);
    paintMask(half, spots(ids), Object.fromEntries(ids.map((id) => [id, 0.4])));
    const sum = (x: Uint8Array) => x.reduce((n, v) => n + v, 0);
    expect(sum(half.alpha)).toBeLessThan(sum(a.alpha));
  });
});
