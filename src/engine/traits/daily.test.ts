import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { TRAITS } from '../../content/traits';
import { dailyPicks, MOODY_CONDITIONS } from '../../content/traits/daily';
import { workingTrait } from '../effects';
import { craftSetup } from '../items/craft';
import { scavengeSetup } from '../scavenge/setup';
import { END, fixtureGame, fixtureHiker, hiker, place, run, toNight } from '../test/fixtures';
import { NODE_TYPES, type GameState } from '../types';
import { setDaily } from './daily';

/** Ash has these traits; everyone starts on the trailhead, at Morale 5 (no Luck from it). */
function game(traits: string[], seed = 1): GameState {
  const s = fixtureGame({ seed, hikers: [fixtureHiker('ash', traits), fixtureHiker('birch')] });
  for (const h of s.hikers) h.stats.morale = 5;
  return s;
}
const ash = (s: GameState) => hiker(s, 'ash');
const slot = (s: GameState) => ash(s).slots[0]!;
const nextMorning = (s: GameState) => run(toNight(s), END);

describe('daily traits are rolled each morning', () => {
  it('Quirky: a random Tier I Utility trait, from Day 1', () => {
    const s = game(['quirky']);
    const picks = dailyPicks(TRAITS.quirky!);
    expect(picks.length).toBeGreaterThan(3);
    expect(picks.every((id) => TRAITS[id]?.type === 'U' && TRAITS[id]?.tier === 1)).toBe(true);
    expect(slot(s).daily).toMatchObject({ day: 1 });
    expect(picks).toContain(slot(s).daily!.pick);
  });

  it('a new pick the next day, and the same seed gives the same picks', () => {
    const days = (seed: number) => {
      let s = game(['zany'], seed);
      const out = [slot(s).daily!.pick];
      for (let d = 2; d <= 5; d++) {
        s = nextMorning(s);
        expect(slot(s).daily!.day).toBe(d);
        out.push(slot(s).daily!.pick);
      }
      return out;
    };
    expect(days(4)).toEqual(days(4));
    expect(new Set(days(4)).size).toBeGreaterThan(1);
  });

  it('Zany: Utility traits of any tier; neither picks one that needs a setting or changes daily', () => {
    const zany = dailyPicks(TRAITS.zany!);
    expect(new Set(zany.map((id) => TRAITS[id]?.tier))).toEqual(new Set([1, 2, 3]));
    for (const id of zany) {
      expect(TRAITS[id]?.setting).toBeUndefined();
      expect(TRAITS[id]?.daily).toBeUndefined();
    }
  });

  it('a reload keeps today’s pick', () => {
    const s = game(['quirky']);
    const reloaded = JSON.parse(JSON.stringify(s)) as GameState;
    expect(slot(reloaded).daily).toEqual(slot(s).daily);
  });
});

describe('Quirky and Zany run today’s trait', () => {
  it('as Focused: +1 Luck crafting alone', () => {
    const s = game(['quirky']);
    place(s, 'ash', 'M');
    setDaily(s, ash(s), slot(s), 'focused');
    expect(workingTrait(s, slot(s))?.name).toBe('Quirky (Focused)');
    expect(craftSetup(s, ash(s), 'tool').luck).toBe(1);
    setDaily(s, ash(s), slot(s), 'collaborative');
    expect(craftSetup(s, ash(s), 'tool').luck).toBe(0);
  });

  it('yesterday’s pick stops working once the day changes', () => {
    const s = game(['quirky']);
    setDaily(s, ash(s), slot(s), 'focused');
    s.day = 2; // before the morning roll
    expect(workingTrait(s, slot(s))?.name).toBe('Quirky');
  });
});

describe('Nosework', () => {
  it('a random node each morning; +3 Luck on a tile with that node', () => {
    const s = game(['nosework']);
    expect(NODE_TYPES).toContain(slot(s).daily!.pick);
    place(s, 'ash', 'L'); // a Forest tile
    setDaily(s, ash(s), slot(s), 'forest');
    expect(scavengeSetup(s, ash(s)).luck).toBe(BALANCE.traits.nosework.luck);
    expect(craftSetup(s, ash(s), 'tool').luck).toBe(BALANCE.traits.nosework.luck);
    setDaily(s, ash(s), slot(s), 'river');
    expect(scavengeSetup(s, ash(s)).luck).toBe(0);
  });
});

describe('Moody', () => {
  it('each morning, 1 of 6 conditions for the day', () => {
    let s = game(['moody'], 2);
    const today = () => ash(s).conditions.filter((c) => MOODY_CONDITIONS.includes(c.id as never));
    expect(today()).toHaveLength(1);
    expect(today()[0]).toMatchObject({ id: slot(s).daily!.pick, remaining: 1, unit: 'days' });
    s = nextMorning(s);
    expect(today()).toHaveLength(1);
    expect(today()[0]!.id).toBe(slot(s).daily!.pick);
  });
});
