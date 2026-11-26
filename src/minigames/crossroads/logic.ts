/**
 * Crossroads (docs/design/19-minigames-signs-trails.md, section 3; Wyatt
 * called it "Trailmap", renamed so it isn't mixed up with Trail Map):
 * remember a row of arrows, then walk them through 4-way trail crossings.
 *
 * - **The arrow screen:** REMEMBER THE WAY, then READY (or the Study time
 *   running out, if it's set).
 * - **The arrows** never ask you to go back: an arrow is never followed by
 *   its opposite, and the first is never down (you came in from below).
 *   Every hiker gets the same arrows unless New arrows per hiker is on.
 * - **Walking:** each choice walks out of the crossing and into the next
 *   one. The way you came in is ignored (a small bump).
 * - **The last step** reaches the clearing: MADE IT, the hiker passes, and
 *   the next hiker sees the arrows again and walks from step 1.
 * - **A wrong turn** (or, with Time per turn set, running out of time): the
 *   hiker fails; the arrow screen comes back with every step they got right
 *   in their color and a line saying where they went wrong; then the next
 *   hiker gets READY and starts from step 1.
 * - Hikers who fail lose [1] energy.
 *
 * Pure and seeded.
 */
import { BALANCE } from '../../config/balance';
import { pick, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { quickResult } from '../quick/turns';
import type { MinigameResult, Tier } from '../types';

const C = BALANCE.minigames.crossroads;

export type Dir = 'up' | 'right' | 'down' | 'left';
export const DIRS: readonly Dir[] = ['up', 'right', 'down', 'left'];
export const OPPOSITE: Readonly<Record<Dir, Dir>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/** A row of arrows: never down first, never an arrow followed by its opposite. */
export function makeArrows(rng: RngState, n: number): Dir[] {
  const out: Dir[] = [];
  for (let k = 0; k < n; k++) {
    const back = k === 0 ? 'down' : OPPOSITE[out[k - 1]!];
    out.push(
      pick(
        rng,
        DIRS.filter((d) => d !== back),
      ),
    );
  }
  return out;
}

export interface CrossroadsOptions {
  tier: Tier;
  /** The Arrows setting ("auto": the tier's). */
  arrows?: number | 'auto';
  /** Study time (seconds; null: no limit). */
  studySec?: number | null;
  /** New arrows per hiker. */
  newPerHiker?: boolean;
  /** Time per turn (seconds; null: none). */
  turnSec?: number | null;
}

export type CrossroadsPhase = 'study' | 'walk' | 'step' | 'made' | 'done';

export interface CrossroadsState {
  tier: Tier;
  arrows: Dir[];
  count: number;
  newPerHiker: boolean;
  studySec: number | null;
  turnSec: number | null;
  order: readonly string[];
  status: Readonly<Record<string, 'passed' | 'failed'>>;
  /** Who's up (an index into `order`; `order.length` once everyone has gone). */
  at: number;
  phase: CrossroadsPhase;
  /** When the phase began (game time). */
  phaseAt: number;
  /** The next arrow to walk (0 = step 1), and the way back (ignored). */
  step: number;
  cameFrom: Dir;
  /** The step being walked (out, then in), and the last bump. */
  moving: Dir | null;
  bump?: { dir: Dir; at: number };
  /** After a wrong turn: who, how many steps they got right, and where they went. */
  missed?: { by: string; right: number; went: Dir | null; way: Dir };
  time: number;
  over: boolean;
  rng: RngState;
}

export const current = (s: CrossroadsState): string | undefined => s.order[s.at];

export function newCrossroads(
  options: CrossroadsOptions,
  order: readonly string[],
  seed: number,
): CrossroadsState {
  const rng = seedRng(seed);
  const count = typeof options.arrows === 'number' ? options.arrows : C.arrows[options.tier];
  return {
    tier: options.tier,
    arrows: makeArrows(rng, count),
    count,
    newPerHiker: options.newPerHiker ?? false,
    studySec: options.studySec ?? null,
    turnSec: options.turnSec ?? null,
    order,
    status: {},
    at: 0,
    phase: order.length ? 'study' : 'done',
    phaseAt: 0,
    step: 0,
    cameFrom: 'down',
    moving: null,
    time: 0,
    over: order.length === 0,
    rng,
  };
}

/** READY: start walking from step 1. */
export function ready(s: CrossroadsState): CrossroadsState {
  if (s.over || s.phase !== 'study') return s;
  return { ...s, phase: 'walk', phaseAt: s.time, step: 0, cameFrom: 'down', moving: null };
}

/** The next hiker's turn: the arrow screen again (new arrows if the setting says so). */
function nextHiker(s: CrossroadsState, missed?: CrossroadsState['missed']): CrossroadsState {
  const at = s.at + 1;
  if (at >= s.order.length)
    return { ...s, at, phase: 'done', phaseAt: s.time, missed, moving: null };
  const rng: RngState = [...s.rng];
  const arrows = s.newPerHiker ? makeArrows(rng, s.count) : s.arrows;
  return {
    ...s,
    at,
    arrows,
    rng,
    phase: 'study',
    phaseAt: s.time,
    step: 0,
    cameFrom: 'down',
    moving: null,
    missed,
  };
}

/** A wrong turn (or running out of time: `went` null): the hiker fails, and the arrows come back. */
function wrongTurn(s: CrossroadsState, went: Dir | null): CrossroadsState {
  const id = current(s)!;
  return nextHiker(
    { ...s, status: { ...s.status, [id]: 'failed' } },
    { by: id, right: s.step, went, way: s.arrows[s.step]! },
  );
}

/** Choose a way at a crossing: the way you came is ignored (a bump); the right way walks on; any other fails. */
export function choose(s: CrossroadsState, dir: Dir): CrossroadsState {
  if (s.over || s.phase !== 'walk') return s;
  if (dir === s.cameFrom) return { ...s, bump: { dir, at: s.time } };
  if (dir !== s.arrows[s.step]) return wrongTurn(s, dir);
  return { ...s, phase: 'step', phaseAt: s.time, moving: dir };
}

export function tick(s0: CrossroadsState, dt: number): CrossroadsState {
  if (s0.over) return s0;
  const s: CrossroadsState = { ...s0, time: s0.time + dt };
  const since = s.time - s.phaseAt;
  switch (s.phase) {
    case 'done':
      return { ...s, over: true };
    case 'study':
      return s.studySec !== null && since >= s.studySec ? ready(s) : s;
    case 'walk':
      return s.turnSec !== null && since >= s.turnSec ? wrongTurn(s, null) : s;
    case 'step': {
      if (since < C.walkOutSec + C.walkInSec) return s;
      const dir = s.moving!;
      const step = s.step + 1;
      if (step >= s.count) return { ...s, step, phase: 'made', phaseAt: s.time, moving: null };
      return { ...s, step, cameFrom: OPPOSITE[dir], phase: 'walk', phaseAt: s.time, moving: null };
    }
    case 'made': {
      if (since < C.madeSec) return s;
      const id = current(s)!;
      return nextHiker({ ...s, status: { ...s.status, [id]: 'passed' } });
    }
  }
}

const WORD: Readonly<Record<Dir, string>> = {
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
};

/** "FINN WENT LEFT AT STEP 3. THE WAY WAS UP." (or ran out of time). */
export function missedLine(m: NonNullable<CrossroadsState['missed']>, name: string): string {
  const n = name.toUpperCase();
  const where = `STEP ${m.right + 1}`;
  return m.went
    ? `${n} WENT ${WORD[m.went]} AT ${where}. THE WAY WAS ${WORD[m.way]}.`
    : `${n} RAN OUT OF TIME AT ${where}. THE WAY WAS ${WORD[m.way]}.`;
}

/** Who passed; those who failed lose [1] energy. */
export const result = (s: CrossroadsState): MinigameResult =>
  quickResult(s.order, (id) => s.status[id] === 'passed');
