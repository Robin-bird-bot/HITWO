/**
 * A readable three-day walkthrough of everything the Phase 1 engine does.
 * Every number below was worked out by hand from the design doc's rules.
 *
 * Trail (see test/fixtures.ts): T trailhead; L, M, R in the middle row
 * (R is a campsite); C checkpoint. T–M steep, T–R paved, L–M muddy,
 * M–R rough, everything else normal.
 */
import { describe, expect, it } from 'vitest';
import { validateAction } from './applyAction';
import { deserialize, serialize } from './save';
import { END, fixtureGame, fixtureHiker, hiker, run } from './test/fixtures';
import type { Action, GameState } from './types';

const move = (id: string, to: string): Action => ({ type: 'move', hikerId: id, toTileId: to });
const sleep = (id: string): Action => ({ type: 'sleep', hikerId: id });
const stoic = (id: string, choice: 'energy' | 'appetite'): Action => ({
  type: 'useAbility',
  hikerId: id,
  abilityId: 'stoic',
  choice,
});

const start = () =>
  fixtureGame({
    seed: 2026,
    hikers: [
      fixtureHiker('ash', ['leader', 'extrinsic']),
      fixtureHiker('birch', ['stoic']),
      fixtureHiker('cedar'),
      fixtureHiker('dot', ['extrinsic']),
    ],
  });

const DAY_1: Action[] = [
  // Morning. Ash leads Birch and Cedar up the steep line: Ash pays 1 + 2 − 1 (Leader) = 2
  // Appetite, and everyone who crosses pays the steep +1 Energy. Dot takes the free paved line.
  { type: 'moveAll', hikerId: 'ash', toTileId: 'M', bring: ['birch', 'cedar'] },
  move('dot', 'R'),
  END,
  // Afternoon. Ash crosses the rough line (1 Appetite, 1 Morale); Birch the muddy one (2 Appetite).
  move('ash', 'R'),
  move('birch', 'L'),
  END,
  // Night. Ash and Dot sleep at the campsite; Birch walks back down in the dark
  // (1 + 1 night Appetite). The checkpoint itself is off limits until Phase 8.
  sleep('ash'),
  sleep('dot'),
  move('birch', 'T'),
  END,
];

const DAY_2: Action[] = [
  // Morning. Birch uses Stoic (free): −2 Morale, +1 Appetite. Cedar goes down the steep
  // line (1 Appetite, 1 Energy). Ash leads Dot over the rough line.
  stoic('birch', 'appetite'),
  move('birch', 'L'),
  move('cedar', 'T'),
  { type: 'moveAll', hikerId: 'ash', toTileId: 'M', bring: ['dot'] },
  END,
  // Afternoon. Ash is Hungry now (Appetite 5), so walks alone, down the steep line.
  move('ash', 'T'),
  END,
  // Night. Nobody sleeps.
  END,
];

const DAY_3: Action[] = [stoic('birch', 'energy'), move('ash', 'L'), END, END, sleep('ash'), END];

function stats(state: GameState) {
  return Object.fromEntries(
    state.hikers.map((h) => [h.id, { ...h.stats, at: h.tileId, injuries: h.injuries }]),
  );
}

describe('a three-day hike', () => {
  it('ends Day 1 with the expected stats', () => {
    const s = run(start(), ...DAY_1);
    expect([s.day, s.phase]).toEqual([2, 'morning']);
    expect(stats(s)).toEqual({
      // Extrinsic: Ash shares the campsite with Dot at dawn, so Morale 9 → 10.
      ash: { energy: 10, appetite: 6, morale: 10, at: 'R', injuries: 0 },
      birch: { energy: 7, appetite: 5, morale: 10, at: 'T', injuries: 0 },
      cedar: { energy: 7, appetite: 9, morale: 10, at: 'M', injuries: 0 },
      dot: { energy: 10, appetite: 9, morale: 10, at: 'R', injuries: 0 },
    });
  });

  it('stops a Hungry hiker from moving the group', () => {
    const s = run(start(), ...DAY_1, ...DAY_2.slice(0, 5));
    expect(hiker(s, 'ash').stats.appetite).toBe(5);
    expect(
      validateAction(s, { type: 'moveAll', hikerId: 'ash', toTileId: 'T', bring: ['dot'] }),
    ).toMatch(/^Hungry/);
  });

  it('ends Day 3 with the expected stats', () => {
    const s = run(start(), ...DAY_1, ...DAY_2, ...DAY_3);
    expect([s.day, s.phase]).toEqual([4, 'morning']);
    expect(stats(s)).toEqual({
      // Extrinsic: Ash wakes beside Birch on L (Morale stays 10); Dot has woken
      // alone on M two days running (9 → 8 → 7).
      // Ash's Day 3 sleep in the open gives +1 Energy (Wyatt, Nov 5).
      ash: { energy: 8, appetite: 1, morale: 10, at: 'L', injuries: 0 },
      birch: { energy: 4, appetite: 3, morale: 6, at: 'L', injuries: 0 },
      cedar: { energy: 2, appetite: 6, morale: 10, at: 'T', injuries: 0 },
      dot: { energy: 6, appetite: 7, morale: 7, at: 'M', injuries: 0 },
    });
  });

  it('replays identically from a save made halfway', () => {
    const straight = run(start(), ...DAY_1, ...DAY_2, ...DAY_3);
    const saved = serialize(run(start(), ...DAY_1));
    const loaded = deserialize(saved);
    if (!loaded.ok) throw new Error('reload failed');
    const resumed = run(loaded.state, ...DAY_2, ...DAY_3);
    expect(serialize(resumed)).toBe(serialize(straight));
  });
});
