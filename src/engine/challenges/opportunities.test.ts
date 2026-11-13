import { describe, expect, it } from 'vitest';
import { OPPORTUNITIES } from '../../content/challenges';
import { isSheltered } from '../actions/sleep';
import { validateAction } from '../applyAction';
import { addCondition } from '../conditions';
import { scavengeSetup } from '../scavenge/setup';
import { END, fixtureGame, hiker, place, run } from '../test/fixtures';
import type { Action, ChallengeSection, GameState, Gift } from '../types';
import { notPlayableYet } from './pick';

/** Ash and Birch on L (Forest), with an opportunity of our choosing open there. */
function opened(cardId: string, setup: (s: GameState) => void = () => {}, seed = 6): GameState {
  const s = fixtureGame({ seed, challenges: true });
  place(s, 'ash', 'L');
  place(s, 'birch', 'L');
  setup(s);
  const open = run(s, { type: 'debug', op: { kind: 'openChallenge', cardId, tileId: 'L' } });
  expect(open.challenge?.cardId).toBe(cardId);
  return open;
}
const resolve = (...sections: ChallengeSection[]): Action => ({
  type: 'resolveChallenge',
  sections,
});
const pick = (ash: boolean, birch: boolean, extra: { cedar?: boolean; dot?: boolean } = {}) =>
  resolve(
    { hikerId: 'ash', pay: ash, gifts: [] },
    { hikerId: 'birch', pay: birch, gifts: [] },
    ...('cedar' in extra ? [{ hikerId: 'cedar', pay: !!extra.cedar, gifts: [] }] : []),
    ...('dot' in extra ? [{ hikerId: 'dot', pay: !!extra.dot, gifts: [] }] : []),
  );
const stat = (from: string, s: 'energy' | 'appetite' | 'morale', count: number): Gift => ({
  kind: 'stat',
  req: 0,
  from,
  stat: s,
  count,
});
const press = (button: string, hikerId?: string, choice?: string): Action => ({
  type: 'pressButton',
  button,
  ...(hikerId ? { hikerId } : {}),
  ...(choice !== undefined ? { choice } : {}),
});
const DONE = (n: number) =>
  resolve(...Array.from({ length: n }, () => ({ pay: true, gifts: [] as Gift[] })));

describe('the 17 opportunities', () => {
  it('are all there, with art, and every one can be played now', () => {
    expect(OPPORTUNITIES).toHaveLength(17);
    expect(OPPORTUNITIES.every((o) => o.art && !o.placeholder)).toBe(true);
    expect(OPPORTUNITIES.filter((o) => notPlayableYet(o))).toEqual([]);
  });
});

describe('Select opportunities', () => {
  it('only ticked hikers take part (Nap Time)', () => {
    const s = opened('nap-time', (g) => {
      hiker(g, 'ash').stats.energy = 5;
      hiker(g, 'birch').stats.energy = 5;
    });
    const after = run(s, pick(true, false));
    expect(hiker(after, 'ash').stats.energy).toBe(7);
    expect(hiker(after, 'ash').conditions.map((c) => c.id)).toContain('napping');
    expect(hiker(after, 'birch').stats.energy).toBe(5);
    // Napping: can't move next phase.
    const next = run(after, END);
    expect(validateAction(next, { type: 'move', hikerId: 'ash', toTileId: 'T' })).toMatch(
      /Napping/,
    );
  });

  it('Airlift reaches hikers on any tile, and flies them back to the start', () => {
    const s = opened('airlift', (g) => {
      place(g, 'cedar', 'M');
      hiker(g, 'cedar').injuries = 2;
      hiker(g, 'cedar').stats.appetite = 3;
      addCondition(g, hiker(g, 'cedar'), 'strained', 2, 'days', 'test');
    });
    const after = run(s, pick(false, false, { cedar: true, dot: false }));
    const cedar = hiker(after, 'cedar');
    expect(cedar.tileId).toBe('T');
    expect(cedar.injuries).toBe(1);
    expect(cedar.conditions).toEqual([]);
    expect(cedar.stats.appetite).toBe(10);
    // The cures are logged, so the results panel can say so.
    expect(after.log).toContainEqual(
      expect.objectContaining({ kind: 'healed', hikerId: 'cedar', healed: 1, injuries: 1 }),
    );
    expect(after.log).toContainEqual(
      expect.objectContaining({ kind: 'conditionEnded', hikerId: 'cedar', condition: 'strained' }),
    );
  });

  it('can’t pick a Frozen hiker for a card that moves them', () => {
    const s = opened('airlift', (g) =>
      addCondition(g, hiker(g, 'ash'), 'frozen', 2, 'phases', 'x'),
    );
    expect(validateAction(s, pick(true, false, { cedar: false, dot: false }))).toBe(
      'Ash can’t be moved right now.',
    );
  });

  it('Secret Tunnel moves the picked hikers together, and that tile’s card opens', () => {
    // Everyone starts on the trailhead (row 0): the next row up is L, M or R.
    const s = run(fixtureGame({ seed: 6, challenges: true }), {
      type: 'debug',
      op: { kind: 'openChallenge', cardId: 'secret-tunnel', tileId: 'T' },
    });
    const after = run(s, pick(true, true, { cedar: false, dot: false }));
    const at = hiker(after, 'ash').tileId;
    expect(['L', 'M', 'R']).toContain(at);
    expect(hiker(after, 'birch').tileId).toBe(at);
    expect(hiker(after, 'cedar').tileId).toBe('T');
    expect(after.log.some((e) => e.kind === 'moved' && e.how === 'tunnel')).toBe(true);
    // The tunnel's tile was new, so its card opens next.
    expect(after.challenge?.tileId).toBe(at);
  });

  it('Raccoon Friend: exactly one hiker, who spends a food card', () => {
    const s = opened('raccoon-friend', (g) => {
      hiker(g, 'ash').inventory.bag = [{ uid: 'f1', itemId: 'energyDrink' }];
    });
    const food: Gift = { kind: 'item', req: 0, from: 'ash', uid: 'f1' };
    expect(
      validateAction(
        s,
        resolve(
          { hikerId: 'ash', pay: true, option: 0, gifts: [food] },
          { hikerId: 'birch', pay: true, option: 0, gifts: [] },
        ),
      ),
    ).toBe('Only one hiker can take this.');
    const after = run(
      s,
      resolve(
        { hikerId: 'ash', pay: true, option: 0, gifts: [food] },
        { hikerId: 'birch', pay: false, gifts: [] },
      ),
    );
    expect(hiker(after, 'ash').inventory.bag).toEqual([]);
    const friend = hiker(after, 'ash').conditions.find((c) => c.id === 'raccoonFriend');
    expect(friend).toMatchObject({ unit: 'nights' });
  });
});

describe('spend-any-amount opportunities', () => {
  it('Citro Tub: ending at 6 Energy or less gets a Citro Drink, 3 or less also Energized', () => {
    const s = opened('citro-tub');
    const after = run(
      s,
      resolve(
        { hikerId: 'ash', pay: true, gifts: [stat('ash', 'energy', 4)] },
        { hikerId: 'birch', pay: true, gifts: [stat('birch', 'energy', 7)] },
      ),
    );
    expect(hiker(after, 'ash').inventory.bag.map((i) => i.itemId)).toEqual(['citroDrink']);
    expect(hiker(after, 'ash').conditions).toEqual([]);
    expect(hiker(after, 'birch').inventory.bag.map((i) => i.itemId)).toEqual(['citroDrink']);
    expect(hiker(after, 'birch').conditions.map((c) => c.id)).toEqual(['energized']);
  });

  it('only takes what the card asks for, up to its limit', () => {
    const s = opened('hungry-animals', (g) => {
      hiker(g, 'ash').inventory.bag = ['a', 'b', 'c', 'd'].map((uid) => ({
        uid,
        itemId: 'energyDrink',
      }));
    });
    const food = (uid: string): Gift => ({ kind: 'item', req: 0, from: 'ash', uid });
    expect(validateAction(s, resolve({ pay: true, gifts: ['a', 'b', 'c', 'd'].map(food) }))).toBe(
      'At most 3.',
    );
    const after = run(s, resolve({ pay: true, gifts: ['a', 'b'].map(food) }));
    expect(after.section.tiles.L?.luckBonus?.amount).toBe(4);
    // Scavenging here gets the Luck until morning.
    const setup = scavengeSetup(after, hiker(after, 'ash'));
    expect(setup.bonuses.some((b) => /\+4 Luck/.test(b.label))).toBe(true);
    const morning = run(after, END, END, END);
    expect(
      scavengeSetup(morning, hiker(morning, 'ash')).bonuses.some((b) =>
        /Luck scavenging/.test(b.label),
      ),
    ).toBe(false);
  });

  it('Hikers Exchange swaps each resource for a random one', () => {
    const s = opened('hikers-exchange', (g) => {
      hiker(g, 'ash').inventory.resources = { wood: 3 };
    });
    const after = run(
      s,
      resolve({
        pay: true,
        gifts: [{ kind: 'resource', req: 0, from: 'ash', resource: 'wood', count: 3 }],
      }),
    );
    const left = Object.values(hiker(after, 'ash').inventory.resources).reduce<number>(
      (a, b) => a + (b ?? 0),
      0,
    );
    expect(left).toBe(3);
  });
});

describe('button opportunities', () => {
  it('Snake Salesman: up to 5 buys, each at a rolled price; a short purse costs nothing', () => {
    let s = opened('snake-salesman', (g) => {
      g.caps = 40;
    });
    for (let i = 0; i < 5; i++) s = run(s, press('buy'));
    expect(validateAction(s, press('buy'))).toBe('No presses left.');
    expect(s.caps).toBeLessThan(40);
    const poor = opened('snake-salesman', (g) => {
      g.caps = 0;
    });
    const after = run(poor, press('buy'));
    const note = after.log.at(-1);
    if (note?.kind === 'pressed' && /couldn’t/.test(note.note)) expect(after.caps).toBe(0);
    expect(run(after, DONE(1)).challenge).toBeUndefined();
  });

  it('Snake Slots: pay a stat per pull, 5 pulls per hiker, and Morale 0 can’t pay Morale', () => {
    let s = opened('snake-slots', (g) => {
      hiker(g, 'birch').stats.morale = 0;
    });
    s = run(s, press('pull', 'ash', '0'));
    expect(hiker(s, 'ash').stats.energy).toBe(8);
    for (let i = 0; i < 4; i++) s = run(s, press('pull', 'ash', '1'));
    expect(validateAction(s, press('pull', 'ash', '1'))).toBe('No presses left.');
    expect(validateAction(s, press('pull', 'birch', '2'))).toMatch(/^Morale 0/);
    expect(validateAction(s, press('pull', 'birch', '0'))).toBeNull();
    expect(s.log.filter((e) => e.kind === 'pressed')).toHaveLength(5);
  });

  it('Predator Bait: one tile easier, another harder, up to 3 times', () => {
    // Biome 1 tiles start at Tier I: with none raised, nothing can get easier.
    const flat = opened('predator-bait');
    expect(validateAction(flat, press('bait'))).toBe(
      'Every unknown tile is already Tier I, so none can get easier.',
    );

    let s = opened('predator-bait', (g) => {
      for (const id of ['L', 'M', 'R']) g.section.tiles[id]!.tierBonus = 1;
    });
    s = run(s, press('bait'));
    const e = s.log.at(-1);
    expect(e).toMatchObject({ kind: 'pressed' });
    if (e?.kind !== 'pressed') throw new Error('no press');
    expect(e.harder).not.toBe(e.easier);
    expect(s.section.tiles[e.easier!]?.tierBonus).toBe(0);
    expect(s.section.tiles[e.harder!]?.tierBonus).toBe(2);
    s = run(s, press('bait'), press('bait'));
    expect(validateAction(s, press('bait'))).toBe('No presses left.');
    // Never below Tier I.
    expect(Object.values(s.section.tiles).every((t) => (t.tierBonus ?? 0) >= 0)).toBe(true);
  });

  it('Predator’s Den: +1 Appetite, and each unknown tile gets harder only once', () => {
    let s = opened('predators-den', (g) => {
      hiker(g, 'ash').stats.appetite = 5;
    });
    s = run(s, press('den', 'ash'), press('den', 'ash'));
    expect(hiker(s, 'ash').stats.appetite).toBe(7);
    expect(Object.values(s.section.tiles).filter((t) => t.denRaised)).toHaveLength(2);
    // L, M and R are the fixture's unknown tiles: a third press uses the last one.
    s = run(s, press('den', 'birch'));
    expect(Object.values(s.section.tiles).filter((t) => t.denRaised)).toHaveLength(3);
    expect(validateAction(s, press('den', 'birch'))).toBe(
      'Every unknown tile has already been made harder.',
    );
  });

  it('Old Firewatch Tower reveals a connected tile’s card, which opens when someone lands there', () => {
    let s = opened('old-firewatch-tower');
    expect(validateAction(s, press('climb', 'ash', 'C'))).toMatch(/connected tile/);
    s = run(s, press('climb', 'ash', 'M'));
    const shown = s.section.tiles.M?.revealedCard;
    expect(shown).toBeDefined();
    expect(s.log.some((e) => e.kind === 'revealedCard' && e.tileId === 'M')).toBe(true);
    s = run(s, pick(true, true));
    s = run(s, { type: 'move', hikerId: 'birch', toTileId: 'M' });
    expect(s.challenge?.cardId).toBe(shown?.cardId);
    expect(s.section.tiles.M?.revealedCard).toBeUndefined();
  });
});

describe('other opportunity effects', () => {
  it('Ruins builds a shelter here, and it counts', () => {
    const s = opened('ruins', (g) => {
      hiker(g, 'ash').inventory.resources = { wood: 4, stone: 2 };
    });
    expect(isSheltered(s, hiker(s, 'ash'))).toBe(false);
    const after = run(
      s,
      resolve({
        pay: true,
        option: 0,
        gifts: [
          { kind: 'resource', req: 0, from: 'ash', resource: 'wood', count: 4 },
          { kind: 'resource', req: 0, from: 'ash', resource: 'stone', count: 2 },
        ],
      }),
    );
    expect(after.section.tiles.L?.shelters).toHaveLength(1);
    expect(isSheltered(after, hiker(after, 'ash'))).toBe(true);
    expect(after.counters.sheltersPlaced[0]).toBe(1);
  });
});

describe('run counters', () => {
  it('count challenges passed and failed per hiker', () => {
    const s = opened('steep-trail');
    const after = run(
      s,
      resolve(
        { hikerId: 'ash', pay: true, option: 0, gifts: [stat('ash', 'energy', 2)] },
        { hikerId: 'birch', pay: false, gifts: [] },
      ),
    );
    expect(after.counters.passed).toEqual({ ash: 1 });
    expect(after.counters.failed).toEqual({ birch: 1 });
  });

  it('count nights without sleep, and start over after sleeping', () => {
    let s = fixtureGame();
    s = run(s, END, END, END); // Day 2: nobody slept
    expect(s.counters.daysSinceSleep.ash).toBe(1);
    s = run(s, END, END, { type: 'sleep', hikerId: 'ash' }, END);
    expect(s.counters.daysSinceSleep).toMatchObject({ ash: 0, birch: 2 });
  });
});
