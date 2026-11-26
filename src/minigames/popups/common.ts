/**
 * Small helpers the games' pop-up content shares: bars, rows, controls,
 * the usual If you fail lines, and reading settings.
 */
import { BALANCE } from '../../config/balance';
import { prepNumber, type PrepRow, type Thing } from '../prepare';
import { isTier, type MinigameSettings, type Tier } from '../types';
import type { Bar, ControlRow, IfFail, Input } from './types';

const P = BALANCE.minigames.prepare;

export const tierIn = (s: MinigameSettings): Tier => (isTier(s.tier) ? s.tier : 1);

/** A number setting, or the tier's value when it's Auto. */
export const numOr = (s: MinigameSettings, id: string, auto: number): number =>
  typeof s[id] === 'number' ? (s[id] as number) : auto;

/** A Prepare setting's total (0 when nothing is in its slots). */
export const prep = prepNumber;

/** A level bar (section 3): 10 segments, the tier setting the start ([tier + 3], TODO(wyatt)). */
export function levelBar(id: string, label: string, s: MinigameSettings, change: number): Bar {
  const base = Math.min(P.levels, tierIn(s) + P.levelFromTier);
  return { id, label, kind: 'level', base, value: Math.max(1, base + change), max: P.levels };
}

/** A count bar: one segment per unit, up to `max`. */
export const countBar = (
  id: string,
  label: string,
  base: number,
  value: number,
  max: number,
): Bar => ({
  id,
  label,
  kind: 'count',
  base,
  value,
  max: Math.max(max, base, value),
});

/** A time bar: one segment per [5 s] ([10 s] for long games). */
export function timeBar(id: string, label: string, base: number, value: number): Bar {
  const per = Math.max(base, value) > P.longGameSec ? P.longSegSec : P.segSec;
  return { id, label, kind: 'time', base, value, max: Math.ceil(Math.max(base, value) / per), per };
}

/** The share an engine's speed is cut by `levels` SLOWER slots (each [10%], TODO(wyatt)). */
export const slowerShare = (levels: number): number =>
  Math.min(0.6, Math.max(0, levels) * P.levelStep);

/** A Prepare row. */
export function row(
  id: string,
  label: string,
  line: string,
  accepts: readonly Thing[],
  effect: { param: string; step: number },
  more: Partial<Omit<PrepRow, 'id' | 'label' | 'line' | 'accepts' | 'effect'>> = {},
): PrepRow {
  return { id, label, line, accepts, effect, slots: 1, need: 1, ...more };
}

/** Prepare settings are kept apart from the testing tab's own: "prep.slower". */
export const P_ = (name: string) => `prep.${name}`;

// ── Controls ───────────────────────────────────────────────────────────────

export const key = (...k: string[]): Input[] => k.map((x) => ({ key: x }));
export const mouse = (word: string): Input => ({ mouse: word });
export const finger = (word: string): Input => ({ finger: word });
export const OR: Input = 'or';

export const WASD = key('W', 'A', 'S', 'D');
export const ARROWS = key('↑', '←', '↓', '→');

/** Tap or click, or a key. */
export const tapRow = (action: string, ...keys: string[]): ControlRow => ({
  action,
  inputs: [mouse('Click'), OR, finger('Tap'), ...(keys.length ? [OR, ...key(...keys)] : [])],
});

// ── If you fail ────────────────────────────────────────────────────────────

/** A quick game's: those who fail lose [1] energy. */
export const FAIL_ENERGY: readonly IfFail[] = [
  { who: 'each', label: 'Each hiker who fails:', value: '−1 Energy' },
];

/** A passing challenge's (14-minigames-trail-blocks.md): everyone pays when it isn't cleared. */
export const FAIL_PASSING: readonly IfFail[] = [
  { who: 'everyone', label: 'Not cleared:', value: 'everyone −1 Energy' },
];

/** Dodge's and the lane games': out of lives. */
export const FAIL_LIVES: readonly IfFail[] = [
  { who: 'each', label: 'Each hiker who runs out of lives:', value: '−1 Energy' },
];

/** "25 SECONDS", "1:30". */
export const seconds = (sec: number): string =>
  sec >= 90
    ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`
    : `${Math.round(sec)} SECONDS`;
