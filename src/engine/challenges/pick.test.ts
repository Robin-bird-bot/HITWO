import { describe, expect, it } from 'vitest';
import { CARDS, CHALLENGES, TRIALS } from '../../content/challenges';
import { seedRng } from '../rng';
import { fixtureGame, fixtureHiker, hiker } from '../test/fixtures';
import type { GameState, Tile } from '../types';
import { BALANCE } from '../../config/balance';
import { cardFits, notPlayableYet, pickForTile, rolledTier, tileTier } from './pick';

function tile(nodes: Tile['nodes'], extra: Partial<Tile> = {}): Tile {
  return { id: 'X', row: 1, col: 0, kind: 'normal', special: null, nodes, ...extra };
}
const forest = tile([{ type: 'forest', revealed: true }]);
const card = (id: string) => {
  const c = CARDS[id];
  if (!c) throw new Error(id);
  return c;
};

function picks(state: GameState, t: Tile, n = 3000, seed = 4) {
  const rng = seedRng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pickForTile(state, rng, t, state.hikers);
    if (p) out.push(p);
  }
  return out;
}

describe('which cards fit a tile', () => {
  const s = fixtureGame();

  it('matches a node on the tile, or any', () => {
    expect(cardFits(card('squirrel-attack'), s, forest, s.hikers, 1)).toBe(true);
    expect(cardFits(card('cracked-pots'), s, forest, s.hikers, 1)).toBe(false);
    expect(cardFits(card('tummy-rumbling'), s, forest, s.hikers, 1)).toBe(true);
  });

  it('a challenge fits from its "From" tier on (Nov 26 evening)', () => {
    expect(cardFits(card('squirrel-attack'), s, forest, s.hikers, 1)).toBe(true);
    expect(cardFits(card('squirrel-attack'), s, forest, s.hikers, 3)).toBe(true);
    expect(cardFits(card('bobcat-attack'), s, forest, s.hikers, 1)).toBe(false);
    expect(cardFits(card('bobcat-attack'), s, forest, s.hikers, 2)).toBe(true);
  });

  it('checks each gate', () => {
    expect(cardFits(card('dog-waste-zone'), s, forest, s.hikers, 1)).toBe(false);
    const dog = fixtureGame({ hikers: [{ ...fixtureHiker('rex'), family: 'dog' }] });
    expect(cardFits(card('dog-waste-zone'), dog, forest, dog.hikers, 1)).toBe(true);

    const snowy = { ...fixtureGame(), snowy: true as const };
    const anyTile = tile([{ type: 'mountain', revealed: true }]);
    expect(cardFits(card('snow-leopard-attack'), s, anyTile, s.hikers, 3)).toBe(false);
    expect(cardFits(card('snow-leopard-attack'), snowy, anyTile, s.hikers, 3)).toBe(true);
  });

  it('every challenge in the list can be played; every Trial is switched off', () => {
    for (const c of CHALLENGES) expect(notPlayableYet(c), c.id).toBeUndefined();
    // Trials that share a name with a new card keep "-trial" on their id.
    expect(notPlayableYet(card('train-trial'))).toMatch(/switched off/);
    expect(card('train').kind).toBe('challenge');
    // Every Trial is switched off for now (Phase 10.6), Rocco's included.
    expect(TRIALS.every((t) => notPlayableYet(t))).toBe(true);
  });
});

describe('picking a card for a new tile', () => {
  it('a plain tile holds a challenge, or an opportunity where the section placed one (Phase 10.6)', () => {
    const s = fixtureGame();
    const plain = tile([
      { type: 'forest', revealed: true },
      { type: 'river', revealed: true },
    ]);
    expect(picks(s, plain, 300).every((p) => card(p.cardId).kind === 'challenge')).toBe(true);
    plain.opportunity = true;
    expect(picks(s, plain, 300).every((p) => card(p.cardId).kind === 'opportunity')).toBe(true);
  });

  it('never picks a Trial that’s switched off, or a third Trial', () => {
    const s = fixtureGame();
    const all = picks(s, forest);
    for (const p of all) expect(notPlayableYet(card(p.cardId))).toBeUndefined();
    s.trials = [{} as never, {} as never];
    expect(picks(s, forest).some((p) => card(p.cardId).kind === 'trial')).toBe(false);
  });

  it('repeats are fine for challenges now (Nov 26 evening)', () => {
    const s = fixtureGame();
    s.usedCards = CHALLENGES.map((c) => c.id).filter((id) => id !== 'squirrel-attack');
    const challenges = picks(s, forest, 400).filter((p) => card(p.cardId).kind === 'challenge');
    expect(new Set(challenges.map((p) => p.cardId)).size).toBeGreaterThan(3);
  });

  it('makes an Opportunity space an opportunity', () => {
    const s = fixtureGame();
    for (const p of picks(s, { ...forest, special: 'opportunity' }, 200)) {
      expect(card(p.cardId).kind).toBe('opportunity');
    }
  });

  it('draws a Challenge space from the next tier, and scales one above Tier III ×1.5 a tier', () => {
    const s = fixtureGame();
    const base = rolledTier(s, forest);
    for (const p of picks(s, { ...forest, special: 'challenge' }, 200)) {
      expect(card(p.cardId).tier).toBeLessThanOrEqual(Math.min(3, base + 1));
      expect(p.tier).toBe(Math.min(3, base + 1));
      expect(p.shownTier).toBe(base + 1);
      expect(p.scale).toBe(base + 1 > 3 ? BALANCE.challenges.tierScale ** (base - 2) : 1);
    }
    // Biome 3 (Alpine) rolls Tier III or IV: a Challenge space is IV or V, a Tier III card scaled up.
    s.section.biome = 'alpine';
    const top = rolledTier(s, forest);
    expect([3, 4]).toContain(top);
    const up = picks({ ...s, snowy: true }, { ...forest, special: 'challenge' }, 50);
    for (const p of up) {
      expect(p.tier).toBe(3);
      expect(p.shownTier).toBe(top + 1);
      expect(p.scale).toBeCloseTo(BALANCE.challenges.tierScale ** (top + 1 - 3));
    }
  });

  it('offers two different challenges on a Choice space', () => {
    const s = fixtureGame();
    for (const p of picks(s, { ...forest, special: 'choice' }, 200)) {
      expect(p.alternative).toBeDefined();
      expect(p.alternative).not.toBe(p.cardId);
    }
  });

  it('plays a tile one tier higher after Warning Bird', () => {
    const s = fixtureGame();
    const raised = { ...forest, tierBonus: 1 };
    for (const p of picks(s, raised, 300)) {
      expect(p.tier).toBe(Math.min(3, rolledTier(s, forest) + 1));
      expect(card(p.cardId).tier).toBeLessThanOrEqual(p.tier);
    }
    expect(hiker(s, 'ash')).toBeDefined();
  });
});

describe('which tier a challenge gets (15-challenge-tiers.md)', () => {
  /** How often each tier comes up over many tiles of one biome. */
  function shares(biome: 'meadow' | 'temperateRainforest' | 'alpine', nightmare = false) {
    const counts = new Map<number, number>();
    const n = 4000;
    for (let k = 0; k < n; k++) {
      const s = fixtureGame({ seed: k + 1 });
      s.section.biome = biome;
      if (nightmare) s.difficulty = 'nightmare';
      const t = rolledTier(s, { id: `tile-${k % 97}` });
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return new Map([...counts].map(([t, c]) => [t, c / n]));
  }

  it.each([
    ['meadow', 0],
    ['temperateRainforest', 1],
    ['alpine', 2],
  ] as const)('Normal, %s: close to its table', (biome, i) => {
    const table = BALANCE.challenges.tierTables.normal[i]!;
    const got = shares(biome);
    const total = table.reduce((a, [, w]) => a + w, 0);
    expect([...got.keys()].sort()).toEqual(table.map(([t]) => t).sort());
    for (const [t, w] of table) expect(got.get(t)).toBeCloseTo(w / total, 1);
  });

  it.each([
    ['meadow', 0],
    ['temperateRainforest', 1],
    ['alpine', 2],
  ] as const)('Nightmare, %s: close to its table', (biome, i) => {
    const table = BALANCE.challenges.tierTables.nightmare[i]!;
    const got = shares(biome, true);
    const total = table.reduce((a, [, w]) => a + w, 0);
    for (const [t, w] of table) expect(got.get(t)).toBeCloseTo(w / total, 1);
  });

  it('a tile’s tier stays the same however often it’s asked, and the tile’s changes add on top', () => {
    const s = fixtureGame({ seed: 9 });
    const t = rolledTier(s, forest);
    for (let k = 0; k < 5; k++) expect(rolledTier(s, forest)).toBe(t);
    expect(tileTier(s, { ...forest, tierBonus: 1 })).toBe(t + 1);
    expect(tileTier(s, { ...forest, tierBonus: -1 })).toBe(t - 1);
  });

  it('Tiers IV and V play a Tier III card, scaled up, and show IV or V; nothing goes above V', () => {
    const s = fixtureGame({ seed: 3 });
    s.section.biome = 'alpine';
    s.difficulty = 'nightmare';
    const base = rolledTier(s, forest);
    for (const p of picks({ ...s, snowy: true }, { ...forest, tierBonus: 3 }, 20)) {
      expect(p.shownTier).toBe(5);
      expect(p.tier).toBe(3);
      expect(base + 3).toBeGreaterThan(5);
    }
  });
});
