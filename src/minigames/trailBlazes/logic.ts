/**
 * Trail Blazes (docs/design/18-minigames-quick.md, section 1): two tree
 * trunks side by side, painted with trail blazes. The left trunk scrolls up
 * and the right one down. Tap when the two lit blazes are level.
 *
 * - One hiker at a time, in line order.
 * - "Level": the two lit blazes' centers within the tier's distance.
 * - A match takes both blazes off the trunks (bare trunk) and lights a new
 *   pair, [80–140] units apart and heading toward each other.
 * - A miss is a tap when they're not level, or letting the lit pair pass
 *   each other. After a miss, a new pair lights up.
 * - Tries (the default): [3] misses and the hiker fails. Clock: a miss costs
 *   [2 s], and the hiker fails when time runs out.
 * - From Tier III each pair changes each trunk's speed; Tier V adds a
 *   wobble while they approach.
 *
 * Pure and seeded; positions are in scene units (320 × 240), y down.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, pick, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import {
  allDone,
  current,
  endTurn,
  newTurns,
  playing,
  quickResult,
  tickTurns,
  type Turns,
} from '../quick/turns';
import type { MinigameResult, Tier } from '../types';

const TB = BALANCE.minigames.trailBlazes;

export type TrailBlazesMode = 'tries' | 'clock';

export interface TrailBlazesOptions {
  tier: Tier;
  mode?: TrailBlazesMode;
  /** The Tries setting ("auto": the tier's). */
  tries?: number | 'auto';
}

/** A lit pair: a blaze on each trunk, by index (blaze i sits at the trunk's offset + i × gap). */
export interface LitPair {
  l: number;
  r: number;
  /** Seconds since it lit up (the Tier V wobble). */
  age: number;
}

export interface TrailBlazesState {
  tier: Tier;
  mode: TrailBlazesMode;
  pairsNeeded: number;
  level: number;
  tries: number;
  clockSec: number;
  turns: Turns;
  /** This hiker's turn. */
  matched: number;
  misses: number;
  clockLeft: number;
  /** Each trunk's offset: the y of its blaze 0's center (left goes up, right goes down). */
  offL: number;
  offR: number;
  /** This pair's speeds (units a second). */
  vL: number;
  vR: number;
  lit: LitPair | null;
  /** Blazes already matched (gone from the trunk), by index. */
  goneL: number[];
  goneR: number[];
  /** The last match (its line shows for a moment) and the last miss, for the screen. */
  lastMatch?: { l: number; r: number; at: number };
  lastMiss?: { at: number; why: 'early' | 'passed' };
  /** Each hiker's turn, once done: pairs matched and misses. */
  record: Readonly<Record<string, { matched: number; misses: number }>>;
  time: number;
  over: boolean;
  rng: RngState;
}

/** A blaze's center (scene y) on a trunk. */
export const blazeY = (s: TrailBlazesState, side: 'l' | 'r', index: number): number =>
  (side === 'l' ? s.offL : s.offR) + index * TB.blazeGap;

/** How far apart the lit pair is: the left blaze's y minus the right one's (it shrinks as they approach). */
export const litGap = (s: TrailBlazesState): number | null =>
  s.lit ? blazeY(s, 'l', s.lit.l) - blazeY(s, 'r', s.lit.r) : null;

/** Whether the lit pair is level now (their centers within the tier's distance). */
export const isLevel = (s: TrailBlazesState): boolean => {
  const gap = litGap(s);
  return gap !== null && Math.abs(gap) <= s.level;
};

/** This pair's speeds: the tier's, changed by up to ± the tier's share from Tier III. */
function pairSpeeds(rng: RngState, tier: Tier): { vL: number; vR: number } {
  const t = TB.tiers[tier];
  const one = () => t.speed * (1 + (nextFloat(rng) * 2 - 1) * t.change);
  return { vL: one(), vR: one() };
}

/**
 * Lights a new pair: a blaze on each trunk, both on screen and not gone, the
 * left one lower by [80–140] units, so they head toward each other and meet
 * on screen.
 */
function lightPair(s: TrailBlazesState, rng: RngState): TrailBlazesState {
  const { vL, vR } = pairSpeeds(rng, s.tier);
  const [lo, hi] = TB.litY;
  const [near, far] = TB.startApart;
  const onScreen = (side: 'l' | 'r', gone: readonly number[]) => {
    const off = side === 'l' ? s.offL : s.offR;
    const out: number[] = [];
    for (let i = Math.ceil((lo - off) / TB.blazeGap); off + i * TB.blazeGap <= hi; i++) {
      if (!gone.includes(i)) out.push(i);
    }
    return out;
  };
  const lefts = onScreen('l', s.goneL);
  const rights = onScreen('r', s.goneR);
  const options: { l: number; r: number }[] = [];
  for (const l of lefts) {
    for (const r of rights) {
      const gap = blazeY(s, 'l', l) - blazeY(s, 'r', r);
      if (gap < near || gap > far) continue;
      // Where they meet: on screen too.
      const meet = blazeY(s, 'l', l) - (gap * vL) / (vL + vR);
      if (meet >= lo && meet <= hi) options.push({ l, r });
    }
  }
  if (options.length === 0) {
    // Nothing fits right now (rare): try again in a moment.
    return { ...s, vL, vR, lit: null };
  }
  const p = pick(rng, options);
  return { ...s, vL, vR, lit: { l: p.l, r: p.r, age: 0 } };
}

/** A fresh turn for the hiker now up. */
function startTurn(s: TrailBlazesState, rng: RngState): TrailBlazesState {
  return lightPair(
    { ...s, matched: 0, misses: 0, clockLeft: s.clockSec, goneL: [], goneR: [], lit: null },
    rng,
  );
}

export function newTrailBlazes(
  options: TrailBlazesOptions,
  order: readonly string[],
  seed: number,
): TrailBlazesState {
  const t = TB.tiers[options.tier];
  const rng = seedRng(seed);
  const s: TrailBlazesState = {
    tier: options.tier,
    mode: options.mode ?? 'tries',
    pairsNeeded: t.pairs,
    level: t.level,
    tries: typeof options.tries === 'number' ? options.tries : t.tries,
    clockSec: t.clockSec,
    turns: newTurns(order),
    matched: 0,
    misses: 0,
    clockLeft: t.clockSec,
    // The trunks start with their blazes on a random phase.
    offL: nextFloat(rng) * TB.blazeGap,
    offR: nextFloat(rng) * TB.blazeGap,
    vL: t.speed,
    vR: t.speed,
    lit: null,
    goneL: [],
    goneR: [],
    record: {},
    time: 0,
    over: order.length === 0,
    rng,
  };
  return startTurn(s, rng);
}

/** The current hiker's turn is over: record it, then the next hiker (or the end). */
function finish(s: TrailBlazesState, passed: boolean, rng: RngState): TrailBlazesState {
  const id = current(s.turns);
  const record = id ? { ...s.record, [id]: { matched: s.matched, misses: s.misses } } : s.record;
  const turns = endTurn(s.turns, passed);
  const next = { ...s, record, turns, lit: null };
  if (allDone(turns)) return { ...next, over: true };
  return startTurn(next, rng);
}

/** A miss: a try used (or time off the clock), and a new pair, unless the turn is over. */
function miss(s: TrailBlazesState, why: 'early' | 'passed', rng: RngState): TrailBlazesState {
  const misses = s.misses + 1;
  const clockLeft = s.mode === 'clock' ? s.clockLeft - TB.missCostSec : s.clockLeft;
  const out = { ...s, misses, clockLeft, lastMiss: { at: s.time, why } };
  if (s.mode === 'tries' ? misses >= s.tries : clockLeft <= 0) return finish(out, false, rng);
  return lightPair(out, rng);
}

/** A tap (or Space): a match when the lit pair is level, a miss when it isn't. */
export function tap(s: TrailBlazesState): TrailBlazesState {
  if (s.over || !playing(s.turns) || !s.lit) return s;
  const rng: RngState = [...s.rng];
  if (!isLevel(s)) return { ...miss(s, 'early', rng), rng };
  const { l, r } = s.lit;
  const matched = s.matched + 1;
  const out: TrailBlazesState = {
    ...s,
    matched,
    goneL: [...s.goneL, l],
    goneR: [...s.goneR, r],
    lastMatch: { l, r, at: s.time },
    lit: null,
  };
  if (matched >= s.pairsNeeded) return { ...finish(out, true, rng), rng };
  return { ...lightPair(out, rng), rng };
}

/** The Tier V wobble: each trunk's speed swings ± the tier's share while the pair approaches. */
function wobbled(s: TrailBlazesState, side: 'l' | 'r'): number {
  const w = TB.tiers[s.tier].wobble;
  const v = side === 'l' ? s.vL : s.vR;
  if (!w || !s.lit) return v;
  const phase = side === 'l' ? 0 : Math.PI / 2;
  return v * (1 + w * Math.sin((2 * Math.PI * s.lit.age) / TB.wobbleSec + phase));
}

export function tick(s0: TrailBlazesState, dt: number): TrailBlazesState {
  if (s0.over) return s0;
  let s: TrailBlazesState = { ...s0, time: s0.time + dt, turns: tickTurns(s0.turns, dt) };
  if (!playing(s.turns)) return s;
  const rng: RngState = [...s.rng];

  if (s.mode === 'clock') {
    s = { ...s, clockLeft: s.clockLeft - dt };
    if (s.clockLeft <= 0) return { ...finish({ ...s, clockLeft: 0 }, false, rng), rng };
  }

  s = {
    ...s,
    offL: s.offL - wobbled(s, 'l') * dt,
    offR: s.offR + wobbled(s, 'r') * dt,
    lit: s.lit ? { ...s.lit, age: s.lit.age + dt } : null,
  };
  // Keep the offsets small (the blazes repeat every gap); indices shift with them.
  if (s.offL < -TB.blazeGap) s = shift(s, 'l', 1);
  if (s.offR > TB.blazeGap) s = shift(s, 'r', -1);

  if (!s.lit) return { ...lightPair(s, rng), rng };
  const gap = litGap(s)!;
  // They passed each other without a tap.
  if (gap < -s.level) return { ...miss(s, 'passed', rng), rng };
  return { ...s, rng };
}

/** Moves a trunk's offset by one gap, renumbering its blazes so nothing on screen changes. */
function shift(s: TrailBlazesState, side: 'l' | 'r', by: 1 | -1): TrailBlazesState {
  const g = TB.blazeGap;
  if (side === 'l') {
    return {
      ...s,
      offL: s.offL + by * g,
      goneL: s.goneL.map((i) => i - by),
      lit: s.lit ? { ...s.lit, l: s.lit.l - by } : null,
      lastMatch: s.lastMatch ? { ...s.lastMatch, l: s.lastMatch.l - by } : undefined,
    };
  }
  return {
    ...s,
    offR: s.offR + by * g,
    goneR: s.goneR.map((i) => i - by),
    lit: s.lit ? { ...s.lit, r: s.lit.r - by } : null,
    lastMatch: s.lastMatch ? { ...s.lastMatch, r: s.lastMatch.r - by } : undefined,
  };
}

/** Who passed (matched all their pairs); those who failed lose [1] energy. */
export const result = (s: TrailBlazesState): MinigameResult =>
  quickResult(s.turns.order, (id) => s.turns.done[id] === true);
