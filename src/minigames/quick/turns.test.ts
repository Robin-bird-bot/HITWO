/**
 * What the quick games share (docs/design/18-minigames-quick.md, "Turns"
 * and section 9, "All six"): one hiker at a time with a hand-off; the
 * bottom bar's words; hikers who fail lose [1] energy (Raccoon Shuffle: the
 * stolen item instead); and every game's result gives the end screen the
 * right row and cost for each hiker.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { RESOURCES } from '../../content/resources';
import { costText, endRows, endTitle } from '../endScreen';
import {
  newFireflyCatch,
  result as fireflyResult,
  tick as fireflyTick,
} from '../fireflyCatch/logic';
import { newFlySwatter, result as flyResult, tapAt } from '../flySwatter/logic';
import { testPack } from '../hikers';
import { payText } from '../passing';
import {
  newRaccoonShuffle,
  pickBin,
  result as shuffleResult,
  tick as shuffleTick,
  type RaccoonShuffleState,
} from '../raccoonShuffle/logic';
import {
  guess,
  newSafari,
  question,
  result as safariResult,
  tick as safariTick,
} from '../safari/logic';
import { lockIn, newSizeUp, result as sizeResult, tick as sizeTick } from '../sizeUp/logic';
import { newTrailBlazes, result as blazesResult, tap } from '../trailBlazes/logic';
import {
  allDone,
  current,
  endTurn,
  newTurns,
  playing,
  quickResult,
  tickTurns,
  turnWord,
} from './turns';

const Q = BALANCE.minigames.quick;

describe('turns', () => {
  it('one hiker at a time, with a hand-off; the bottom bar says NOW, WAITING, DONE, then PASSED or FAILED', () => {
    let t = newTurns(['finn', 'mom', 'ellie']);
    expect(current(t)).toBe('finn');
    expect(playing(t)).toBe(true);
    expect(['finn', 'mom', 'ellie'].map((id) => turnWord(t, id))).toEqual([
      'NOW',
      'WAITING',
      'WAITING',
    ]);
    t = endTurn(t, true);
    expect(current(t)).toBe('mom');
    expect(playing(t)).toBe(false);
    expect(turnWord(t, 'finn')).toBe('DONE');
    t = tickTurns(t, Q.handoffSec);
    expect(playing(t)).toBe(true);
    t = endTurn(endTurn(t, false), true);
    expect(allDone(t)).toBe(true);
    expect(t.handoff).toBe(0);
    expect(['finn', 'mom', 'ellie'].map((id) => turnWord(t, id))).toEqual([
      'PASSED',
      'FAILED',
      'PASSED',
    ]);
  });

  it('hikers who fail lose 1 energy unless the game says otherwise', () => {
    const r = quickResult(['finn', 'mom', 'ellie'], (id) => id === 'finn');
    expect(r).toMatchObject({
      safe: ['finn'],
      hit: [{ hikerId: 'mom' }, { hikerId: 'ellie' }],
      wording: 'passed-failed',
      pays: { mom: { energy: Q.failEnergy }, ellie: { energy: Q.failEnergy } },
    });
    const own = quickResult(['finn', 'mom'], () => false, { finn: { stolen: ['wood'] } });
    expect(own.pays).toEqual({ finn: { stolen: ['wood'] }, mom: { energy: Q.failEnergy } });
  });

  it('a stolen resource reads "−1 WOOD" on the end screen and "−1 Wood" elsewhere', () => {
    expect(costText({ stolen: ['wood'] })).toBe('−1 WOOD');
    expect(costText({ stolen: ['wood', 'salt', 'wood'] })).toBe('−2 WOOD, −1 SALT');
    expect(costText({ energy: 1 })).toBe('−1 ENERGY');
    expect(payText({ stolen: ['fish'] })).toBe('−1 Fish');
  });

  it('test packs: 2 to 6 real resources, the same for the same seed and hiker', () => {
    const ids = new Set(RESOURCES.map((r) => r.id));
    for (let seed = 1; seed <= 50; seed++) {
      const pack = testPack(seed, 'finn');
      const n = Object.values(pack).reduce<number>((a, b) => a + (b ?? 0), 0);
      expect(n).toBeGreaterThanOrEqual(BALANCE.minigames.raccoonShuffle.testPack[0]);
      expect(n).toBeLessThanOrEqual(BALANCE.minigames.raccoonShuffle.testPack[1]);
      expect(Object.keys(pack).every((k) => ids.has(k))).toBe(true);
      expect(testPack(seed, 'finn')).toEqual(pack);
    }
    expect(testPack(1, 'finn')).not.toEqual(testPack(1, 'mom'));
  });
});

describe('all six end on the end screen with the right result for each hiker', () => {
  const ORDER = ['finn', 'mom'];
  const rowsOf = (r: ReturnType<typeof quickResult>) =>
    endRows(r, ORDER).map((x) => [x.id, x.passed, x.cost]);

  it('Trail Blazes', () => {
    let s = newTrailBlazes({ tier: 1, tries: 1 }, ORDER, 1);
    s = tap(s);
    s = { ...s, turns: { ...s.turns, handoff: 0 } };
    s = tap(s);
    const r = blazesResult(s);
    expect(endTitle(r)).toBe('CHALLENGE FAILED');
    expect(rowsOf(r)).toEqual([
      ['finn', false, '−1 ENERGY'],
      ['mom', false, '−1 ENERGY'],
    ]);
  });

  it('Firefly Catch', () => {
    // Nobody taps: both run out of time.
    let s = newFireflyCatch({ tier: 1, catches: 1 }, ORDER, 2);
    for (let k = 0; k < 120 * 40 && !s.over; k++) s = fireflyTick(s, 1 / 120);
    expect(rowsOf(fireflyResult(s))).toEqual([
      ['finn', false, '−1 ENERGY'],
      ['mom', false, '−1 ENERGY'],
    ]);
  });

  it('Size Up', () => {
    let s = newSizeUp({ tier: 1 }, ORDER, 3);
    s = lockIn({ ...s, ratio: 1 });
    for (let k = 0; k < 120 * 40 && !s.over; k++) s = sizeTick(s, 1 / 120);
    const r = sizeResult(s);
    expect(endTitle(r)).toBe('CHALLENGE PASSED');
    expect(rowsOf(r)).toEqual([
      ['finn', true, ''],
      ['mom', false, '−1 ENERGY'],
    ]);
  });

  it('Fly Swatter', () => {
    let s = newFlySwatter({ tier: 3, strikes: 1 }, ORDER, 4);
    s = tapAt(s, 1, 1);
    s = { ...s, turns: { ...s.turns, handoff: 0 } };
    s = tapAt(s, 1, 1);
    expect(rowsOf(flyResult(s))).toEqual([
      ['finn', false, '−1 ENERGY'],
      ['mom', false, '−1 ENERGY'],
    ]);
  });

  it('Safari', () => {
    let s = newSafari({ tier: 1, questions: 1 }, ORDER, 5);
    while (s.phase === 'watch') s = safariTick(s, 0.1);
    const q = question(s)!;
    s = guess(
      s,
      q.signs.findIndex((x) => x.label === q.answer),
    );
    s = safariTick(s, 2);
    expect(s.over).toBe(true);
    expect(rowsOf(safariResult(s))).toEqual([
      ['finn', true, ''],
      ['mom', true, ''],
    ]);
  });

  it('Raccoon Shuffle: an empty bin costs nothing; a raccoon takes its card’s resource, not energy', () => {
    const toPick = (x: RaccoonShuffleState) => {
      let s = x;
      for (let k = 0; k < 120 * 60 && s.phase !== 'pick'; k++) s = shuffleTick(s, 1 / 120);
      return s;
    };
    let s = toPick(newRaccoonShuffle({ tier: 1, packs: { finn: {}, mom: { salt: 5 } } }, ORDER, 6));
    s = pickBin(
      s,
      s.slots.findIndex((id) => s.bins[id]!.card === null),
    );
    for (let k = 0; k < 120 * 10 && s.turns.at === 0; k++) s = shuffleTick(s, 1 / 120);
    s = toPick(s);
    s = pickBin(
      s,
      s.slots.findIndex((id) => s.bins[id]!.card !== null),
    );
    for (let k = 0; k < 120 * 10 && !s.over; k++) s = shuffleTick(s, 1 / 120);
    expect(rowsOf(shuffleResult(s))).toEqual([
      ['finn', true, ''],
      ['mom', false, '−1 SALT'],
    ]);
  });
});
