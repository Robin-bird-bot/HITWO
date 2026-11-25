/**
 * Rafting (docs/design/17-minigames-lanes.md, section 3): the whole party in
 * one raft, heading upriver to the dock. Pure and seeded, in small steps.
 *
 * - **The raft** slides left and right between lanes; the river comes down
 *   at the current pace.
 * - **Rocks** come down the lanes, a row at a time, never blocking every
 *   lane (on Tier V a large rock can cover two). A rock hit costs a life (one
 *   per hiker, lost in line order), then a moment of safety.
 * - **Rapids** don't cost a life: the pace goes up for the rest of the run.
 * - **The dock:** reaching it with any life left, everyone passes; with
 *   none left, everyone fails (the everyone-fails rule).
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passingResult } from '../passing';
import type { MinigameResult, Tier } from '../types';

const R = BALANCE.minigames.rafting;

export type { Tier };
export type RockSize = 's' | 'm' | 'l';

/** The rocks' and rapids' heights (the art's), for when they touch the raft. */
export const HEIGHT = { s: 15, m: 19, l: 23, rapids: 22, raft: 24 } as const;

/** A rock or rapids: its lane (the left one, for a two-lane rock), how many lanes, and where on the course its middle is. */
export interface RaftThing {
  kind: 'rock' | 'rapids';
  size?: RockSize;
  lane: number;
  lanes: 1 | 2;
  at: number;
  done?: true;
}

export interface RaftingState {
  tier: Tier;
  lanes: number;
  order: string[];
  /** Hikers whose life is gone, in the order they lost it (line order). */
  lost: string[];
  /** The raft's lane, and a slide on its way. */
  lane: number;
  slide?: { from: number; to: number; at: number };
  /** How far the raft has come, out of the whole distance, and its pace now. */
  traveled: number;
  distance: number;
  pace: number;
  startPace: number;
  things: RaftThing[];
  safeFor: number;
  lastHit?: { hikerId: string; at: number };
  time: number;
  over: boolean;
  rng: RngState;
}

export interface RaftingOptions {
  tier: Tier;
  /** The testing tab's override: "auto" uses the tier's. */
  distance?: 'auto' | number;
}

/** The course: rows of rocks spread along the river (never every lane), and the rapids between them. */
function course(rng: RngState, tier: Tier, lanes: number, distance: number): RaftThing[] {
  const t = R.tiers[tier];
  const from = R.startClear;
  const to = Math.max(from + 100, distance - R.endClear);
  const rocks = Math.max(1, Math.round((t.rocksPer100 * (to - from)) / 100));
  const out: RaftThing[] = [];
  // Rows: each with a few rocks, never filling every lane.
  const perRow = Math.max(1, Math.min(lanes - 1, Math.round(lanes / 2)));
  const rows = Math.max(1, Math.ceil(rocks / perRow));
  const step = (to - from) / rows;
  let left = rocks;
  for (let r = 0; r < rows && left > 0; r++) {
    const at = from + step * (r + 0.5) + (nextFloat(rng) - 0.5) * step * 0.3;
    const n = Math.min(left, int(rng, 1, lanes - 1));
    left -= n;
    const free = shuffle(
      rng,
      Array.from({ length: lanes }, (_, k) => k),
    );
    let covered = 0;
    for (let k = 0; k < n && free.length; k++) {
      const lane = free.shift()!;
      // Tier V: sometimes a large rock across two lanes (still leaving one open).
      const two =
        tier >= R.twoLaneFrom &&
        lane + 1 < lanes &&
        free.includes(lane + 1) &&
        covered + 2 < lanes &&
        nextFloat(rng) < R.twoLaneChance;
      if (two) {
        free.splice(free.indexOf(lane + 1), 1);
        out.push({ kind: 'rock', size: 'l', lane, lanes: 2, at });
        covered += 2;
      } else {
        const size: RockSize = (['s', 'm', 'l'] as const)[int(rng, 0, 2)]!;
        out.push({ kind: 'rock', size, lane, lanes: 1, at });
        covered += 1;
      }
      if (covered >= lanes - 1) break;
    }
  }
  // Rapids, half a row from the rocks.
  for (let k = 0; k < t.rapids; k++) {
    const r = int(rng, 0, rows - 1);
    out.push({
      kind: 'rapids',
      lane: int(rng, 0, lanes - 1),
      lanes: 1,
      at: Math.min(to, from + step * (r + 1)),
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

export function newRafting(
  options: RaftingOptions,
  order: readonly string[],
  seed: number,
): RaftingState {
  const rng = seedRng(seed);
  const t = R.tiers[options.tier];
  const distance = typeof options.distance === 'number' ? options.distance : t.distance;
  return {
    tier: options.tier,
    lanes: t.lanes,
    order: [...order],
    lost: [],
    lane: Math.floor(t.lanes / 2),
    traveled: 0,
    distance,
    pace: t.pace,
    startPace: t.pace,
    things: course(rng, options.tier, t.lanes, distance),
    safeFor: 0,
    time: 0,
    over: order.length === 0,
    rng,
  };
}

/** The raft's lane now (part way during a slide). */
export function raftAt(s: RaftingState): number {
  if (!s.slide) return s.lane;
  const u = Math.min(1, (s.time - s.slide.at) / R.slideSec);
  return s.slide.from + (s.slide.to - s.slide.from) * u;
}

/** A slide one lane left (−1) or right (1), if the raft isn't already sliding. */
export function slide(s: RaftingState, dir: -1 | 1): RaftingState {
  if (s.over || s.slide) return s;
  const to = s.lane + dir;
  if (to < 0 || to >= s.lanes) return s;
  return { ...s, slide: { from: s.lane, to, at: s.time } };
}

/** Hikers who still have their life. */
export const livesLeft = (s: RaftingState): string[] =>
  s.order.filter((id) => !s.lost.includes(id));

/** The pace compared with the start ("SPEED ×1.12"). */
export const speedUp = (s: RaftingState): number => s.pace / s.startPace;

/** Whether something covers the raft's lane right where the raft is. */
function touching(s: RaftingState, th: RaftThing, lane: number): boolean {
  const h = th.kind === 'rapids' ? HEIGHT.rapids : HEIGHT[th.size ?? 'm'];
  if (Math.abs(th.at - s.traveled) > (h + HEIGHT.raft) / 2 - 3) return false;
  return lane >= th.lane && lane < th.lane + th.lanes;
}

/** Time passes: the raft slides and goes on; rocks hit, rapids speed it up; the dock wins. */
export function tick(s0: RaftingState, dt: number): RaftingState {
  if (s0.over) return s0;
  let s: RaftingState = {
    ...s0,
    time: s0.time + dt,
    traveled: s0.traveled + s0.pace * dt,
    safeFor: Math.max(0, s0.safeFor - dt),
  };
  if (s.slide && s.time - s.slide.at >= R.slideSec) {
    s = { ...s, lane: s.slide.to };
    delete s.slide;
  }
  const lane = Math.round(raftAt(s));
  let things = s.things;
  for (const [k, th] of s.things.entries()) {
    if (th.done || !touching(s, th, lane)) continue;
    if (th.kind === 'rapids') {
      // Faster for the rest of the run; never a life.
      s = { ...s, pace: s.pace * (1 + R.rapidsBoost) };
      things = things.map((x, j) => (j === k ? { ...x, done: true } : x));
    } else if (s.safeFor <= 0) {
      const who = livesLeft(s)[0];
      if (who)
        s = {
          ...s,
          lost: [...s.lost, who],
          safeFor: R.safeSec,
          lastHit: { hikerId: who, at: s.time },
        };
      things = things.map((x, j) => (j === k ? { ...x, done: true } : x));
    }
  }
  s = { ...s, things };
  if (!livesLeft(s).length || s.traveled >= s.distance) s = { ...s, over: true };
  return s;
}

/** Everyone passes with any life left at the dock; with none, everyone fails. */
export function result(s: RaftingState): MinigameResult {
  const made = livesLeft(s).length > 0 && s.traveled >= s.distance;
  return passingResult(s.order, s.tier, made ? s.order : [], {});
}
