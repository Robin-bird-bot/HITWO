import { describe, expect, it } from 'vitest';
import { addInjury } from '../stats';
import { END, fixtureGame, fixtureHiker, hiker, place, run, toNight } from '../test/fixtures';
import type { Action, GameState } from '../types';
import { actionLosses, forecastAction, forecastStartOfDay, lossesIn, workingNow } from './forecast';

type Who = 'ash' | 'birch' | 'cedar' | 'dot';

/** Ash, Birch, Cedar and Dot on the trailhead with these traits, at Morale 5. */
function party(traits: Partial<Record<Who, string[]>>, seed = 1): GameState {
  const s = fixtureGame({
    seed,
    hikers: (['ash', 'birch', 'cedar', 'dot'] as const).map((id) => fixtureHiker(id, traits[id])),
  });
  for (const h of s.hikers) h.stats.morale = 5;
  return s;
}
const move = (hikerId: string, toTileId: string): Action => ({ type: 'move', hikerId, toTileId });
const moveAll = (hikerId: string, toTileId: string, bring: string[]): Action => ({
  type: 'moveAll',
  hikerId,
  toTileId,
  bring,
});
/** The Morale changes traits made at the start of the latest day, by hiker. */
function startOfDayMorale(s: GameState): Record<string, number> {
  const morning = s.log.findLast((e) => e.kind === 'phase' && e.phase === 'morning');
  const out: Record<string, number> = {};
  for (const e of s.log) {
    if (!morning || e.id < morning.id || e.kind !== 'stat' || e.stat !== 'morale') continue;
    out[e.hikerId] = (out[e.hikerId] ?? 0) + (e.to - e.from);
  }
  return out;
}

describe('the start-of-day forecast', () => {
  it('an Extrinsic hiker alone: −1, and why', () => {
    const s = party({ ash: ['extrinsic'] });
    expect(forecastStartOfDay(s).ash).toMatchObject({ delta: 1 });
    place(s, 'ash', 'L');
    const f = forecastStartOfDay(structuredClone(s)).ash;
    expect(f).toEqual({
      delta: -1,
      parts: [{ trait: 'Extrinsic', delta: -1, why: 'alone right now' }],
    });
  });

  it('only traits: a hiker with no Morale trait has no forecast', () => {
    const s = party({ ash: ['leader'] });
    expect(forecastStartOfDay(s).ash).toBeUndefined();
  });

  it('matches what happens at the next start of day', () => {
    const s = party({
      ash: ['extrinsic', 'foody'],
      birch: ['intrinsic'],
      cedar: ['extrinsic', 'wanderlust'],
      dot: ['aloof'],
    });
    place(s, 'birch', 'L');
    hiker(s, 'ash').stats.appetite = 9;
    const forecast = forecastStartOfDay(s);
    const next = run(toNight(s), END);
    const actual = startOfDayMorale(next);
    for (const id of ['ash', 'birch', 'cedar', 'dot']) {
      expect(actual[id] ?? 0).toBe(forecast[id]?.delta ?? 0);
    }
    // Not all zero: it's a real check.
    expect(Object.values(actual).some((d) => d !== 0)).toBe(true);
  });

  it('doesn’t change the game, and gives the same answer for the same state', () => {
    const s = party({ ash: ['extrinsic'] });
    const before = JSON.stringify(s);
    const a = forecastStartOfDay(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(forecastStartOfDay(s)).toBe(a);
  });

  it('lists the losses', () => {
    const s = party({ ash: ['extrinsic'], birch: ['extrinsic'] });
    place(s, 'ash', 'L');
    expect(lossesIn(forecastStartOfDay(s), 'tomorrow').map((l) => l.hikerId)).toEqual(['ash']);
  });
});

describe('an action’s forecast', () => {
  it('moving away leaves an Extrinsic hiker alone: a loss tomorrow', () => {
    const s = party({ birch: ['extrinsic'] });
    for (const id of ['cedar', 'dot']) place(s, id, 'R');
    const losses = actionLosses(s, move('ash', 'L'));
    expect(losses).toEqual([
      {
        hikerId: 'birch',
        when: 'tomorrow',
        delta: -1,
        parts: [{ trait: 'Extrinsic', delta: -1, why: 'alone right now' }],
      },
    ]);
    // Staying together costs nothing.
    expect(actionLosses(s, moveAll('ash', 'L', ['birch']))).toEqual([]);
  });

  it('a loss right away: Bossy moved by someone else', () => {
    const s = party({ birch: ['bossy'] });
    const f = forecastAction(s, moveAll('ash', 'L', ['birch']));
    expect(f?.now.birch).toEqual({
      delta: -1,
      parts: [{ trait: 'Bossy', delta: -1, why: 'moved by someone else' }],
    });
    expect(actionLosses(s, moveAll('ash', 'L', ['birch']))[0]).toMatchObject({
      hikerId: 'birch',
      when: 'now',
    });
  });

  it('nothing for an action that isn’t allowed', () => {
    const s = party({ birch: ['extrinsic'] });
    expect(forecastAction(s, move('ash', 'C'))).toBeUndefined();
    expect(actionLosses(s, move('ash', 'C'))).toEqual([]);
  });
});

describe('working now', () => {
  it('Focused works alone; Collaborative with others', () => {
    const s = party({ ash: ['focused', 'collaborative'] });
    expect([workingNow(s, hiker(s, 'ash'), 0), workingNow(s, hiker(s, 'ash'), 1)]).toEqual([
      false,
      true,
    ]);
    place(s, 'ash', 'L');
    expect([workingNow(s, hiker(s, 'ash'), 0), workingNow(s, hiker(s, 'ash'), 1)]).toEqual([
      true,
      false,
    ]);
  });

  it('Shrug Off until it’s been used this biome; nothing to say for Leader', () => {
    const s = party({ ash: ['shrugOff', 'leader'] });
    expect(workingNow(s, hiker(s, 'ash'), 0)).toBe(true);
    // The first injury is shrugged off: used for this biome.
    addInjury(s, hiker(s, 'ash'), 'test');
    expect(hiker(s, 'ash').injuries).toBe(0);
    expect(workingNow(s, hiker(s, 'ash'), 0)).toBe(false);
    expect(workingNow(s, hiker(s, 'ash'), 1)).toBeUndefined();
  });
});
