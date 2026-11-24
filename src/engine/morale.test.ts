/**
 * Morale types (Phase 10.7, 09-hikers.md "Morale types"): checked at the end
 * of every phase for +1, −1 or nothing; "moved" includes being brought along;
 * counts include the hiker.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { moraleForecast, moraleNow } from './morale';
import { END, hiker, place, run, trailGame } from './test/fixtures';
import type { GameState, MoraleTypeId } from './types';

const M = BALANCE.moraleTypes;

/** Four hikers on the trailhead; Finn has the type being tested, Morale 5. */
function game(type: MoraleTypeId): GameState {
  const s = trailGame(['finn', 'ellie', 'mom', 'wyatt']);
  for (const h of s.hikers) delete h.moraleType;
  hiker(s, 'finn').moraleType = type;
  place(s, 'finn', 'T', { morale: 5 });
  return s;
}
/** Puts this many hikers (Finn included) on the trailhead, the rest on L. */
function crowd(s: GameState, n: number): GameState {
  s.hikers.forEach((h, i) => (h.tileId = i < n ? 'T' : 'L'));
  return s;
}
const morale = (s: GameState) => hiker(s, 'finn').stats.morale;

describe('the first 6', () => {
  it('Finn Extrovert, Ellie Foody, Wyatt Energetic, Mom Wanderlust, Gdog and Wink Ambivert', () => {
    const s = trailGame(['finn', 'ellie', 'wyatt', 'mom']);
    expect(s.hikers.map((h) => h.moraleType)).toEqual([
      'extrovert',
      'foody',
      'energetic',
      'wanderlust',
    ]);
    const t = trailGame(['gdog', 'grandpaWink']);
    expect(t.hikers.map((h) => h.moraleType)).toEqual(['ambivert', 'ambivert']);
  });
});

describe('each type', () => {
  it.each([
    ['extrovert', M.crowd, 1],
    ['extrovert', 2, 0],
    ['extrovert', 1, -1],
    ['introvert', 1, 1],
    ['introvert', 2, 0],
    ['introvert', M.crowd, -1],
    ['ambivert', 2, 1],
    ['ambivert', M.bigGroup - 1, 1],
    ['ambivert', 1, -1],
    ['ambivert', M.bigGroup, -1],
  ] as const)('%s with %i hikers on the tile: %i', (type, n, delta) => {
    let s = crowd(game(type), n);
    expect(moraleNow(s, hiker(s, 'finn'))).toBe(delta);
    s = run(s, END);
    expect(morale(s)).toBe(5 + delta);
  });

  it.each([
    ['foody', 'appetite'],
    ['energetic', 'energy'],
  ] as const)('%s: +1 at %s high, −1 low, nothing between', (type, stat) => {
    for (const [value, delta] of [
      [M.high, 1],
      [M.high - 1, 0],
      [M.low + 1, 0],
      [M.low, -1],
    ]) {
      const s = game(type);
      hiker(s, 'finn').stats[stat] = value!;
      expect(run(s, END).hikers[0]?.stats.morale, `${stat} ${value}`).toBe(5 + delta!);
    }
  });

  it('Wanderlust: +1 for moving (or being brought along), −1 for staying', () => {
    expect(morale(run(game('wanderlust'), END))).toBe(4);
    expect(
      morale(run(game('wanderlust'), { type: 'move', hikerId: 'finn', toTileId: 'L' }, END)),
    ).toBe(6);
    const brought = run(game('wanderlust'), {
      type: 'moveAll',
      hikerId: 'ellie',
      toTileId: 'L',
      bring: ['finn'],
    });
    expect(morale(run(brought, END))).toBe(6);
  });

  it('Homebody: +1 for staying, −1 for moving', () => {
    expect(morale(run(game('homebody'), END))).toBe(6);
    expect(
      morale(run(game('homebody'), { type: 'move', hikerId: 'finn', toTileId: 'L' }, END)),
    ).toBe(4);
  });

  it('within the Morale limits', () => {
    const s = crowd(game('extrovert'), M.crowd);
    hiker(s, 'finn').stats.morale = 10;
    expect(morale(run(s, END))).toBe(10);
  });
});

describe('the forecast on the Morale bar', () => {
  it('what the end of this phase would give right now', () => {
    const s = crowd(game('extrovert'), 1);
    expect(moraleForecast(s, hiker(s, 'finn'))).toBe(-1);
    crowd(s, M.crowd);
    expect(moraleForecast(s, hiker(s, 'finn'))).toBe(1);
  });

  it('Wanderlust and Homebody can’t tell until the hiker moves or acts', () => {
    let s = game('wanderlust');
    expect(moraleForecast(s, hiker(s, 'finn'))).toBe('unknown');
    s = run(s, { type: 'move', hikerId: 'finn', toTileId: 'L' });
    expect(moraleForecast(s, hiker(s, 'finn'))).toBe(1);
    const h = game('homebody');
    hiker(h, 'finn').acted = true;
    expect(moraleForecast(h, hiker(h, 'finn'))).toBe(1);
  });
});
