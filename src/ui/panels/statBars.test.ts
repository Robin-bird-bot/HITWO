import { describe, expect, it } from 'vitest';
import { STARTING_PARTY } from '../../content/characters';
import { createGame } from '../../engine';
import { fixtureGame, hiker, place, toNight } from '../../engine/test/fixtures';
import {
  BAR_COLOR,
  BAR_LEVELS,
  barColor,
  barLevel,
  nothingToDoReason,
  readyActions,
  THRESHOLD_STATS,
} from './hikerInfo';

describe('status bar colours', () => {
  it('use each stat’s own colour normally', () => {
    expect(barColor('energy', 10)).toBe('#7FC29B');
    expect(barColor('appetite', 10)).toBe('#C08A5A');
    expect(barColor('morale', 10)).toBe('#B98AE0');
  });

  it.each([
    ['energy', 7, 'normal'],
    ['energy', 6, 'low'], // Fatigued
    ['energy', 4, 'low'],
    ['energy', 3, 'critical'], // Exhausted
    ['appetite', 6, 'normal'],
    ['appetite', 5, 'low'], // Hungry
    ['appetite', 3, 'low'],
    ['appetite', 2, 'critical'], // Famished
    ['morale', 6, 'normal'],
    ['morale', 5, 'low'],
    ['morale', 3, 'low'],
    ['morale', 2, 'critical'],
  ] as const)('%s %i is %s', (stat, value, level) => {
    expect(barLevel(stat, value)).toBe(level);
  });

  it('turn amber at a threshold and red when critical', () => {
    expect(barColor('energy', 6)).toBe(BAR_COLOR.low);
    expect(BAR_COLOR.low).toBe('#F0A83A');
    expect(barColor('appetite', 1)).toBe(BAR_COLOR.critical);
    expect(BAR_COLOR.critical).toBe('#E5624A');
  });
});

describe('Simple mode actions', () => {
  const ids = (s: ReturnType<typeof fixtureGame>, id: string) =>
    readyActions(s, hiker(s, id)).map((a) => a.id);

  it('show only what the hiker can do right now', () => {
    const s = fixtureGame();
    expect(ids(s, 'ash')).toEqual(['move', 'moveAll', 'craft']);
    expect(ids(toNight(fixtureGame()), 'ash')).toEqual([
      'move',
      'moveAll',
      'craft',
      'sleep',
      'watch',
    ]);
  });

  it('drop Move All when the hiker is alone', () => {
    const game = createGame({ seed: 1, hikers: STARTING_PARTY });
    for (const h of game.hikers.slice(1)) h.acted = true;
    expect(readyActions(game, hiker(game, 'hiker-1')).map((a) => a.id)).toEqual(['move', 'craft']);
  });

  it('say why when there’s nothing to do', () => {
    const s = fixtureGame();
    hiker(s, 'ash').acted = true;
    expect(readyActions(s, hiker(s, 'ash'))).toEqual([]);
    expect(nothingToDoReason(s, hiker(s, 'ash'))).toBe('Ash has already acted this morning.');
    place(s, 'birch', 'T', { energy: 3 });
    expect(nothingToDoReason(s, hiker(s, 'birch'))).toMatch(/^Exhausted/);
  });
});

describe('threshold ticks (Nov 5, 2c)', () => {
  it('sit at 6 and 3 on Energy, and 5 and 2 on Appetite', () => {
    expect(THRESHOLD_STATS).toEqual(['energy', 'appetite']);
    expect(BAR_LEVELS.energy).toEqual({ low: 6, critical: 3 });
    expect(BAR_LEVELS.appetite).toEqual({ low: 5, critical: 2 });
  });
});
