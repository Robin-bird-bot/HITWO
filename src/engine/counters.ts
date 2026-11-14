/**
 * Run counters (Nov 6 update, 3c): things Wonder goals ask about that the game
 * doesn't otherwise remember.
 */
import type { GameState, HikerId, RunCounters } from './types';

export function freshCounters(): RunCounters {
  return { passed: {}, failed: {}, crafted: {}, daysSinceSleep: {}, sheltersPlaced: {} };
}

export function countChallenge(state: GameState, hikerId: HikerId, passed: boolean): void {
  const table = passed ? state.counters.passed : state.counters.failed;
  table[hikerId] = (table[hikerId] ?? 0) + 1;
}

/** At camp: a hiker who slept starts over; one who didn't adds a night. */
export function countSleep(state: GameState): void {
  for (const h of state.hikers) {
    if (h.status === 'abandoned' || h.status === 'checkedIn') continue;
    state.counters.daysSinceSleep[h.id] = h.slept
      ? 0
      : (state.counters.daysSinceSleep[h.id] ?? 0) + 1;
  }
}

export function countShelter(state: GameState): void {
  const i = state.sectionIndex;
  state.counters.sheltersPlaced[i] = (state.counters.sheltersPlaced[i] ?? 0) + 1;
}

/** A hiker crafted an item of this type (Multnomah Falls' goal). */
export function countCrafted(state: GameState, hikerId: HikerId, type: string): void {
  const mine = (state.counters.crafted[hikerId] ??= {});
  mine[type] = (mine[type] ?? 0) + 1;
}
