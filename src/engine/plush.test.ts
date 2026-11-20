import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { validateAction } from './applyAction';
import { moveAllCost, moveCost } from './costs';
import { makeItem } from './items/make';
import type { HikerSetup } from './newGame';
import { changeStat, statMax } from './stats';
import { END, fixtureGame, fixtureHiker, hiker, place, run, toNight } from './test/fixtures';
import { thresholdStates } from './thresholds';
import type { Action, Family, GameState } from './types';

const P = BALANCE.plush;

/** Ash is a Plush (with these traits); Birch, Cedar and Dot are Humans, on the trailhead. */
function withPlush(traits: string[] = []) {
  const hikers: HikerSetup[] = (['ash', 'birch', 'cedar', 'dot'] as const).map((id) =>
    id === 'ash' ? { ...fixtureHiker(id, traits), family: 'plush' } : fixtureHiker(id),
  );
  return fixtureGame({ hikers });
}
const ash = (s: GameState) => hiker(s, 'ash');
const stuffing = (s: GameState) => ash(s).stats.energy;
const setStuffing = (s: GameState, n: number) => {
  ash(s).stats.energy = n;
  ash(s).stats.appetite = n;
};
const move = (hikerId: string, toTileId: string): Action => ({ type: 'move', hikerId, toTileId });
const moveAll = (hikerId: string, toTileId: string, bring: string[]): Action => ({
  type: 'moveAll',
  hikerId,
  toTileId,
  bring,
});

describe('Stuffing', () => {
  it('starts full, at 12, in both Energy and Appetite', () => {
    const s = withPlush();
    expect(ash(s).stats.energy).toBe(P.stuffingMax);
    expect(ash(s).stats.appetite).toBe(P.stuffingMax);
    expect(statMax(s, ash(s), 'energy')).toBe(P.stuffingMax);
    expect(statMax(s, ash(s), 'appetite')).toBe(P.stuffingMax);
    expect(statMax(s, hiker(s, 'birch'), 'energy')).toBe(BALANCE.stats.max);
  });

  it('an Energy or an Appetite cost changes it once', () => {
    const s = withPlush();
    changeStat(s, ash(s), 'energy', -2, 'test');
    expect(ash(s).stats).toMatchObject({ energy: 10, appetite: 10 });
    changeStat(s, ash(s), 'appetite', -3, 'test');
    expect(ash(s).stats).toMatchObject({ energy: 7, appetite: 7 });
  });

  it('gains of either kind fill it: eating and sleeping', () => {
    let s = withPlush();
    setStuffing(s, 8);
    const food = makeItem(s, 'pelmeni', { quality: 3 });
    ash(s).inventory.bag.push(food);
    s = run(s, { type: 'eat', hikerId: 'ash', itemUid: food.uid });
    expect(ash(s).stats.energy).toBe(ash(s).stats.appetite);
    expect(stuffing(s)).toBeGreaterThan(8);
    const fed = stuffing(s);
    s = run(toNight(s), { type: 'sleep', hikerId: 'ash' });
    expect(stuffing(s)).toBeGreaterThan(fed);
    expect(ash(s).stats.energy).toBe(ash(s).stats.appetite);
  });

  it('a move that costs both kinds takes both', () => {
    // T–M is steep: 1 Appetite to cross and 1 Energy extra, plus 1 Appetite to bring Birch.
    const s = run(withPlush(), moveAll('ash', 'M', ['birch']));
    const cost = moveAllCost(withPlush(), 'ash', 'M', ['birch'])![0]!.cost;
    expect(stuffing(s)).toBe(P.stuffingMax - cost.appetite - cost.energy);
    expect(ash(s).stats.appetite).toBe(stuffing(s));
  });
});

describe('Plush limits', () => {
  it('replace the four thresholds', () => {
    const s = withPlush();
    setStuffing(s, P.low);
    expect(thresholdStates(ash(s))).toEqual(['lowStuffing']);
    setStuffing(s, P.veryLow);
    expect(thresholdStates(ash(s))).toEqual(['lowStuffing', 'veryLowStuffing']);
    setStuffing(s, P.low + 1);
    expect(thresholdStates(ash(s))).toEqual([]);
  });

  it(`at ${P.low} or less: can’t move the group, and only sleeps at night`, () => {
    let s = withPlush();
    setStuffing(s, P.low);
    expect(validateAction(s, moveAll('ash', 'L', ['birch']))).toMatch(/Low Stuffing/);
    place(s, 'ash', 'L');
    expect(validateAction(s, { type: 'scavenge', hikerId: 'ash' })).toBeNull();
    s = toNight(s);
    setStuffing(s, P.low);
    expect(validateAction(s, { type: 'keepWatch', hikerId: 'ash' })).toMatch(/Low Stuffing/);
    expect(validateAction(s, { type: 'sleep', hikerId: 'ash' })).toBeNull();
  });

  it(`at ${P.veryLow} or less: can only sleep`, () => {
    const s = withPlush();
    setStuffing(s, P.veryLow);
    place(s, 'ash', 'L');
    expect(validateAction(s, { type: 'scavenge', hikerId: 'ash' })).toMatch(/Very low Stuffing/);
    // Others can still bring them along.
    place(s, 'birch', 'L');
    expect(validateAction(s, moveAll('birch', 'M', ['ash']))).toBeNull();
  });

  it('at 0: an injury, and Stuffing comes back up in both stats', () => {
    const s = withPlush();
    setStuffing(s, 1);
    changeStat(s, ash(s), 'energy', -1, 'test');
    expect(ash(s).injuries).toBe(1);
    expect(ash(s).stats.energy).toBe(BALANCE.injuries.raiseStatsBelowTo);
    expect(ash(s).stats.appetite).toBe(BALANCE.injuries.raiseStatsBelowTo);
  });
});

describe('Carried', () => {
  it('a Plush can’t move alone', () => {
    const s = withPlush();
    expect(validateAction(s, move('ash', 'L'))).toMatch(/can’t move alone/);
  });

  it('being brought along costs nothing extra and keeps their action', () => {
    const s = withPlush();
    const leader = (bring: string[]) => moveAllCost(s, 'birch', 'L', bring)![0]!.cost.appetite;
    expect(leader(['ash'])).toBe(leader(['cedar']) - BALANCE.moveAll.perHikerAppetite);
    const after = run(s, moveAll('birch', 'L', ['ash']));
    expect(ash(after).tileId).toBe('L');
    expect(ash(after).acted).toBe(false);
    expect(stuffing(after)).toBe(P.stuffingMax);
  });

  it('can lead the group with Stuffing to spare', () => {
    const s = run(withPlush(), moveAll('ash', 'L', ['birch']));
    expect(ash(s).tileId).toBe('L');
    expect(hiker(s, 'birch').tileId).toBe('L');
  });

  it('Shifty: moves alone, but only with no one else on the tile', () => {
    const s = withPlush(['shifty']);
    expect(validateAction(s, move('ash', 'L'))).toMatch(/can’t move alone/);
    for (const id of ['birch', 'cedar', 'dot']) place(s, id, 'R');
    expect(validateAction(s, move('ash', 'L'))).toBeNull();
    // Once per phase it doesn't use the action; it still costs the usual.
    const after = run(s, move('ash', 'L'));
    expect(ash(after).acted).toBe(false);
    expect(stuffing(after)).toBe(P.stuffingMax - moveCost(s, 'ash', 'L')!.appetite);
  });

  it('Night Shifty: once per night, moves to an adjacent tile for free', () => {
    let s = toNight(withPlush(['nightShifty']));
    expect(validateAction(withPlush(['nightShifty']), move('ash', 'L'))).toMatch(
      /can’t move alone/,
    );
    expect(validateAction(s, move('ash', 'L'))).toBeNull();
    s = run(s, move('ash', 'L'));
    expect(ash(s).tileId).toBe('L');
    expect(stuffing(s)).toBe(P.stuffingMax);
    expect(ash(s).acted).toBe(false);
    expect(validateAction(s, move('ash', 'M'))).toMatch(/can’t move alone/);
    // The next night it works again.
    s = toNight(run(s, END));
    expect(validateAction(s, move('ash', 'M'))).toBeNull();
  });
});

describe('not a real Dog or Cat', () => {
  it('a Dog Lover with only a Plush on the tile still misses a Dog', () => {
    const morningAfter = (family: Family) => {
      const hikers: HikerSetup[] = [
        { ...fixtureHiker('ash'), family },
        fixtureHiker('birch', ['dogLover']),
      ];
      const s = fixtureGame({ hikers });
      hiker(s, 'birch').stats.morale = 5;
      return hiker(run(toNight(s), END), 'birch').stats.morale;
    };
    expect(morningAfter('plush')).toBe(morningAfter('dog') - 2 * BALANCE.traits.morale);
  });
});
