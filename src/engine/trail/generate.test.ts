import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { createGame } from '../newGame';
import { seedRng } from '../rng';
import { fixtureHiker } from '../test/fixtures';
import { LINE_KINDS, NODE_TYPES, type BiomeId, type Section } from '../types';
import { checkSection } from './check';
import { generateSection } from './generate';

const SEEDS = Array.from({ length: 1000 }, (_, i) => i + 1);
const make = (seed: number, biome: BiomeId = 'meadow') =>
  generateSection(seedRng(seed), { biome, tier: 1 });
const middleTiles = (s: Section) => Object.values(s.tiles).filter((t) => t.kind === 'normal');
const TOLERANCE = 0.03;

describe('generateSection over 1,000 seeds', () => {
  const sections = SEEDS.map((seed) => make(seed));

  it('always gives a valid trail', () => {
    const failures = sections
      .map((s, i) => ({ seed: SEEDS[i], problems: checkSection(s) }))
      .filter((f) => f.problems.length > 0);
    expect(failures).toEqual([]);
  });

  it('stays within the size limits', () => {
    const sizes = sections.map((s) => middleTiles(s).length);
    const { middleRows, minWidth, maxWidth } = BALANCE.trail;
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(middleRows * minWidth);
    expect(Math.max(...sizes)).toBeLessThanOrEqual((middleRows - 2) * maxWidth + 4);
    // Trails do branch out: most reach 3 wide somewhere.
    const branching = sections.filter((s) => middleTiles(s).length > middleRows * 2).length;
    expect(branching / sections.length).toBeGreaterThan(0.8);
  });

  it('makes about 1 tile in 3 a special space', () => {
    const tiles = sections.flatMap(middleTiles);
    const share = tiles.filter((t) => t.special).length / tiles.length;
    expect(Math.abs(share - BALANCE.trail.specialChance)).toBeLessThan(TOLERANCE);
  });

  it('reveals about 1 node in 3 in advance', () => {
    const nodes = sections.flatMap(middleTiles).flatMap((t) => t.nodes);
    const share = nodes.filter((n) => n.revealed).length / nodes.length;
    expect(Math.abs(share - BALANCE.trail.nodeRevealedChance)).toBeLessThan(TOLERANCE);
  });

  it('weights line kinds as configured', () => {
    const lines = sections.flatMap((s) => s.lines);
    const weights = BALANCE.trail.lineKindWeights;
    const total = LINE_KINDS.reduce((sum, k) => sum + weights[k], 0);
    for (const kind of LINE_KINDS) {
      const share = lines.filter((l) => l.kind === kind).length / lines.length;
      expect(Math.abs(share - weights[kind] / total)).toBeLessThan(TOLERANCE);
    }
  });

  it('weights node counts as configured', () => {
    // The Wonder's tile has no nodes on purpose.
    const tiles = sections.flatMap(middleTiles).filter((t) => !t.wonder);
    const weights = BALANCE.trail.nodeCountWeights;
    const total = weights[1] + weights[2] + weights[3];
    for (const n of [1, 2, 3] as const) {
      const share = tiles.filter((t) => t.nodes.length === n).length / tiles.length;
      expect(Math.abs(share - weights[n] / total)).toBeLessThan(TOLERANCE);
    }
  });

  it('makes double nodes, Cap nodes, Bounty nodes, Narrow Paths and side features', () => {
    const tiles = sections.flatMap(middleTiles);
    const doubles = tiles.filter((t) =>
      NODE_TYPES.some((type) => t.nodes.filter((n) => n.type === type).length === 2),
    );
    expect(doubles.length).toBeGreaterThan(0);
    expect(tiles.some((t) => t.nodes.some((n) => n.type === 'caps'))).toBe(true);
    expect(tiles.some((t) => t.nodes.some((n) => n.bounty))).toBe(true);
    expect(tiles.some((t) => t.special === 'narrowPath')).toBe(true);
    expect(tiles.some((t) => t.feature === 'merchant')).toBe(true);
    expect(tiles.some((t) => t.feature === 'trader')).toBe(true);
  });
});

describe('generateSection', () => {
  it('gives the same trail for the same seed', () => {
    expect(make(123)).toEqual(make(123));
  });

  it('gives different trails for different seeds', () => {
    expect(make(1)).not.toEqual(make(2));
  });

  it('leans each biome toward its favored nodes', () => {
    const share = (biome: BiomeId, types: string[]) => {
      const nodes = SEEDS.slice(0, 300)
        .flatMap((seed) => middleTiles(make(seed, biome)))
        .flatMap((t) => t.nodes)
        .filter((n) => n.type !== 'caps');
      return nodes.filter((n) => types.includes(n.type)).length / nodes.length;
    };
    expect(share('temperateRainforest', ['forest', 'river'])).toBeGreaterThan(
      share('meadow', ['forest', 'river']) + 0.1,
    );
    expect(share('alpine', ['mountain'])).toBeGreaterThan(share('meadow', ['mountain']) + 0.1);
  });
});

describe('createGame', () => {
  const hikers = ['ash', 'birch', 'cedar', 'dot'].map((id) => fixtureHiker(id));

  it('generates the trail from the seed when no section is given', () => {
    const game = createGame({ seed: 42, hikers });
    expect(checkSection(game.section)).toEqual([]);
    expect(game.section).toEqual(createGame({ seed: 42, hikers }).section);
    expect(game.section).not.toEqual(createGame({ seed: 43, hikers }).section);
  });

  it('starts every hiker on the trailhead', () => {
    const game = createGame({ seed: 42, hikers });
    for (const h of game.hikers) expect(h.tileId).toBe(game.section.trailheadId);
  });
});
