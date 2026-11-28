/**
 * The run clock (docs/design/29-core-loop.md, section 9): played time by
 * section, each minigame's time with its name and tier, the target by
 * difficulty, the kept record, and the summary at the end.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import type { StorageLike } from '../../store/autosave';
import {
  addTime,
  clockText,
  closeMinigame,
  freshClock,
  longestMinigames,
  openMinigame,
  summary,
  targetText,
} from './runClock';
import { RUN_CLOCK_KEY, RunClockStore } from './store';

function fakeStorage(
  start: Record<string, string> = {},
): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(start));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('the run clock', () => {
  it('adds played time to the run and its section', () => {
    let c = freshClock(7, 'medium');
    c = addTime(c, 30, 0);
    c = addTime(c, 15, 0);
    c = addTime(c, 20, 2);
    expect(c.totalSec).toBe(65);
    expect(c.sections).toEqual([45, 0, 20]);
  });

  it('times each minigame from its pop-up to its end, with its name, tier and section', () => {
    let c = addTime(freshClock(7, 'easy'), 100, 1);
    c = openMinigame(c, { name: 'Wrong Turn', tier: 2 }, 1);
    c = addTime(c, 25, 1);
    c = closeMinigame(c);
    expect(c.open).toBeUndefined();
    expect(c.minigames).toEqual([{ name: 'Wrong Turn', tier: 2, section: 1, sec: 25 }]);
    // Closing with nothing open changes nothing.
    expect(closeMinigame(c)).toBe(c);
  });

  it('stops once the run is over', () => {
    const c = { ...addTime(freshClock(7, 'medium'), 10, 0), ended: true as const };
    expect(addTime(c, 10, 0)).toBe(c);
    expect(openMinigame(c, { name: 'Bee Attack!', tier: 1 }, 0)).toBe(c);
  });

  it('shows the target for Easy and Medium (Hard and Nightmare have none yet)', () => {
    const [lo, hi] = BALANCE.run.targetMinutes.easy!;
    expect(targetText('easy')).toBe(`${lo}–${hi} min`);
    expect(targetText('medium')).toBe('55–65 min');
    expect(targetText('hard')).toBeNull();
  });

  it('reads as minutes and seconds, and hours past one', () => {
    expect(clockText(0)).toBe('0:00');
    expect(clockText(65.9)).toBe('1:05');
    expect(clockText(3723)).toBe('1:02:03');
  });

  it('the summary: the total, each section, the 5 longest minigames, the difficulty', () => {
    let c = freshClock(7, 'medium');
    c = addTime(c, 600, 0);
    c = addTime(c, 900, 1);
    for (const [name, sec] of [
      ['A', 10],
      ['B', 50],
      ['C', 30],
      ['D', 70],
      ['E', 20],
      ['F', 40],
    ] as const) {
      c = openMinigame(c, { name, tier: 1 }, 1);
      c = addTime(c, sec, 1);
      c = closeMinigame(c);
    }
    expect(longestMinigames(c).map((m) => m.name)).toEqual(['D', 'B', 'F', 'C', 'E']);
    const text = summary(c);
    expect(text).toMatch(/^Run clock: 28:40 \(Medium, aim 55–65 min\)/);
    expect(text).toContain('Section 1: 10:00');
    expect(text).toContain('Section 2: 18:40');
    expect(text).toContain('D (Tier I): 1:10');
    expect(text).not.toContain('A (Tier I)');
  });
});

describe('the kept clock', () => {
  it('is saved on every change and read back', () => {
    const storage = fakeStorage();
    const store = new RunClockStore(storage);
    expect(store.get()).toBeNull();
    store.set(addTime(freshClock(3, 'medium'), 12, 0));
    expect(JSON.parse(storage.data.get(RUN_CLOCK_KEY)!)).toMatchObject({ seed: 3, totalSec: 12 });
    expect(new RunClockStore(storage).get()).toMatchObject({ seed: 3, totalSec: 12 });
  });

  it('a record it can’t read is no record (never a crash)', () => {
    expect(new RunClockStore(fakeStorage({ [RUN_CLOCK_KEY]: '{oops' })).get()).toBeNull();
    expect(new RunClockStore(fakeStorage({ [RUN_CLOCK_KEY]: '{"seed":"x"}' })).get()).toBeNull();
  });

  it('tells whoever listens', () => {
    const store = new RunClockStore(fakeStorage());
    let heard = 0;
    const stop = store.subscribe(() => heard++);
    store.set(freshClock(1, 'easy'));
    stop();
    store.set(freshClock(2, 'easy'));
    expect(heard).toBe(1);
  });
});
