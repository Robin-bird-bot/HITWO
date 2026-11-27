/**
 * The biome's challenge pool, placed on tiles when the section is made
 * (docs/design/25-challenges-on-the-map.md, sections 1 and 6).
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { CARDS } from '../../content/challenges';
import { createGame } from '../newGame';
import { fixtureHiker, run } from '../test/fixtures';
import type { GameState, Tile } from '../types';
import { challengeTiles, fitsTile, placePool, placedTier, poolCards } from './pool';
import { revealTile } from './reveal';
import type { ChallengeDef } from './types';

const PB = BALANCE.challenges.pool;
const HIKERS = ['finn', 'mom', 'ellie'].map((id) => fixtureHiker(id));
const game = (seed: number) => createGame({ seed, hikers: HIKERS, startingResources: false });

/** Every tile that holds a placed challenge. */
const placedTiles = (s: GameState): Tile[] =>
  Object.values(s.section.tiles).filter(
    (t) => t.revealedCard && CARDS[t.revealedCard.cardId]?.kind === 'challenge',
  );

const nodesFit = (card: ChallengeDef, tile: Tile) =>
  card.nodes === 'any' ||
  tile.nodes.some((n) => (card.nodes as readonly string[]).includes(n.type));

describe('the pool, placed when the section is made', () => {
  it('every challenge tile holds a placed card that fits its nodes and tier', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = game(seed);
      const tiles = challengeTiles({ ...s, section: { ...s.section } });
      expect(placedTiles(s).length).toBeGreaterThan(0);
      for (const t of placedTiles(s)) {
        const card = CARDS[t.revealedCard!.cardId] as ChallengeDef;
        expect(card.kind).toBe('challenge');
        expect(nodesFit(card, t), `${card.id} on ${t.id}`).toBe(true);
        expect(card.tier).toBeLessThanOrEqual(t.revealedCard!.shownTier!);
        expect(t.revealedCard!.shownTier).toBe(placedTier(s, t));
      }
      // Every challenge tile got one (tiles that hold one aren't "challenge tiles" any more).
      expect(tiles.filter((t) => !t.revealedCard)).toEqual([]);
    }
  });

  it('the pool is challenge tiles ÷ [2.5] rounded up, [3] to [7] cards, with a share of cost cards', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = game(seed);
      const n = placedTiles(s).length;
      const pool = poolCards(s);
      const want = Math.max(PB.min, Math.min(PB.max, Math.ceil(n / PB.tilesPerCard)));
      // A tile nothing in the pool fits can add one card from outside.
      expect(pool.length).toBeGreaterThanOrEqual(Math.min(want, pool.length));
      expect(pool.length).toBeGreaterThanOrEqual(Math.min(PB.min, n));
      expect(new Set(pool.map((c) => c.id)).size).toBe(pool.length);
      // Every placed card is in the pool.
      for (const t of placedTiles(s)) {
        expect(s.section.pool).toContain(t.revealedCard!.cardId);
        if (t.revealedCard!.alternative)
          expect(s.section.pool).toContain(t.revealedCard!.alternative);
      }
    }
    // The first biome: about [40%] cost cards over many runs.
    let costs = 0;
    let all = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const pool = poolCards(game(seed));
      costs += pool.filter((c) => !c.minigame).length;
      all += pool.length;
    }
    expect(costs / all).toBeGreaterThan(PB.costShare[0]! - 0.15);
    expect(costs / all).toBeLessThan(PB.costShare[0]! + 0.15);
  });

  it('every pool card is on at least one tile when there are enough tiles', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = game(seed);
      const tiles = placedTiles(s);
      const pool = poolCards(s);
      if (tiles.length < PB.max) continue;
      checked++;
      const used = new Set(
        tiles.flatMap((t) => [t.revealedCard!.cardId, t.revealedCard!.alternative]),
      );
      for (const c of pool) expect(used.has(c.id), `seed ${seed}: ${c.id}`).toBe(true);
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('the same seed places the same cards', () => {
    const cards = (s: GameState) =>
      placedTiles(s).map(
        (t) => `${t.id}:${t.revealedCard!.cardId}:${t.revealedCard!.version ?? ''}`,
      );
    expect(cards(game(7))).toEqual(cards(game(7)));
    expect(cards(game(7))).not.toEqual(cards(game(8)));
  });

  it('snow-only cards only on a snowy section', () => {
    const snowOnly = (c: ChallengeDef) => (c.gates ?? []).includes('snow');
    for (let seed = 1; seed <= 30; seed++) {
      expect(poolCards(game(seed)).some(snowOnly)).toBe(false);
    }
    // A snowy section: re-placed, snow cards can come up (at their tiers).
    let seen = false;
    for (let seed = 1; seed <= 60 && !seen; seed++) {
      const s = game(seed);
      for (const t of Object.values(s.section.tiles)) {
        delete t.revealedCard;
        if (t.kind === 'normal' && !t.quiet && !t.opportunity) t.tierBonus = 3;
      }
      s.snowy = true;
      placePool(s);
      seen = poolCards(s).some(snowOnly);
    }
    expect(seen).toBe(true);
  });

  it('Choice spaces get two different pool cards; a minigame with versions gets one the tile fits', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = game(seed);
      for (const t of placedTiles(s)) {
        const placed = t.revealedCard!;
        if (t.special === 'choice' && placed.alternative)
          expect(placed.alternative).not.toBe(placed.cardId);
        const card = CARDS[placed.cardId] as ChallengeDef;
        const versions = card.minigame?.versions;
        if (!versions) continue;
        const v = versions[placed.version ?? 0]!;
        if (v.nodes)
          expect(t.nodes.some((n) => (v.nodes as readonly string[]).includes(n.type))).toBe(true);
        if (v.fromTier !== undefined) expect(placed.shownTier).toBeGreaterThanOrEqual(v.fromTier);
        if (v.upToTier !== undefined) expect(placed.shownTier).toBeLessThanOrEqual(v.upToTier);
      }
    }
  });

  it('a placed card whose gate fails on landing plays another fitting pool card, and the placement moves', () => {
    // The Dog Waste Zone needs a Dog on the tile; there is none.
    let s = game(3);
    const tile = placedTiles(s).find((t) =>
      poolCards(s).some(
        (c) => c.id !== 'dog-waste-zone' && fitsTile(c, s, t, t.revealedCard!.shownTier!),
      ),
    )!;
    tile.revealedCard = { ...tile.revealedCard!, cardId: 'dog-waste-zone' };
    delete tile.revealedCard.version;
    s.section.pool = [...(s.section.pool ?? []), 'dog-waste-zone'];
    for (const h of s.hikers) h.tileId = tile.id;
    s = { ...s };
    revealTile(
      s,
      tile.id,
      s.hikers.map((h) => h.id),
    );
    expect(s.challenge?.cardId).toBeDefined();
    expect(s.challenge?.cardId).not.toBe('dog-waste-zone');
    expect(s.section.pool).toContain(s.challenge!.cardId);
  });

  it('the testing tool keeps the pool to minigames', () => {
    const s = game(5);
    for (const t of Object.values(s.section.tiles)) delete t.revealedCard;
    s.testing = { minigamesOnly: true };
    placePool(s);
    expect(poolCards(s).every((c) => !!c.minigame)).toBe(true);
  });

  it('switching Minigames only places the unreached tiles again, and switching back undoes it', () => {
    const s = game(5);
    const before = s.section.pool;
    const on = run(s, { type: 'debug', op: { kind: 'setMinigamesOnly', on: true } });
    expect(on.testing?.minigamesOnly).toBe(true);
    expect(poolCards(on).every((c) => !!c.minigame)).toBe(true);
    for (const t of placedTiles(on))
      expect(CARDS[t.revealedCard!.cardId]).toHaveProperty('minigame');
    const off = run(on, { type: 'debug', op: { kind: 'setMinigamesOnly', on: false } });
    expect(off.testing).toBeUndefined();
    expect(off.section.pool).toEqual(before);
  });
});
