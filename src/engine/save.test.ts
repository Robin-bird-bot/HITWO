import { describe, expect, it } from 'vitest';
import { applyAction } from './applyAction';
import { SAVE_VERSION, deserialize, serialize } from './save';
import { END, fixtureGame, run } from './test/fixtures';
import type { Action, GameState } from './types';

const SCRIPT: Action[] = [
  { type: 'moveAll', hikerId: 'ash', toTileId: 'M', bring: ['birch'] },
  { type: 'move', hikerId: 'cedar', toTileId: 'L' },
  END,
  { type: 'move', hikerId: 'cedar', toTileId: 'M' },
  END,
  { type: 'sleep', hikerId: 'ash' },
  END,
];

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('save and load', () => {
  it('round-trips a game exactly', () => {
    const state = run(fixtureGame({ seed: 77 }), ...SCRIPT);
    const loaded = deserialize(serialize(state));
    expect(loaded).toEqual({ ok: true, state });
  });

  it('stamps every game with the save version', () => {
    expect(fixtureGame().saveVersion).toBe(SAVE_VERSION);
  });

  it('reports a missing save as empty', () => {
    expect(deserialize(null)).toEqual({ ok: false, reason: 'empty' });
    expect(deserialize('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('refuses broken JSON without throwing', () => {
    expect(deserialize('{"saveVersion": 1, "day":')).toEqual({ ok: false, reason: 'corrupt' });
    expect(deserialize('[1, 2, 3]')).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('refuses a save with missing parts', () => {
    const data = JSON.parse(serialize(fixtureGame())) as Record<string, unknown>;
    delete data.hikers;
    expect(deserialize(JSON.stringify(data))).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('refuses a save from a newer version of the game', () => {
    const data = { ...fixtureGame(), saveVersion: SAVE_VERSION + 1 };
    expect(deserialize(JSON.stringify(data))).toEqual({ ok: false, reason: 'tooNew' });
  });

  it('upgrades a version 2 save: no challenges used yet (Phase 5)', () => {
    const v2 = structuredClone(fixtureGame()) as Partial<GameState>;
    delete v2.usedCards;
    const loaded = deserialize(JSON.stringify({ ...v2, saveVersion: 2 }));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.state.saveVersion).toBe(SAVE_VERSION);
      expect(loaded.state.usedCards).toEqual([]);
      expect(loaded.state.trials).toBeUndefined();
    }
  });

  it('upgrades a version 3 save: run counters start at zero (Nov 6 update)', () => {
    const v3 = structuredClone(fixtureGame()) as Partial<GameState>;
    delete v3.counters;
    const loaded = deserialize(JSON.stringify({ ...v3, saveVersion: 3 }));
    expect(loaded.ok && loaded.state.counters).toEqual({
      passed: {},
      failed: {},
      crafted: {},
      daysSinceSleep: {},
      sheltersPlaced: {},
    });
  });

  it('upgrades a version 4 save: the trail gets a Wonder on a tile nobody has reached', () => {
    const v4 = structuredClone(fixtureGame());
    v4.section.tiles.L!.visited = true;
    const loaded = deserialize(JSON.stringify({ ...v4, saveVersion: 4 }));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const withWonder = Object.values(loaded.state.section.tiles).filter((t) => t.wonder);
    expect(withWonder).toHaveLength(1);
    const tile = withWonder[0]!;
    expect(['M', 'R']).toContain(tile.id);
    expect(tile.nodes).toEqual([]);
    expect(tile.wonder?.decoys).toBeGreaterThan(0);
    // The same save always gets the same Wonder.
    const again = deserialize(JSON.stringify({ ...v4, saveVersion: 4 }));
    expect(again.ok && Object.values(again.state.section.tiles).find((t) => t.wonder)).toEqual(
      tile,
    );
  });

  it('upgrades a version 5 save: the old debug weather becomes today’s, with a forecast', () => {
    const v5 = structuredClone(fixtureGame()) as unknown as Record<string, unknown>;
    v5.weather = 'stormy';
    const loaded = deserialize(JSON.stringify({ ...v5, saveVersion: 5 }));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.weather.today).toBe('storm');
    expect(loaded.state.weather.since).toBe(loaded.state.day);
    expect(loaded.state.weather.ahead.length).toBeGreaterThanOrEqual(3);
    const none = structuredClone(fixtureGame()) as unknown as Record<string, unknown>;
    delete none.weather;
    const clear = deserialize(JSON.stringify({ ...none, saveVersion: 5 }));
    expect(clear.ok && clear.state.weather.today).toBe('clear');
  });

  it('round-trips conditions with their timing', () => {
    const state = fixtureGame();
    const ash = state.hikers[0];
    if (!ash) throw new Error('no hiker');
    ash.conditions = [
      { id: 'frozen', remaining: 1, unit: 'phases', fresh: true },
      {
        id: 'hangry',
        remaining: 2,
        unit: 'days',
        then: { id: 'nauseous', remaining: 1, unit: 'days' },
      },
    ];
    expect(deserialize(serialize(state))).toEqual({ ok: true, state });
  });

  it('refuses an old version with no migration', () => {
    const data = { ...fixtureGame(), saveVersion: 0 };
    expect(deserialize(JSON.stringify(data))).toEqual({ ok: false, reason: 'unsupported' });
  });
});

describe('determinism', () => {
  it('gives an identical game for the same seed and the same actions', () => {
    const a = run(fixtureGame({ seed: 123 }), ...SCRIPT);
    const b = run(fixtureGame({ seed: 123 }), ...SCRIPT);
    expect(serialize(a)).toBe(serialize(b));
  });

  it('carries the RNG state, so different seeds give different games', () => {
    const a = fixtureGame({ seed: 1 });
    const b = fixtureGame({ seed: 2 });
    expect(a.rng).not.toEqual(b.rng);
  });

  it('continues identically after a save and load mid-game', () => {
    const straight = run(fixtureGame({ seed: 9 }), ...SCRIPT);
    const half = run(fixtureGame({ seed: 9 }), ...SCRIPT.slice(0, 3));
    const reloaded = deserialize(serialize(half));
    if (!reloaded.ok) throw new Error('reload failed');
    const resumed = run(reloaded.state, ...SCRIPT.slice(3));
    expect(serialize(resumed)).toBe(serialize(straight));
  });

  it('never changes the state passed in', () => {
    let state: GameState = deepFreeze(fixtureGame());
    for (const action of SCRIPT) {
      const before = serialize(state);
      const next = applyAction(state, action);
      expect(serialize(state)).toBe(before);
      state = deepFreeze(next);
    }
  });
});
