import { describe, expect, it } from 'vitest';
import { seedRng } from '../rng';
import type { Section, Tile } from '../types';
import { checkSection } from './check';
import { generateSection } from './generate';

const fresh = (): Section => generateSection(seedRng(7), { biome: 'meadow', tier: 1 });
const middle = (s: Section): Tile[] =>
  Object.values(s.tiles)
    .filter((t) => t.kind === 'normal')
    .sort((a, b) => a.row - b.row || a.col - b.col);

describe('checkSection', () => {
  it('accepts a generated trail', () => {
    expect(checkSection(fresh())).toEqual([]);
  });

  it('catches a tile nothing connects to', () => {
    const s = fresh();
    const first = middle(s)[0] as Tile;
    s.tiles.lost = { ...first, id: 'lost', col: first.col + 40, nodes: [...first.nodes] };
    const problems = checkSection(s);
    expect(problems).toContain('Tile lost can’t be reached.');
    expect(problems).toContain('Tile lost has no line down.');
  });

  it('catches a dead end', () => {
    const s = fresh();
    const tile = middle(s)[0] as Tile;
    s.lines = s.lines.filter((l) => {
      const other = l.a === tile.id ? l.b : l.b === tile.id ? l.a : null;
      return !other || (s.tiles[other] as Tile).row <= tile.row;
    });
    expect(checkSection(s)).toContain(`Tile ${tile.id} has no line up (a dead end).`);
  });

  it('catches a line between tiles that aren’t neighbours', () => {
    const s = fresh();
    s.lines.push({ id: 'jump', a: s.trailheadId, b: s.checkpointId, kind: 'normal' });
    expect(checkSection(s)).toContain('Line jump joins tiles that aren’t neighbours.');
  });

  it('catches too many nodes, or too many of one type', () => {
    const s = fresh();
    const tile = middle(s)[0] as Tile;
    tile.nodes = ['river', 'river', 'river', 'forest'].map((type) => ({
      type: type as 'river' | 'forest',
      revealed: true,
    }));
    const problems = checkSection(s);
    expect(problems).toContain(`Tile ${tile.id} has 4 nodes (allowed 1–3).`);
    expect(problems).toContain(`Tile ${tile.id} has 3 river nodes.`);
  });

  it('catches a second checkpoint', () => {
    const s = fresh();
    (middle(s)[0] as Tile).kind = 'checkpoint';
    expect(checkSection(s)).toContain('Expected 1 checkpoint, found 2.');
  });

  it('catches a Narrow Path without a capacity', () => {
    const s = fresh();
    const tile = middle(s)[0] as Tile;
    tile.special = 'narrowPath';
    delete tile.narrowCapacity;
    expect(checkSection(s)).toContain(`Narrow Path ${tile.id} has capacity none.`);
  });
});
