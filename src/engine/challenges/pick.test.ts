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
    // Durability, tool uses, eating and crafting all work now (Phase 8).
    for (const id of [
      'thorn-thicket',
      'fashion-critic',
      'sticky-sap',
      'mold-invasion',
      'bear-country',
    ]) {
      const c = card(id);
      if (c.kind === 'trial') expect(notPlayableYet(c)).toMatch(/switched off/);
      else expect(notPlayableYet(c)).toBeUndefined();
    }
    // Trials (Frozen Fingers, Train) are switched off for now (Phase 10.6).
    expect(notPlayableYet(card('frozen-fingers'))).toMatch(/switched off/);
    expect(notPlayableYet(card('train'))).toMatch(/switched off/);
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
