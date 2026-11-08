import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { validateAction } from './applyAction';
import { immovable } from './challenges/applyEffects';
import { addCondition, addStacks, endWeatherConditions, removeCondition } from './conditions';
import { moveCost, moveAllCost } from './costs';
import { effectSourcesFor } from './effects';
import { bagSlots } from './inventory';
import { seedRng } from './rng';
import { scavengeSetup } from './scavenge/setup';
import { changeStat, statMax } from './stats';
import { tendCost } from './actions/tend';
import { overBag } from './actions/give';
import { END, fixtureGame, fixtureHiker, hiker, place, run, toNight } from './test/fixtures';
import type { GameState } from './types';

const ash = (s: GameState) => hiker(s, 'ash');

describe('stat changes while a condition lasts (given back when it ends)', () => {
  it('Sleepy: −2 Energy now, +2 when it ends', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy: 8 });
    addCondition(s, ash(s), 'sleepy', 1, 'days', 'test');
    expect(ash(s).stats.energy).toBe(6);
    removeCondition(s, ash(s), 'sleepy');
    expect(ash(s).stats.energy).toBe(8);
  });

  it('gives back only what Sleepy itself took, not Strained’s extra', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy: 8 });
    addCondition(s, ash(s), 'strained', 2, 'days', 'test');
    addCondition(s, ash(s), 'sleepy', 1, 'days', 'test');
    expect(ash(s).stats.energy).toBe(5);
    removeCondition(s, ash(s), 'sleepy');
    expect(ash(s).stats.energy).toBe(7);
  });

  it('ends at camp with the rest, giving the Energy back', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy: 8 });
    addCondition(s, ash(s), 'nauseous', 1, 'days', 'test');
    expect(ash(s).stats.appetite).toBe(8);
    const next = run(toNight(s), END);
    expect(ash(next).conditions.some((c) => c.id === 'nauseous')).toBe(false);
    // Back +2, less the end-of-day Appetite.
    expect(ash(next).stats.appetite).toBe(10 - BALANCE.endOfDay.appetite);
  });

  it('Energized can push past 10, and takes its +1 back when it ends, never below 0', () => {
    const s = fixtureGame();
    addCondition(s, ash(s), 'energized', 1, 'days', 'test');
    expect(ash(s).stats.energy).toBe(11);
    changeStat(s, ash(s), 'energy', -10, 'test');
    expect(ash(s).stats.energy).toBe(1);
    removeCondition(s, ash(s), 'energized');
    expect(ash(s).stats.energy).toBe(0);
    // Taking it back isn't an injury.
    expect(ash(s).injuries).toBe(0);
  });

  it('Sated +1 Appetite, Bored −2 Morale', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 6, morale: 6 });
    addCondition(s, ash(s), 'sated', 1, 'days', 'test');
    addCondition(s, ash(s), 'bored', 1, 'days', 'test');
    expect(ash(s).stats).toMatchObject({ appetite: 7, morale: 4 });
  });
});

describe('caps', () => {
  it('Dejected holds Morale at 5, and nothing comes back when it ends', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { morale: 8 });
    addCondition(s, ash(s), 'dejected', 1, 'days', 'test');
    expect(ash(s).stats.morale).toBe(5);
    expect(statMax(s, ash(s), 'morale')).toBe(5);
    changeStat(s, ash(s), 'morale', 3, 'test');
    expect(ash(s).stats.morale).toBe(5);
    removeCondition(s, ash(s), 'dejected');
    expect(ash(s).stats.morale).toBe(5);
    changeStat(s, ash(s), 'morale', 3, 'test');
    expect(ash(s).stats.morale).toBe(8);
  });

  it('Inappetent (Appetite 7) and Buzzed (Energy 7)', () => {
    const s = fixtureGame();
    addCondition(s, ash(s), 'inappetent', 1, 'days', 'test');
    addCondition(s, ash(s), 'buzzed', 1, 'days', 'test');
    expect(ash(s).stats).toMatchObject({ appetite: 7, energy: 7 });
  });

  it('Hangry: maximum Morale falls with Appetite', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 7, morale: 10 });
    addCondition(s, ash(s), 'hangry', 1, 'days', 'test');
    expect(ash(s).stats.morale).toBe(7);
    changeStat(s, ash(s), 'appetite', -1, 'test');
    expect(ash(s).stats.morale).toBe(6);
  });
});

describe('stacking conditions', () => {
  it('Burning: −1 maximum Energy a stack; at 5, an injury and back to 0', () => {
    const s = fixtureGame();
    addStacks(s, ash(s), 'burning', 2, 'test');
    expect(statMax(s, ash(s), 'energy')).toBe(8);
    expect(ash(s).stats.energy).toBe(8);
    addStacks(s, ash(s), 'burning', 3, 'test');
    expect(ash(s).injuries).toBe(1);
    expect(ash(s).conditions.some((c) => c.id === 'burning')).toBe(false);
  });

  it('Burning cools by 1 in a Night phase with no new Burning', () => {
    const night = toNight(fixtureGame());
    addStacks(night, ash(night), 'burning', 2, 'heat');
    // Gained this night: no cooling yet.
    const morning = run(night, END);
    expect(ash(morning).conditions.find((c) => c.id === 'burning')?.stacks).toBe(2);
    const nextNight = toNight(morning);
    const after = run(nextNight, END);
    expect(ash(after).conditions.find((c) => c.id === 'burning')?.stacks).toBe(1);
  });

  it('Shivering: Frozen at 3, an injury at 5, and gone when the weather ends', () => {
    const s = fixtureGame();
    addStacks(s, ash(s), 'shivering', 3, 'cold');
    expect(immovable(ash(s))).toBe(true);
    expect(validateAction(s, { type: 'move', hikerId: 'ash', toTileId: 'L' })).toMatch(
      /^Shivering ×3: Frozen/,
    );
    addStacks(s, ash(s), 'shivering', -1, 'company');
    expect(immovable(ash(s))).toBe(false);
    addStacks(s, ash(s), 'shivering', 3, 'cold');
    expect(ash(s).injuries).toBe(1);
    expect(ash(s).conditions).toEqual([]);
    addStacks(s, ash(s), 'shivering', 2, 'cold');
    endWeatherConditions(s);
    expect(ash(s).conditions).toEqual([]);
  });

  it('never goes below 0, and doesn’t tick down like timed conditions', () => {
    const s = fixtureGame();
    addStacks(s, ash(s), 'shivering', 1, 'cold');
    addStacks(s, ash(s), 'shivering', -4, 'warmth');
    expect(ash(s).conditions).toEqual([]);
    addStacks(s, ash(s), 'shivering', 2, 'cold');
    const later = run(toNight(s), END, END);
    expect(ash(later).conditions.find((c) => c.id === 'shivering')?.stacks).toBe(2);
  });
});

describe('losses and gains', () => {
  it('Strained loses 1 extra Energy; Inspired gains 1 extra Morale', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy: 8, morale: 5 });
    addCondition(s, ash(s), 'strained', 1, 'days', 'test');
    addCondition(s, ash(s), 'inspired', 1, 'days', 'test');
    changeStat(s, ash(s), 'energy', -1, 'test');
    changeStat(s, ash(s), 'morale', 1, 'test');
    expect(ash(s).stats).toMatchObject({ energy: 6, morale: 7 });
  });

  it('Refreshed and Full: no loss at all, costs included (Wyatt, Nov 6)', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    addCondition(s, ash(s), 'refreshed', 1, 'days', 'test');
    addCondition(s, ash(s), 'full', 1, 'days', 'test');
    expect(tendCost(s, ash(s))).toBe(0);
    expect(moveCost(s, 'ash', 'M')?.appetite).toBe(0);
    changeStat(s, ash(s), 'energy', -3, 'a challenge');
    changeStat(s, ash(s), 'appetite', -3, 'a challenge');
    expect(ash(s).stats).toMatchObject({ energy: 10, appetite: 10 });
    const next = run(toNight(s), END);
    expect(ash(next).stats.appetite).toBe(10);
  });

  it('Sluggish: moving costs 1 more Appetite, and being brought costs the mover 1 more', () => {
    const s = fixtureGame();
    const base = moveCost(s, 'ash', 'L')?.appetite ?? 0;
    const group = moveAllCost(s, 'birch', 'L', ['ash'])?.[0]?.cost.appetite ?? 0;
    addCondition(s, ash(s), 'sluggish', 1, 'days', 'test');
    expect(moveCost(s, 'ash', 'L')?.appetite).toBe(base + 1);
    expect(moveAllCost(s, 'birch', 'L', ['ash'])?.[0]?.cost.appetite).toBe(group + 1);
  });
});

describe('what a hiker can do', () => {
  it('Nightmares stops sleeping; Blind stops moving alone but not being brought', () => {
    const s = toNight(fixtureGame());
    addCondition(s, ash(s), 'nightmares', 1, 'days', 'test');
    expect(validateAction(s, { type: 'sleep', hikerId: 'ash' })).toBe('Nightmares: can’t sleep.');
    const day = fixtureGame();
    addCondition(day, ash(day), 'blind', 1, 'days', 'test');
    expect(validateAction(day, { type: 'move', hikerId: 'ash', toTileId: 'L' })).toMatch(/^Blind/);
    expect(
      validateAction(day, { type: 'moveAll', hikerId: 'birch', toTileId: 'L', bring: ['ash'] }),
    ).toBeNull();
  });

  it('Motivated: the next action is free, then it ends', () => {
    const s = fixtureGame();
    addCondition(s, ash(s), 'motivated', 1, 'days', 'test');
    const moved = run(s, { type: 'move', hikerId: 'ash', toTileId: 'L' });
    expect(ash(moved).acted).toBe(false);
    expect(ash(moved).conditions.some((c) => c.id === 'motivated')).toBe(false);
    expect(moved.log.some((e) => e.kind === 'freeAction')).toBe(true);
    const again = run(moved, { type: 'move', hikerId: 'ash', toTileId: 'M' });
    expect(ash(again).acted).toBe(true);
  });

  it('Brain Fog turns off Utility traits', () => {
    const s = fixtureGame({ hikers: [fixtureHiker('ash', ['forager', 'leader'])] });
    const names = () => effectSourcesFor(s, ash(s)).map((x) => x.name);
    expect(names()).toContain('Forager');
    addCondition(s, ash(s), 'brainFog', 1, 'days', 'test');
    expect(names()).not.toContain('Forager');
    expect(names()).toContain('Leader');
  });

  it('Weak: one fewer bag slot; an item that no longer fits can be dropped', () => {
    const s = fixtureGame();
    const slots = bagSlots(s, ash(s)).total;
    ash(s).inventory.bag = Array.from({ length: slots }, (_, i) => ({
      uid: `i${i}`,
      itemId: 'bandaid',
    }));
    addCondition(s, ash(s), 'weak', 1, 'days', 'test');
    expect(bagSlots(s, ash(s)).total).toBe(slots - 1);
    expect(overBag(s, ash(s))).toBe(1);
    const dropped = run(s, { type: 'dropItem', hikerId: 'ash', itemUid: 'i0' });
    expect(overBag(dropped, ash(dropped))).toBe(0);
    expect(dropped.log.at(-1)).toMatchObject({
      kind: 'lost',
      items: ['bandaid'],
      cause: 'dropped',
    });
  });
});

describe('each phase and each day', () => {
  it('Allergies: −1 Morale each phase on a tile with that node', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    place(s, 'birch', 'T');
    addCondition(s, ash(s), 'allergies', 2, 'days', 'test', { node: 'forest' });
    addCondition(s, hiker(s, 'birch'), 'allergies', 2, 'days', 'test', { node: 'forest' });
    const after = run(s, END);
    expect(ash(after).stats.morale).toBe(9);
    expect(hiker(after, 'birch').stats.morale).toBe(10);
  });

  it('Soaked: −1 Morale each phase without clothes or a shelter; Wet once a day', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    place(s, 'birch', 'R'); // the campsite: sheltered
    addCondition(s, ash(s), 'soaked', 5, 'phases', 'test');
    addCondition(s, hiker(s, 'birch'), 'soaked', 5, 'phases', 'test');
    const after = run(s, END);
    expect(ash(after).stats.morale).toBe(9);
    expect(hiker(after, 'birch').stats.morale).toBe(10);

    const wet = fixtureGame();
    place(wet, 'ash', 'L');
    addCondition(wet, ash(wet), 'wet', 2, 'days', 'test');
    const next = run(toNight(wet), END);
    expect(ash(next).stats.morale).toBe(9);
  });

  it('Ringing Ears: about 75% of day phases cost 1 Morale', () => {
    let lost = 0;
    const tries = 400;
    for (let seed = 1; seed <= tries; seed++) {
      const s = fixtureGame({ seed });
      s.rng = seedRng(seed);
      addCondition(s, ash(s), 'ringingEars', 3, 'days', 'test');
      if (ash(run(s, END)).stats.morale < 10) lost += 1;
    }
    expect(Math.abs(lost / tries - BALANCE.conditions.ringingEars.dayMorale)).toBeLessThan(0.07);
  });
});

describe('scavenging', () => {
  it('Lucky, Unlucky and Tunnel Vision change the deal', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    const base = scavengeSetup(s, ash(s));
    addCondition(s, ash(s), 'lucky', 1, 'days', 'test');
    expect(scavengeSetup(s, ash(s)).luck).toBe(base.luck + 1);
    addCondition(s, ash(s), 'unlucky', 1, 'days', 'test');
    addCondition(s, ash(s), 'tunnelVision', 1, 'days', 'test');
    const after = scavengeSetup(s, ash(s));
    expect(after.luck).toBe(base.luck);
    expect(after.count).toBe(base.count - 1);
  });

  it('Butterfingers: a chance the card slips away, and the scavenge still costs Appetite', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    addCondition(s, ash(s), 'butterfingers', 1, 'days', 'test');
    expect(scavengeSetup(s, ash(s)).dropChance).toBe(BALANCE.chance.default);
    const open = run(s, { type: 'scavenge', hikerId: 'ash' });
    open.scavenge!.dropChance = 1;
    const appetite = ash(open).stats.appetite;
    const after = run(
      open,
      { type: 'scavengeFlip', cards: [0] },
      { type: 'scavengeTake', card: 0 },
    );
    expect(after.log.find((e) => e.kind === 'scavenge')).toMatchObject({
      dropped: true,
      resources: [],
    });
    expect(ash(after).inventory.resources).toEqual({});
    expect(ash(after).stats.appetite).toBeLessThan(appetite);
  });
});

describe('Thrill Seeker (Tier I Trail trait)', () => {
  it('losing 3 Energy in one phase makes the hiker Energized, once a phase', () => {
    const s = fixtureGame({ hikers: [fixtureHiker('ash', ['thrillSeeker'])] });
    changeStat(s, ash(s), 'energy', -2, 'test');
    expect(ash(s).conditions).toEqual([]);
    changeStat(s, ash(s), 'energy', -1, 'test');
    expect(ash(s).conditions.map((c) => c.id)).toEqual(['energized']);
    changeStat(s, ash(s), 'energy', -3, 'test');
    expect(s.log.filter((e) => e.kind === 'condition' && e.condition === 'energized')).toHaveLength(
      1,
    );
  });
});
