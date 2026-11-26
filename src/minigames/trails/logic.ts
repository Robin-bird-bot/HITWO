/**
 * Trails (docs/design/19-minigames-signs-trails.md, section 2), a passing
 * challenge: keep your hiker on a trail as it comes down the screen. One
 * section per hiker, each ending at a checkpoint.
 *
 * - **Off the trail** (the icon's middle outside the trail's edges): the
 *   active hiker's bar ticks down in real time ([2×] as fast off Ridgeline's
 *   drop). It never refills.
 * - **Ridgeline (Nov 26):** on scree, steering is half as strong and the
 *   hiker keeps sliding; wind gusts warn for [0.8 s], then push the hiker
 *   sideways for [1–1.5 s].
 * - **Reaching a checkpoint:** the hiker passes; "<NAME> MADE IT" for
 *   [0.8 s] while the scroll pauses; the next hiker takes over there.
 * - **Running out (Wyatt):** the hiker fails; after [1 s] the next hiker
 *   takes over from that spot (on the trail), and their checkpoint is the
 *   next one ahead. After the last hiker, if the end hasn't been reached,
 *   the first hiker who passed comes back with the bar they had left and
 *   goes on to the end; if they run out, they fail too, and the next one
 *   who passed comes back. It's over at the end of the trail, or when
 *   nobody who passed is left.
 * - **Results:** hikers who reach a checkpoint (and don't fail later on a
 *   comeback) pass and move on; those who fail go back and lose [1] energy;
 *   if nobody passes, the everyone-fails rule applies.
 *
 * Pure and seeded; scene units.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passingResult } from '../passing';
import type { MinigameResult, Pay, Tier } from '../types';
import { inStretch, makeCourse, middleAt, widthAt, type Course, type TrailType } from './course';

const T = BALANCE.minigames.trails;

export interface TrailsOptions {
  tier: Tier;
  type: TrailType;
  /** The Bar setting (seconds; "auto": the tier's). */
  barSec?: number | 'auto';
  /** The Section length setting ("auto": the tier's). */
  section?: number | 'auto';
  /** Ridgeline's hazards, each on unless switched off (testing). */
  gusts?: boolean;
  scree?: boolean;
  knives?: boolean;
  /** Prepare: a slower scroll (a share off), more bar for some hikers (seconds), a wider trail (units). */
  slower?: number;
  extraBar?: Readonly<Record<string, number>>;
  extraWidth?: number;
}

/** A wind gust on Ridgeline: which way it pushes, when it warns, starts pushing and ends. */
export interface Gust {
  dir: -1 | 1;
  warnAt: number;
  pushAt: number;
  endAt: number;
}

export type RunnerState = 'waiting' | 'now' | 'passed' | 'failed';
export type TrailsPhase = 'run' | 'made' | 'handover' | 'done';

export interface TrailsState {
  tier: Tier;
  type: TrailType;
  course: Course;
  scroll: number;
  section: number;
  barSec: number;
  order: readonly string[];
  /** Each hiker's off-trail bar left (seconds). */
  bars: Readonly<Record<string, number>>;
  status: Readonly<Record<string, RunnerState>>;
  /** Hikers who've had their comeback. */
  cameBack: readonly string[];
  runner: string | null;
  /** Where the runner is heading: their checkpoint, or the end on a comeback. */
  goal: number;
  comeback: boolean;
  /** The distance at the hiker, the hiker's x and sideways speed. */
  d: number;
  x: number;
  vx: number;
  /** Steering: keys (−1, 0, 1), or a pointer's x to head for. */
  steer: -1 | 0 | 1;
  target: number | null;
  off: boolean;
  phase: TrailsPhase;
  phaseLeft: number;
  /** Ridgeline: gusts on, the gust under way, and when the next one comes. */
  gusts: boolean;
  gust: Gust | null;
  nextGustAt: number;
  /** The last one to make it (for "<NAME> MADE IT") and the last one to run out. */
  made?: string;
  ranOut?: string;
  time: number;
  over: boolean;
  rng: RngState;
}

/** The checkpoints' distances: every section's end (the last is the trail's end). */
export const checkpoints = (s: Pick<TrailsState, 'section' | 'order'>): number[] =>
  s.order.map((_, k) => (k + 1) * s.section);

/** The next checkpoint strictly ahead of a distance (the end if none). */
export function nextCheckpoint(
  s: Pick<TrailsState, 'section' | 'order' | 'course'>,
  d: number,
): number {
  return checkpoints(s).find((c) => c > d + 1e-6) ?? s.course.length;
}

/** Whether the icon's middle is off the trail (Ridgeline's knife edges narrow it). */
export const isOff = (s: Pick<TrailsState, 'course' | 'd' | 'x'>): boolean =>
  Math.abs(s.x - middleAt(s.course, s.d)) > widthAt(s.course, s.d) / 2;

/** Whether the hiker is on scree (Ridgeline). */
export const onScree = (s: Pick<TrailsState, 'course' | 'd'>): boolean =>
  inStretch(s.course.scree, s.d);

const RG = T.ridge;
const span = (rng: RngState, [a, b]: readonly [number, number]) => a + nextFloat(rng) * (b - a);

export function newTrails(
  options: TrailsOptions,
  order: readonly string[],
  seed: number,
): TrailsState {
  const t = T.tiers[options.tier];
  const section = typeof options.section === 'number' ? options.section : t.section;
  const barSec = typeof options.barSec === 'number' ? options.barSec : t.barSec;
  const rng = seedRng(seed);
  const course = makeCourse(rng, options.tier, options.type, section * order.length, {
    section,
    knives: options.knives,
    scree: options.scree,
  });
  if (options.extraWidth) course.width += options.extraWidth;
  const ridge = options.type === 'ridgeline';
  const s: TrailsState = {
    tier: options.tier,
    type: options.type,
    course,
    scroll: t.scroll * (1 - (options.slower ?? 0)),
    section,
    barSec,
    order,
    bars: Object.fromEntries(order.map((id) => [id, barSec + (options.extraBar?.[id] ?? 0)])),
    status: Object.fromEntries(order.map((id) => [id, 'waiting' as RunnerState])),
    cameBack: [],
    runner: null,
    goal: section,
    comeback: false,
    d: 0,
    x: 160,
    vx: 0,
    steer: 0,
    target: null,
    off: false,
    phase: 'run',
    phaseLeft: 0,
    gusts: ridge && options.gusts !== false,
    gust: null,
    nextGustAt: span(rng, RG.tiers[options.tier].gustEvery),
    time: 0,
    over: order.length === 0,
    rng,
  };
  return s.over ? { ...s, phase: 'done' } : startNext(s);
}

/**
 * The next runner: the next hiker in line who hasn't run, heading for the
 * next checkpoint ahead; or, once everyone has, the next hiker who passed
 * (in line order) coming back for the end. None: it's over.
 */
function startNext(s: TrailsState): TrailsState {
  const fresh = s.order.find((id) => s.status[id] === 'waiting');
  const back = fresh
    ? null
    : s.order.find((id) => s.status[id] === 'passed' && !s.cameBack.includes(id));
  const who = fresh ?? back;
  if (!who || s.d >= s.course.length - 1e-6) return { ...s, runner: null, phase: 'done' };
  return {
    ...s,
    runner: who,
    comeback: !fresh,
    cameBack: fresh ? s.cameBack : [...s.cameBack, who],
    goal: fresh ? nextCheckpoint(s, s.d) : s.course.length,
    status: { ...s.status, [who]: fresh ? 'now' : s.status[who]! },
    // They start on the trail where the last one stopped.
    x: middleAt(s.course, s.d),
    vx: 0,
    off: false,
    phase: 'run',
    phaseLeft: 0,
  };
}

/** Keys: steer left (−1), right (1) or neither (0). */
export const steer = (s: TrailsState, dir: -1 | 0 | 1): TrailsState =>
  s.steer === dir ? s : { ...s, steer: dir };

/** A pointer: head for this x (null: let go). */
export const aim = (s: TrailsState, x: number | null): TrailsState => ({ ...s, target: x });

export function tick(s0: TrailsState, dt: number): TrailsState {
  if (s0.over) return s0;
  let s: TrailsState = { ...s0, time: s0.time + dt };
  if (s.phase === 'done') return { ...s, over: true };
  if (s.phase === 'made' || s.phase === 'handover') {
    const phaseLeft = s.phaseLeft - dt;
    return phaseLeft > 0 ? { ...s, phaseLeft } : startNext({ ...s, phaseLeft: 0 });
  }
  const id = s.runner;
  if (!id) return { ...s, phase: 'done' };

  // Sideways: speed up to the top speed in [0.1 s], toward the keys or the pointer.
  const top = T.topSpeed;
  const want =
    s.steer !== 0
      ? s.steer * top
      : s.target !== null
        ? Math.max(-top, Math.min(top, (s.target - s.x) * 12))
        : 0;
  // On scree, steering is half as strong, and momentum dies off three times slower.
  const slide = onScree(s);
  const rate = slide ? (want === 0 ? 1 / RG.screeSlide : RG.screeSteer) : 1;
  const accel = (top / T.accelSec) * dt * rate;
  const vx = s.vx + Math.max(-accel, Math.min(accel, want - s.vx));

  // Ridgeline's gusts: a warning, then a push sideways.
  let push = 0;
  if (s.gusts) {
    const rng: RngState = [...s.rng];
    let gust = s.gust;
    let nextGustAt = s.nextGustAt;
    if (!gust && s.time >= nextGustAt) {
      const pushAt = s.time + RG.gustWarnSec;
      gust = {
        dir: nextFloat(rng) < 0.5 ? -1 : 1,
        warnAt: s.time,
        pushAt,
        endAt: pushAt + span(rng, RG.gustSec),
      };
    }
    if (gust && s.time >= gust.pushAt && s.time < gust.endAt)
      push = gust.dir * RG.tiers[s.tier].push;
    if (gust && s.time >= gust.endAt) {
      gust = null;
      nextGustAt = s.time + span(rng, RG.tiers[s.tier].gustEvery);
    }
    s = { ...s, gust, nextGustAt, rng };
  }
  const x = Math.max(T.xRange[0], Math.min(T.xRange[1], s.x + (vx + push) * dt));
  const d = Math.min(s.goal, s.d + s.scroll * dt);
  s = { ...s, x, vx: x === T.xRange[0] || x === T.xRange[1] ? 0 : vx, d };

  // Off the trail: the bar drains.
  const off = isOff(s);
  s = { ...s, off };
  if (off) {
    // Off Ridgeline's drop drains twice as fast.
    const left = (s.bars[id] ?? 0) - dt * (s.type === 'ridgeline' ? RG.drain : 1);
    if (left <= 0) {
      return {
        ...s,
        bars: { ...s.bars, [id]: 0 },
        status: { ...s.status, [id]: 'failed' },
        ranOut: id,
        phase: 'handover',
        phaseLeft: T.handoverSec,
      };
    }
    s = { ...s, bars: { ...s.bars, [id]: left } };
  }

  // Made it: the checkpoint (or, on a comeback, the end).
  if (s.d >= s.goal - 1e-6) {
    const status = { ...s.status, [id]: 'passed' as RunnerState };
    const atEnd = s.d >= s.course.length - 1e-6;
    return { ...s, status, made: id, phase: atEnd ? 'done' : 'made', phaseLeft: T.madeSec };
  }
  return s;
}

/** Who passed (reached a checkpoint and didn't fail later); those who failed go back and lose [1] energy. */
export function result(s: TrailsState): MinigameResult {
  const passed = s.order.filter((id) => s.status[id] === 'passed');
  const costs: Record<string, Pay> = Object.fromEntries(
    s.order
      .filter((id) => s.status[id] !== 'passed')
      .map((id) => [id, { energy: BALANCE.minigames.quick.failEnergy }]),
  );
  return passingResult(s.order, s.tier, passed, costs);
}
