import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { SCAVENGE_CARDS, SCAVENGE_CARD_ORDER, findableItems } from '../../content';
import { RESOURCES } from '../../content/resources';
import { seedRng } from '../rng';
import type { ScavengeCard, ScavengeCardType, TileNode } from '../types';
import { canDeal, dealCard, dealCards, type DealInput } from './deal';

/** A full Abundance bar. */
const FULL = BALANCE.abundance.max;
const node = (type: TileNode['type'], extra: Partial<TileNode> = {}): TileNode => ({
  type,
  revealed: true,
  ...extra,
});
const nodeOf = (id: string) => RESOURCES.find((r) => r.id === id)?.node;

function deal(input: Partial<DealInput>, n: number, seed = 7): ScavengeCard[] {
  const rng = seedRng(seed);
  const full: DealInput = { nodes: [node('forest')], abundance: FULL, luck: 0, count: 1, ...input };
  return Array.from({ length: n }, (_, i) => dealCard(rng, full, full.forceTypes?.[i]));
}

describe('dealing scavenge cards', () => {
  it('deals the asked number of cards, the same for the same seed', () => {
    const input: DealInput = {
      nodes: [node('forest'), node('river')],
      abundance: FULL,
      luck: 0,
      count: 4,
    };
    const a = dealCards(seedRng(99), input);
    expect(a).toHaveLength(4);
    expect(dealCards(seedRng(99), input)).toEqual(a);
  });

  it('gives node cards only the resources of their node', () => {
    for (const card of deal({ nodes: [node('river')] }, 2000)) {
      expect(card.node).toBe('river');
      const def = SCAVENGE_CARDS[card.type];
      if (def.backdrop === 'node' && card.type !== 'mixed') {
        for (const r of card.resources ?? []) expect(nodeOf(r)).toBe('river');
      }
      if (card.pick && card.type.startsWith('choice')) expect(card.pick.from).toBe('river');
    }
  });

  it('never deals Mixed on a tile with one kind of node', () => {
    const cards = deal({ nodes: [node('forest'), node('forest')], luck: 5 }, 5000);
    expect(cards.some((c) => c.type === 'mixed')).toBe(false);
  });

  it('deals Mixed from two different nodes', () => {
    const rng = seedRng(3);
    for (let i = 0; i < 300; i++) {
      const c = dealCard(
        rng,
        {
          nodes: [node('forest'), node('river'), node('mountain')],
          abundance: FULL,
          luck: 0,
          count: 1,
        },
        'mixed',
      );
      expect(c.type).toBe('mixed');
      expect(c.node2).toBeDefined();
      expect(c.node2).not.toBe(c.node);
      expect(c.resources?.map(nodeOf)).toEqual([c.node, c.node2]);
    }
  });

  it('picks nodes evenly whatever the Abundance (one bar, Nov 14 update)', () => {
    for (const abundance of [0, FULL]) {
      const river =
        deal({ nodes: [node('forest'), node('river')], abundance }, 4000).filter(
          (c) => c.node === 'river',
        ).length / 4000;
      expect(river).toBeGreaterThan(0.45);
      expect(river).toBeLessThan(0.55);
    }
  });

  it('counts a double node twice', () => {
    const cards = deal({ nodes: [node('forest'), node('forest'), node('river')] }, 6000);
    const forest = cards.filter((c) => c.node === 'forest').length / cards.length;
    expect(forest).toBeGreaterThan(0.62);
    expect(forest).toBeLessThan(0.71);
  });

  it('deals only caps when Cap nodes are all the tile has', () => {
    const cards = deal({ nodes: [node('caps')] }, 50);
    expect(cards.every((c) => c.type === 'caps' && c.node === null)).toBe(true);
  });

  it('makes caps likelier on a tile with a Cap node', () => {
    const caps = (nodes: TileNode[]) =>
      deal({ nodes }, 20000, 5).filter((c) => c.type === 'caps').length;
    // ×4 within Uncommon works out to about 2.5 times as many caps cards.
    expect(caps([node('forest'), node('caps')])).toBeGreaterThan(caps([node('forest')]) * 2);
  });

  it('makes multiples likelier from a Bounty node', () => {
    const multiples = (bounty: boolean) =>
      deal({ nodes: [node('forest', bounty ? { bounty: true } : {})] }, 20000, 11).filter(
        (c) => SCAVENGE_CARDS[c.type].multiple,
      ).length;
    // ×2 within each rarity works out to about 1.4 times as many.
    expect(multiples(true)).toBeGreaterThan(multiples(false) * 1.25);
  });

  it('marks cards from a Bounty node', () => {
    const [card] = deal({ nodes: [node('wildlife', { bounty: true })] }, 1);
    expect(card?.bounty).toBe(true);
  });

  it('can deal every card type', () => {
    const nodes = [node('forest'), node('river')];
    for (const type of SCAVENGE_CARD_ORDER) {
      const [card] = deal({ nodes, forceTypes: [type] }, 1);
      expect(card?.type).toBe(type);
      expect(card?.rarity).toBe(SCAVENGE_CARDS[type].rarity);
    }
  });

  it.each<[ScavengeCardType, (c: ScavengeCard) => boolean]>([
    ['x3', (c) => c.resources?.length === 3 && new Set(c.resources).size === 1],
    ['trio', (c) => c.resources?.length === 3 && new Set(c.resources).size === 3],
    ['wildX2', (c) => c.resources?.length === 2 && new Set(c.resources).size === 1],
    ['choiceX2', (c) => c.pick?.count === 1 && c.pick.each === 2],
    ['bundleOfTheWild', (c) => c.pick?.count === 3 && c.pick.from === 'all'],
    ['caps', (c) => (c.caps ?? 0) >= 1 && (c.caps ?? 0) <= 3],
    ['toolFind', (c) => c.items?.length === 1],
    [
      'choiceClothes',
      (c) => (c.items?.length ?? 0) === Math.min(5, findableItems('clothes').length),
    ],
  ])('fills %s cards correctly', (type, ok) => {
    const rng = seedRng(21);
    for (let i = 0; i < 100; i++) {
      const card = dealCard(
        rng,
        { nodes: [node('mountain')], abundance: FULL, luck: 0, count: 1 },
        type,
      );
      expect(ok(card)).toBe(true);
    }
  });

  it('steps a rarity down when nothing of that rarity can happen', () => {
    // At Luck +5 a Mythic roll is possible; on a one-node tile everything still lands on a real type.
    const cards = deal({ nodes: [node('forest')], luck: 5 }, 20000, 2);
    for (const c of cards) expect(SCAVENGE_CARDS[c.type].rarity).toBe(c.rarity);
  });

  it('says when a tile has nothing to give', () => {
    expect(canDeal({ nodes: [node('forest')] })).toBe(true);
    expect(canDeal({ nodes: [node('caps')] })).toBe(true);
    expect(canDeal({ nodes: [] })).toBe(false);
  });
});
