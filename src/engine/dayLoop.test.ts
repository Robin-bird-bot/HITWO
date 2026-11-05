import { describe, expect, it } from 'vitest';
import { validateAction } from './applyAction';
import { hikersWhoHaventActed } from './dayLoop';
import { END, fixtureGame, hiker, place, run, toNight } from './test/fixtures';

describe('the day loop', () => {
  it('runs Morning → Afternoon → Night → the next Morning', () => {
    let s = fixtureGame();
    expect([s.day, s.phase]).toEqual([1, 'morning']);
    s = run(s, END);
    expect([s.day, s.phase]).toEqual([1, 'afternoon']);
    s = run(s, END);
    expect([s.day, s.phase]).toEqual([1, 'night']);
    s = run(s, END);
    expect([s.day, s.phase]).toEqual([2, 'morning']);
  });

  it('gives every hiker their action back each phase', () => {
    let s = run(fixtureGame(), { type: 'move', hikerId: 'ash', toTileId: 'L' });
    expect(hikersWhoHaventActed(s).map((h) => h.id)).toEqual(['birch', 'cedar', 'dot']);
    s = run(s, END);
    expect(hikersWhoHaventActed(s)).toHaveLength(4);
  });

  it('drains 1 Appetite at the end of the day and 2 Energy for a night without sleep', () => {
    const s = run(toNight(fixtureGame()), { type: 'sleep', hikerId: 'ash' }, END);
    // Ash slept (+2 capped at 10), so only the end-of-day drain applies.
    expect(hiker(s, 'ash').stats).toEqual({ energy: 10, appetite: 9, morale: 10 });
    // Birch didn't sleep.
    expect(hiker(s, 'birch').stats).toEqual({ energy: 8, appetite: 9, morale: 10 });
  });

  it('sleep gives +1 Energy, or +2 in a shelter (Wyatt, Nov 5)', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L', { energy: 5 });
    place(s, 'birch', 'R', { energy: 5 }); // R is a campsite
    const night = run(
      toNight(s),
      { type: 'sleep', hikerId: 'ash' },
      { type: 'sleep', hikerId: 'birch' },
    );
    expect(hiker(night, 'ash').stats.energy).toBe(6);
    expect(hiker(night, 'birch').stats.energy).toBe(7);
  });

  it('only lets hikers sleep at night', () => {
    expect(validateAction(fixtureGame(), { type: 'sleep', hikerId: 'ash' })).toBe(
      'Hikers sleep at night.',
    );
  });

  it('can injure at camp, resolving one drain at a time', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy: 2, appetite: 1 });
    const next = run(toNight(s), END);
    const h = hiker(next, 'ash');
    // No sleep: Energy 2 → 0, injury, Energy and Appetite raised to 5; then end of day: Appetite 5 → 4.
    expect(h.injuries).toBe(1);
    expect(h.stats.energy).toBe(5);
    expect(h.stats.appetite).toBe(4);
  });

  it('skips camp drains for passed-out hikers (TODO(wyatt) in balance.ts)', () => {
    const s = fixtureGame();
    hiker(s, 'ash').status = 'passedOut';
    const next = run(toNight(s), END);
    expect(hiker(next, 'ash').stats).toEqual({ energy: 10, appetite: 10, morale: 10 });
  });

  it('logs each new phase', () => {
    const s = run(fixtureGame(), END, END, END);
    expect(s.log.filter((e) => e.kind === 'phase').map((e) => [e.day, e.phase])).toEqual([
      [1, 'afternoon'],
      [1, 'night'],
      [2, 'morning'],
    ]);
  });
});
