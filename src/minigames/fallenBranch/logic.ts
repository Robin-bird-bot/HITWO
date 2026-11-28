/**
 * Fallen Branch (docs/design/30-quick-minigames.md, section 3): a branch fell
 * across the trail. The party saws through it in shifts, keeping a steady
 * rhythm: too fast and the saw binds; too slow and it doesn't cut.
 *
 * - A stroke is A then D then A… (or a swipe back and forth on a phone).
 *   The tempo is the time between strokes, smoothed over the last [3]; a
 *   long pause starts the rhythm again (the first stroke after it only
 *   sets the beat).
 * - In the zone, a stroke cuts; too fast, the saw binds (stops for [0.6 s]
 *   and cuts nothing); too slow, it cuts nothing. The same key twice is a
 *   slip: no cut.
 * - Knots (from Tier II): while the cut is in one, the zone moves toward
 *   slow. From Tier III the zone drifts.
 * - Hikers saw in turn for [5 s] each, in line order, round and round; each
 *   new shift starts the rhythm again. A hiker alone saws the whole time.
 * - A passing challenge for the whole party: through before the clock runs
 *   out passes everyone; else nobody.
 * - Prepare: FOOD adds seconds, SHARPEN THE SAW cuts more a stroke, WAX THE
 *   BLADE halves binding, and a SWISS ARMY KNIFE starts the cut [20%] through.
 *
 * Pure and seeded. The cut is a share of the branch (0 to 1).
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passingResult } from '../passing';
import type { MinigameResult, Tier } from '../types';

const F = BALANCE.minigames.fallenBranch;

export type SawKey = 'a' | 'd';

export interface FallenBranchOptions {
  tier: Tier;
  /** The Clock and Shift length settings ("auto": the tier's). */
  clockSec?: number | 'auto';
  shiftSec?: number | 'auto';
  /** Prepare: seconds added, SHARPEN THE SAWs, WAX THE BLADE, a SWISS ARMY KNIFE. */
  extraSec?: number;
  sharpen?: number;
  wax?: number;
  knife?: number;
}

/** What a stroke did, for the screen. */
export type StrokeKind = 'start' | 'cut' | 'bind' | 'slow' | 'slip';

export interface Knot {
  /** Where it starts (a share of the branch), and how deep it runs. */
  at: number;
  span: number;
}

export interface FallenBranchState {
  tier: Tier;
  order: readonly string[];
  /** The right tempo (seconds between strokes) before knots and drift. */
  zone: readonly [number, number];
  cutPer: number;
  knots: readonly Knot[];
  driftSec: number;
  driftPhase: number;
  bindSec: number;
  shiftSec: number;
  clockSec: number;
  timeLeft: number;
  cut: number;
  /** The last few times between strokes (this shift's rhythm). */
  intervals: readonly number[];
  lastKey: SawKey | null;
  /** When the last stroke was (null: the rhythm starts again). */
  lastAt: number | null;
  /** The saw is stuck until then. */
  boundUntil: number;
  /** The shift now (whose: order[shift % hikers]), and when it began. */
  shift: number;
  shiftAt: number;
  /** How much each hiker has cut. */
  cutBy: Readonly<Record<string, number>>;
  lastStroke?: { at: number; kind: StrokeKind };
  time: number;
  over: boolean;
  passed: boolean;
}

/** Whose shift it is. */
export const sawyer = (s: FallenBranchState): string | undefined =>
  s.order[s.shift % Math.max(1, s.order.length)];

/** The knot the cut is in now, if any. */
export const knotNow = (s: FallenBranchState): Knot | undefined =>
  s.knots.find((k) => s.cut >= k.at && s.cut < k.at + k.span);

/** The right tempo now: knots move it toward slow; from Tier III it drifts. */
export function zoneNow(s: FallenBranchState, time = s.time): [number, number] {
  const hz = F.tiers[s.tier].driftHz;
  const drift = s.driftSec * Math.sin(2 * Math.PI * hz * time + s.driftPhase);
  const knot = knotNow(s) ? F.knot.slowerSec : 0;
  return [s.zone[0] + drift + knot, s.zone[1] + drift + knot];
}

/** The tempo now (seconds between strokes, smoothed), or null before the rhythm starts. */
export function tempo(s: FallenBranchState): number | null {
  if (s.intervals.length === 0) return null;
  return s.intervals.reduce((n, x) => n + x, 0) / s.intervals.length;
}

/** The tempo to show: it slides toward TOO SLOW while nobody strokes. */
export function shownTempo(s: FallenBranchState): number | null {
  const t = tempo(s);
  if (t === null || s.lastAt === null) return t;
  return Math.max(t, s.time - s.lastAt);
}

/** Knots: the tier's number, between [25%] and [85%] of the way through, never overlapping. */
function makeKnots(tier: Tier, rng: RngState): Knot[] {
  const [lo, hi] = F.tiers[tier].knots;
  const count = lo + Math.floor(nextFloat(rng) * (hi - lo + 1));
  const [from, to] = F.knot.between;
  const out: Knot[] = [];
  for (let k = 0; k < count; k++) {
    // An even share of the stretch each, somewhere in it.
    const room = (to - from) / count;
    const at = from + room * k + nextFloat(rng) * Math.max(0, room - F.knot.span);
    out.push({ at, span: F.knot.span });
  }
  return out;
}

export function newFallenBranch(
  options: FallenBranchOptions,
  order: readonly string[],
  seed: number,
): FallenBranchState {
  const t = F.tiers[options.tier];
  const rng = seedRng(seed);
  const clockSec =
    (typeof options.clockSec === 'number' ? options.clockSec : t.clockSec) +
    Math.max(0, options.extraSec ?? 0);
  return {
    tier: options.tier,
    order,
    zone: t.zone,
    cutPer: t.cut * (1 + F.sharpen * Math.max(0, options.sharpen ?? 0)),
    knots: makeKnots(options.tier, rng),
    driftSec: t.driftSec,
    driftPhase: nextFloat(rng) * Math.PI * 2,
    bindSec: F.bindSec * ((options.wax ?? 0) > 0 ? F.wax : 1),
    shiftSec: typeof options.shiftSec === 'number' ? options.shiftSec : F.shiftSec,
    clockSec,
    timeLeft: clockSec,
    cut: (options.knife ?? 0) > 0 ? F.knifeStart : 0,
    intervals: [],
    lastKey: null,
    lastAt: null,
    boundUntil: 0,
    shift: 0,
    shiftAt: 0,
    cutBy: {},
    time: 0,
    over: order.length === 0,
    passed: false,
  };
}

/** The rhythm starts again (a new shift, after binding, after a long pause). */
const restart = (s: FallenBranchState): FallenBranchState => ({
  ...s,
  intervals: [],
  lastAt: null,
  lastKey: null,
});

/** A stroke: A or D (a swipe one way or the other). */
export function stroke(s: FallenBranchState, key: SawKey): FallenBranchState {
  if (s.over || s.time < s.boundUntil) return s;
  const mark = (kind: StrokeKind, out: FallenBranchState): FallenBranchState => ({
    ...out,
    lastStroke: { at: s.time, kind },
  });
  if (s.lastKey === key) return mark('slip', { ...s, lastAt: s.time });
  const gap = s.lastAt === null ? null : s.time - s.lastAt;
  if (gap === null || gap > F.restartSec)
    return mark('start', { ...restart(s), lastKey: key, lastAt: s.time });
  const intervals = [...s.intervals, gap].slice(-F.smoothOver);
  const next: FallenBranchState = { ...s, intervals, lastKey: key, lastAt: s.time };
  const beat = tempo(next)!;
  const [lo, hi] = zoneNow(s);
  if (beat < lo) return mark('bind', { ...restart(next), boundUntil: s.time + s.bindSec });
  if (beat > hi) return mark('slow', next);
  const cut = Math.min(1, s.cut + s.cutPer);
  const who = sawyer(s) ?? '';
  const cutBy = { ...s.cutBy, [who]: (s.cutBy[who] ?? 0) + (cut - s.cut) };
  const out = mark('cut', { ...next, cut, cutBy });
  return cut >= 1 ? { ...out, over: true, passed: true } : out;
}

export function tick(s0: FallenBranchState, dt: number): FallenBranchState {
  if (s0.over) return s0;
  const time = s0.time + dt;
  const timeLeft = s0.timeLeft - dt;
  let s: FallenBranchState = { ...s0, time, timeLeft };
  if (timeLeft <= 0) return { ...s, timeLeft: 0, over: true, passed: false };
  // The next hiker's shift ("SWAP!"): the rhythm starts again.
  if (s.order.length > 1 && time - s.shiftAt >= s.shiftSec)
    s = { ...restart(s), shift: s.shift + 1, shiftAt: s.shiftAt + s.shiftSec };
  return s;
}

/** Through the branch in time: everyone passes; else nobody does (a passing challenge). */
export const result = (s: FallenBranchState): MinigameResult =>
  passingResult(s.order, s.tier, s.passed ? s.order : [], {});
