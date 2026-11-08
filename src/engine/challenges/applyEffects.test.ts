import { describe, expect, it } from 'vitest';
import { CARDS } from '../../content/challenges';
import { fixtureGame, hiker, place } from '../test/fixtures';
import type { CardRolls, GameState } from '../types';
import { applyEffects, backTile } from './applyEffects';
import type { Effect } from './types';

const ROLLS: CardRolls = {
  x: { n: 2, chance: 100 },
  y: { ash: { days: 3 } },
  includes: {},
  luck: 0,
};

function run(s: GameState, effects: Effect[], targets = ['ash'], tileId = 'L', rolls = ROLLS) {
  const card = CARDS['flies'];
  if (!card) throw new Error('no card');
  return applyEffects(
    s,
    { card, tileId, targets: targets.map((id) => hiker(s, id)), onTile: s.hikers, rolls },
    effects,
  );
}

/** Ash and Birch on L (Forest), with some resources. */
function setup(): GameState {
  const s = fixtureGame({ seed: 8 });
  place(s, 'ash', 'L');
  place(s, 'birch', 'L');
  hiker(s, 'ash').inventory.resources = { wood: 2, fish: 2 };
  hiker(s, 'birch').inventory.resources = { meat: 3 };
  return s;
}

describe('the effect engine', () => {
  it('adds conditions with rolled lengths, per hiker', () => {
    const s = setup();
    run(s, [{ op: 'condition', id: 'strained', duration: 'days', unit: 'days' }]);
    expect(hiker(s, 'ash').conditions).toMatchObject([
      { id: 'strained', remaining: 3, unit: 'days' },
    ]);
  });

  it('rolls a chance for each hiker', () => {
    let hits = 0;
    for (let seed = 0; seed < 400; seed++) {
      const s = fixtureGame({ seed });
      run(s, [{ op: 'injury', chance: 0.5 }], ['ash', 'birch']);
      hits += hiker(s, 'ash').injuries + hiker(s, 'birch').injuries;
    }
    expect(hits / 800).toBeGreaterThan(0.44);
    expect(hits / 800).toBeLessThan(0.56);
  });

  it('only applies a "(25%)" part when it was included', () => {
    const s = setup();
    run(s, [{ op: 'injury', onlyIf: 'blind' }]);
    expect(hiker(s, 'ash').injuries).toBe(0);
    run(s, [{ op: 'injury', onlyIf: 'blind' }], ['ash'], 'L', {
      ...ROLLS,
      includes: { blind: true },
    });
    expect(hiker(s, 'ash').injuries).toBe(1);
  });

  it('changes stats as losses or gains', () => {
    const s = setup();
    run(s, [{ op: 'stat', stat: 'morale', delta: 'n', lose: true }]);
    expect(hiker(s, 'ash').stats.morale).toBe(8);
    run(s, [{ op: 'stat', stat: 'morale', delta: 1 }]);
    expect(hiker(s, 'ash').stats.morale).toBe(9);
  });

  it('loses random resources across the party', () => {
    const s = setup();
    run(s, [{ op: 'loseResources', count: 3, from: 'party' }], ['ash', 'birch']);
    const left = (id: string) =>
      Object.values(hiker(s, id).inventory.resources).reduce<number>((a, b) => a + (b ?? 0), 0);
    expect(left('ash') + left('birch')).toBe(4);
    expect(s.log.some((e) => e.kind === 'lost')).toBe(true);
  });

  it('loses all of one set, picked at random (all Wood or all Fish)', () => {
    const s = setup();
    run(s, [{ op: 'loseAllOf', sets: [['wood'], ['fish']] }]);
    const r = hiker(s, 'ash').inventory.resources;
    expect(Object.keys(r)).toHaveLength(1);
  });

  it('drops Abundance by a random amount: 75% to drop 1, repeating', () => {
    let total = 0;
    for (let seed = 0; seed < 300; seed++) {
      const s = fixtureGame({ seed });
      s.abundance.forest = 10;
      run(s, [{ op: 'abundance', nodes: ['forest'], repeatChance: 0.75 }]);
      total += 10 - s.abundance.forest;
    }
    // Expected drops: 0.75 / 0.25 = 3 (capped at the meter).
    expect(total / 300).toBeGreaterThan(2.4);
    expect(total / 300).toBeLessThan(3.4);
  });

  it('changes lines, hides nodes and raises a tile’s tier', () => {
    const s = setup();
    run(s, [{ op: 'lines', kind: 'muddy', where: 'connected' }], ['ash'], 'M');
    expect(
      s.section.lines.filter((l) => l.a === 'M' || l.b === 'M').every((l) => l.kind === 'muddy'),
    ).toBe(true);

    run(s, [{ op: 'hideNodes', where: 'around' }], ['ash'], 'M');
    expect(s.section.tiles.R?.nodes.every((n) => !n.revealed)).toBe(true);
    expect(s.section.tiles.L?.nodes.every((n) => n.revealed)).toBe(true); // hikers there

    run(s, [{ op: 'raiseTier', where: 'unrevealedConnected' }], ['ash'], 'M');
    const raised = ['L', 'R', 'C', 'T'].filter((id) => s.section.tiles[id]?.tierBonus);
    expect(raised).toHaveLength(1);
  });

  it('moves a hiker back, and reports a new tile to trigger', () => {
    const s = setup();
    place(s, 'ash', 'M');
    // Behind M is only T (the trailhead, already landed on).
    expect(backTile(s, 'M')).toBe('T');
    const swept = run(s, [{ op: 'move', how: 'swept' }], ['ash'], 'M');
    const at = hiker(s, 'ash').tileId;
    expect(['T', 'L', 'R']).toContain(at);
    expect(hiker(s, 'ash').cameFrom).toBe('M');
    if (at !== 'T') expect(swept.entered).toEqual([{ tileId: at, hikerIds: ['ash'] }]);
  });

  it('never moves anyone onto the checkpoint', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = fixtureGame({ seed });
      place(s, 'ash', 'L');
      run(s, [{ op: 'move', how: 'swept' }]);
      expect(hiker(s, 'ash').tileId).not.toBe('C');
    }
  });

  it('takes uses off tools (gone at 0), and records food’s lost Appetite for eating', () => {
    const s = setup();
    hiker(s, 'ash').inventory.bag = [
      { uid: 'f', itemId: 'energyDrink' },
      { uid: 't', itemId: 'scanner', quality: 3, usesLeft: 3 },
      { uid: 'u', itemId: 'binoculars', quality: 3, usesLeft: 2 },
    ];
    run(s, [
      { op: 'foodAppetite', delta: -1 },
      { op: 'toolUses', delta: 2 },
    ]);
    expect(hiker(s, 'ash').inventory.bag).toEqual([
      { uid: 'f', itemId: 'energyDrink', appetiteMod: -1 },
      { uid: 't', itemId: 'scanner', quality: 3, usesLeft: 1 },
    ]);
    expect(s.log.some((e) => e.kind === 'itemGone' && e.itemId === 'binoculars')).toBe(true);
  });

  it('gives rewards: an item to someone with room, caps to the purse', () => {
    const s = setup();
    run(s, [
      { op: 'gainItem', itemType: 'tool' },
      { op: 'gainCaps', count: 2 },
    ]);
    expect(hiker(s, 'ash').inventory.bag).toHaveLength(1);
    expect(s.caps).toBe(2);
  });
});
