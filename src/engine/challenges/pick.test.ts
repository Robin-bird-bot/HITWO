import { describe, expect, it } from 'vitest';
import { CARDS, CHALLENGES, TRIALS } from '../../content/challenges';
import { seedRng } from '../rng';
import { fixtureGame, fixtureHiker, hiker } from '../test/fixtures';
import type { GameState, Tile } from '../types';
import { cardFits, notPlayableYet, pickForTile } from './pick';

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
    expect(cardFits(card('withered-forest'), s, forest, s.hikers, 1)).toBe(true);
    expect(cardFits(card('low-water-levels'), s, forest, s.hikers, 1)).toBe(false);
    expect(cardFits(card('tummy-rumbling'), s, forest, s.hikers, 1)).toBe(true);
  });

  it('matches the tier', () => {
    expect(cardFits(card('withered-forest'), s, forest, s.hikers, 2)).toBe(false);
    expect(cardFits(card('thorn-thicket'), s, forest, s.hikers, 1)).toBe(false);
  });

  it('checks each gate', () => {
    const afternoon = { ...fixtureGame(), phase: 'afternoon' as const };
    expect(cardFits(card('long-night-ahead'), s, forest, s.hikers, 1)).toBe(false);
    expect(cardFits(card('long-night-ahead'), afternoon, forest, s.hikers, 1)).toBe(true);

    expect(cardFits(card('dog-waste-zone'), s, forest, s.hikers, 1)).toBe(false);
    const dog = fixtureGame({ hikers: [{ ...fixtureHiker('rex'), family: 'dog' }] });
    expect(cardFits(card('dog-waste-zone'), dog, forest, dog.hikers, 1)).toBe(true);

    const snowy = { ...fixtureGame(), snowy: true as const };
    const anyTile = tile([{ type: 'mountain', revealed: true }]);
    expect(cardFits(card('snow-leopard'), s, anyTile, s.hikers, 3)).toBe(false);
    expect(cardFits(card('snow-leopard'), snowy, anyTile, s.hikers, 3)).toBe(true);

    expect(cardFits(card('lightning'), s, anyTile, s.hikers, 3)).toBe(false);
    const as = (today: 'storm' | 'heatwave') => ({ ...s, weather: { ...s.weather, today } });
    expect(cardFits(card('lightning'), as('storm'), anyTile, s.hikers, 3)).toBe(true);
    expect(cardFits(card('blazing-sun'), as('heatwave'), anyTile, s.hikers, 2)).toBe(true);
  });

  it('leaves out cards whose systems aren’t built yet', () => {
    expect(notPlayableYet(card('thorn-thicket'))).toMatch(/phase 8/); // durability only
    expect(notPlayableYet(card('fashion-critic'))).toMatch(/phase 8/);
    expect(notPlayableYet(card('sticky-sap'))).toBeUndefined(); // 2 Energy works now
    expect(notPlayableYet(card('mold-invasion'))).toMatch(/phase 8/);
    expect(notPlayableYet(card('frozen-fingers'))).toMatch(/phase 6/);
    expect(notPlayableYet(card('train'))).toBeUndefined();
    const off = TRIALS.filter((t) => notPlayableYet(t)).map((t) => t.id);
    expect(off.sort()).toEqual(
      ['bear-country', 'frozen-fingers', 'mold-invasion', 'rocco-raccoons-rebuilding-trial'].sort(),
    );
  });
});

describe('picking a card for a new tile', () => {
  it('mixes about 70% challenges, 20% Trials and 10% opportunities', () => {
    const s = fixtureGame();
    const mixed = tile([
      { type: 'forest', revealed: true },
      { type: 'river', revealed: true },
    ]);
    const all = picks(s, mixed, 5000);
    const share = (kind: string) =>
      all.filter((p) => card(p.cardId).kind === kind).length / all.length;
    expect(share('challenge')).toBeGreaterThan(0.66);
    expect(share('challenge')).toBeLessThan(0.74);
    expect(share('trial')).toBeGreaterThan(0.17);
    expect(share('trial')).toBeLessThan(0.23);
    expect(share('opportunity')).toBeGreaterThan(0.08);
    expect(share('opportunity')).toBeLessThan(0.12);
  });

  it('never picks a Trial that’s switched off, or a third Trial', () => {
    const s = fixtureGame();
    const all = picks(s, forest);
    for (const p of all) expect(notPlayableYet(card(p.cardId))).toBeUndefined();
    s.trials = [{} as never, {} as never];
    expect(picks(s, forest).some((p) => card(p.cardId).kind === 'trial')).toBe(false);
  });

  it('prefers cards this section hasn’t used', () => {
    const s = fixtureGame();
    const forestTier1 = CHALLENGES.filter(
      (c) => c.tier === 1 && (c.nodes === 'any' || c.nodes.includes('forest')),
    );
    s.usedCards = forestTier1.map((c) => c.id).filter((id) => id !== 'withered-forest');
    const challenges = picks(s, forest).filter((p) => card(p.cardId).kind === 'challenge');
    expect(new Set(challenges.map((p) => p.cardId))).toEqual(new Set(['withered-forest']));
  });

  it('makes an Opportunity space an opportunity', () => {
    const s = fixtureGame();
    for (const p of picks(s, { ...forest, special: 'opportunity' }, 200)) {
      expect(card(p.cardId).kind).toBe('opportunity');
    }
  });

  it('draws a Challenge space from the next tier, and scales a Tier III one ×1.5', () => {
    const s = fixtureGame();
    for (const p of picks(s, { ...forest, special: 'challenge' }, 200)) {
      expect(card(p.cardId).tier).toBe(2);
      expect(p.scale).toBe(1);
    }
    s.section.tier = 3;
    const up = picks({ ...s, snowy: true }, { ...forest, special: 'challenge' }, 50);
    for (const p of up) {
      expect(p.tier).toBe(3);
      expect(p.scale).toBe(1.5);
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
      const c = card(p.cardId);
      if (c.kind === 'challenge') expect(c.tier).toBe(2);
    }
    expect(hiker(s, 'ash')).toBeDefined();
  });
});
