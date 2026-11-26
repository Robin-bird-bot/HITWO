/**
 * Size Up (docs/design/18-minigames-quick.md, section 3): a ranger's field
 * guide shows a nature find at its actual size; the same thing lies on the
 * trail, the wrong size and turned around. Grow or shrink it to match.
 *
 * - One hiker at a time, one try each, with a new find each turn.
 * - The sketch is drawn at a random [2.5–3.5×] each turn; the find starts
 *   [20–40%] too big or too small, never within the pass range.
 * - Each press grows or shrinks it by the tier's step (a share of the
 *   sketch's size). Holding repeats every [0.1 s] after [0.35 s].
 * - Locking in (Space, Enter, LOCK IN, or the time running out) shows the
 *   reveal for [1.5 s]: "N% OFF", PASSED or FAILED.
 * - N = |their size ÷ the sketch's − 1| × 100, rounded; the same N decides
 *   passing (within the tier's %).
 *
 * Pure and seeded. The size is kept as a ratio of the sketch's size.
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

const SU = BALANCE.minigames.sizeUp;

/** The finds, in order: Tiers I and II use the first four. */
export const FINDS = [
  { id: 'pinecone', name: 'Pinecone' },
  { id: 'acorn', name: 'Acorn' },
  { id: 'mushroom', name: 'Mushroom' },
  { id: 'leaf', name: 'Maple leaf' },
  { id: 'feather', name: 'Feather' },
  { id: 'paw', name: 'Paw print' },
] as const;
export type FindId = (typeof FINDS)[number]['id'];

export const isFind = (v: unknown): v is FindId => FINDS.some((f) => f.id === v);

export interface SizeUpOptions {
  tier: Tier;
  /** The Find setting: "random" (the tier's finds) or one find every turn. */
  find?: FindId | 'random';
  /** The Time setting, seconds per hiker ("auto": the tier's). */
  timeSec?: number | 'auto';
}

export interface SizeUpReveal {
  ratio: number;
  off: number;
  passed: boolean;
  /** When it locked in (game time). */
  at: number;
}

export interface SizeUpState {
  tier: Tier;
  step: number;
  pass: number;
  timeSec: number;
  findSetting: FindId | 'random';
  turns: Turns;
  /** This hiker's turn. */
  find: FindId;
  sketchScale: number;
  /** The find's size as a share of the sketch's. */
  ratio: number;
  /** How it lies on the trail: turned (degrees) and maybe mirrored. */
  angle: number;
  mirrored: boolean;
  timeLeft: number;
  /** Held: growing or shrinking, how long, and when it repeats next. */
  held: 'grow' | 'shrink' | null;
  heldFor: number;
  repeatAt: number;
  /** Locked in: the reveal, until the turn ends. */
  locked: SizeUpReveal | null;
  /** Each hiker's turn, once done. */
  record: Readonly<Record<string, { find: FindId; off: number; passed: boolean }>>;
  time: number;
  over: boolean;
  rng: RngState;
}

/** How far off a size is, in whole percent: |ratio − 1| × 100, rounded (halves up, despite float error). */
export const offPercent = (ratio: number): number => Math.round(Math.abs(ratio - 1) * 100 + 1e-9);

/** Whether a size passes at a tier (within its %). */
export const passes = (ratio: number, pass: number): boolean => offPercent(ratio) <= pass;

const clampRatio = (r: number) =>
  Math.round(Math.min(SU.ratio[1], Math.max(SU.ratio[0], r)) * 10000) / 10000;

/** A fresh turn: a new find (not the last hiker's, when there's a choice), sketch size, start size and turn. */
function startTurn(s: SizeUpState, rng: RngState, first = false): SizeUpState {
  const t = SU.tiers[s.tier];
  const pool =
    s.findSetting === 'random' ? FINDS.slice(0, t.finds).map((f) => f.id) : [s.findSetting];
  const fresh = pool.length > 1 && !first ? pool.filter((f) => f !== s.find) : pool;
  const find = pick(rng, fresh);
  const sketchScale = SU.sketchScale[0] + nextFloat(rng) * (SU.sketchScale[1] - SU.sketchScale[0]);
  const off = SU.startOff[0] + nextFloat(rng) * (SU.startOff[1] - SU.startOff[0]);
  const ratio = clampRatio(nextFloat(rng) < 0.5 ? 1 - off : 1 + off);
  const angle = t.turn === 'upright' ? 0 : Math.round(nextFloat(rng) * 360);
  const mirrored = t.turn === 'mirror' && nextFloat(rng) < SU.mirrorChance;
  return {
    ...s,
    find,
    sketchScale,
    ratio,
    angle,
    mirrored,
    timeLeft: s.timeSec,
    held: null,
    heldFor: 0,
    repeatAt: 0,
    locked: null,
  };
}

export function newSizeUp(
  options: SizeUpOptions,
  order: readonly string[],
  seed: number,
): SizeUpState {
  const t = SU.tiers[options.tier];
  const rng = seedRng(seed);
  const s: SizeUpState = {
    tier: options.tier,
    step: t.step,
    pass: t.pass,
    timeSec: typeof options.timeSec === 'number' ? options.timeSec : t.timeSec,
    findSetting: options.find ?? 'random',
    turns: newTurns(order),
    find: 'pinecone',
    sketchScale: 3,
    ratio: 1,
    angle: 0,
    mirrored: false,
    timeLeft: 0,
    held: null,
    heldFor: 0,
    repeatAt: 0,
    locked: null,
    record: {},
    time: 0,
    over: order.length === 0,
    rng,
  };
  return startTurn(s, rng, true);
}

const canSize = (s: SizeUpState) => !s.over && playing(s.turns) && !s.locked;

/** One step bigger or smaller. */
const stepped = (s: SizeUpState, dir: 'grow' | 'shrink'): number =>
  clampRatio(s.ratio + (dir === 'grow' ? s.step : -s.step));

/** Press grow or shrink: one step now; holding repeats. */
export function press(s: SizeUpState, dir: 'grow' | 'shrink'): SizeUpState {
  if (!canSize(s)) return s;
  return { ...s, ratio: stepped(s, dir), held: dir, heldFor: 0, repeatAt: SU.holdSec };
}

/** Let go of grow or shrink. */
export const release = (s: SizeUpState): SizeUpState => (s.held ? { ...s, held: null } : s);

/** Lock the size in: the reveal starts. */
export function lockIn(s: SizeUpState): SizeUpState {
  if (!canSize(s)) return s;
  const off = offPercent(s.ratio);
  return { ...s, held: null, locked: { ratio: s.ratio, off, passed: off <= s.pass, at: s.time } };
}

function finish(s: SizeUpState, rng: RngState): SizeUpState {
  const id = current(s.turns);
  const passed = s.locked?.passed ?? false;
  const record = id
    ? { ...s.record, [id]: { find: s.find, off: s.locked?.off ?? offPercent(s.ratio), passed } }
    : s.record;
  const turns = endTurn(s.turns, passed);
  const next = { ...s, record, turns };
  if (allDone(turns)) return { ...next, over: true };
  return startTurn(next, rng);
}

export function tick(s0: SizeUpState, dt: number): SizeUpState {
  if (s0.over) return s0;
  let s: SizeUpState = { ...s0, time: s0.time + dt, turns: tickTurns(s0.turns, dt) };
  if (!playing(s.turns)) return s;
  if (s.locked) {
    if (s.time - s.locked.at < SU.revealSec) return s;
    const rng: RngState = [...s.rng];
    return { ...finish(s, rng), rng };
  }
  const timeLeft = s.timeLeft - dt;
  if (timeLeft <= 0) return lockIn({ ...s, timeLeft: 0 });
  s = { ...s, timeLeft };
  if (s.held) {
    const dir = s.held;
    let { ratio, repeatAt } = s;
    const heldFor = s.heldFor + dt;
    while (heldFor >= repeatAt) {
      ratio = clampRatio(ratio + (dir === 'grow' ? s.step : -s.step));
      repeatAt += SU.repeatSec;
    }
    s = { ...s, ratio, heldFor, repeatAt };
  }
  return s;
}

/** Who passed (locked in close enough); those who failed lose [1] energy. */
export const result = (s: SizeUpState): MinigameResult =>
  quickResult(s.turns.order, (id) => s.turns.done[id] === true);
