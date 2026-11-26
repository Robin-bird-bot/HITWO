/**
 * Crossroads (docs/design/19-minigames-signs-trails.md, sections 3 and 7):
 * no arrow is followed by its opposite; pressing the way you came is
 * ignored; a fail shows the right steps in that hiker's color, and the next
 * hiker starts at step 1.
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../../engine/rng';
import { TIERS } from '../types';
import {
  choose,
  current,
  makeArrows,
  missedLine,
  newCrossroads,
  OPPOSITE,
  ready,
  result,
  tick,
  type CrossroadsState,
  type Dir,
} from './logic';

const C = BALANCE.minigames.crossroads;
const Q = BALANCE.minigames.quick;
const STEP = C.walkOutSec + C.walkInSec + 0.01;

/** Walks the right way for `n` steps. */
function walk(s0: CrossroadsState, n: number): CrossroadsState {
  let s = s0;
  for (let k = 0; k < n; k++) {
    s = choose(s, s.arrows[s.step]!);
    s = tick(s, STEP);
  }
  return s;
}

describe('Crossroads', () => {
  it.each(TIERS)(
    'Tier %i: the tier’s arrows; never down first; never an arrow followed by its opposite',
    (tier) => {
      for (let seed = 1; seed <= 50; seed++) {
        const a = makeArrows(seedRng(seed), C.arrows[tier]);
        expect(a).toHaveLength(C.arrows[tier]);
        expect(a[0]).not.toBe('down');
        for (let k = 1; k < a.length; k++) expect(a[k]).not.toBe(OPPOSITE[a[k - 1]!]);
      }
    },
  );

  it('READY starts the walk at step 1; the way you came is ignored with a bump', () => {
    let s = newCrossroads({ tier: 2 }, ['finn'], 3);
    expect(s.phase).toBe('study');
    s = ready(s);
    expect(s.phase).toBe('walk');
    const bumped = choose(s, 'down');
    expect(bumped.step).toBe(0);
    expect(bumped.phase).toBe('walk');
    expect(bumped.bump?.dir).toBe('down');
    s = walk(s, 1);
    expect(s.step).toBe(1);
    expect(s.cameFrom).toBe(OPPOSITE[s.arrows[0]!]);
    expect(choose(s, s.cameFrom).bump).toBeDefined();
  });

  it('walking every step makes it; the next hiker sees the same arrows and starts at step 1', () => {
    let s = ready(newCrossroads({ tier: 1 }, ['finn', 'mom'], 4));
    const arrows = s.arrows;
    s = walk(s, s.count);
    expect(s.phase).toBe('made');
    s = tick(s, C.madeSec + 0.01);
    expect(s.status.finn).toBe('passed');
    expect(current(s)).toBe('mom');
    expect(s.phase).toBe('study');
    expect(s.arrows).toEqual(arrows);
    expect(s.step).toBe(0);
    expect(s.missed).toBeUndefined();
  });

  it('a wrong turn fails the hiker; the arrow screen shows the steps they got right and where they went wrong', () => {
    let s = ready(newCrossroads({ tier: 3 }, ['finn', 'mom'], 8));
    s = walk(s, 2);
    const way = s.arrows[2]!;
    const wrong = (['up', 'right', 'down', 'left'] as Dir[]).find(
      (d) => d !== way && d !== s.cameFrom,
    )!;
    s = choose(s, wrong);
    expect(s.status.finn).toBe('failed');
    expect(s.phase).toBe('study');
    expect(current(s)).toBe('mom');
    expect(s.missed).toEqual({ by: 'finn', right: 2, went: wrong, way });
    expect(missedLine(s.missed!, 'Finn')).toBe(
      `FINN WENT ${wrong.toUpperCase()} AT STEP 3. THE WAY WAS ${way.toUpperCase()}.`,
    );
    // Mom starts from step 1.
    s = ready(s);
    expect(s.step).toBe(0);
    s = walk(s, s.count);
    s = tick(s, C.madeSec + 0.01);
    s = tick(s, 0.01);
    expect(s.over).toBe(true);
    expect(result(s)).toMatchObject({ safe: ['mom'], pays: { finn: { energy: Q.failEnergy } } });
  });

  it('New arrows per hiker; Study time and Time per turn', () => {
    let s = ready(newCrossroads({ tier: 5, newPerHiker: true }, ['finn', 'mom'], 2));
    const first = s.arrows;
    s = choose(s, s.arrows[0] === 'up' ? 'left' : 'up');
    expect(s.arrows).not.toEqual(first);
    // Study time: the walk starts by itself.
    const study = tick(newCrossroads({ tier: 1, studySec: 5 }, ['finn'], 1), 5.01);
    expect(study.phase).toBe('walk');
    // Time per turn: running out is a wrong turn.
    const slow = tick(ready(newCrossroads({ tier: 1, turnSec: 3 }, ['finn'], 1)), 3.01);
    expect(slow.status.finn).toBe('failed');
    expect(slow.missed?.went).toBeNull();
  });
});
