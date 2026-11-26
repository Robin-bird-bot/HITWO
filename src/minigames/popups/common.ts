/**
 * Small helpers the games' pop-up content shares (20-challenge-popup.md,
 * version 3): bars, Prepare options, rule lines, controls, the usual If
 * you fail lines, and reading settings.
 */
import { BALANCE } from '../../config/balance';
import { FOOD, prepNumber, type CardColor, type Option, type Thing } from '../prepare';
import { isTier, TIER_LABELS, TIERS, type MinigameSettings, type Tier } from '../types';
import type { Bar, ControlRow, IfFail, Input, Phrase, RuleLine } from './types';

const P = BALANCE.minigames.prepare;

export const tierIn = (s: MinigameSettings): Tier => (isTier(s.tier) ? s.tier : 1);

/** A number setting, or the tier's value when it's Auto. */
export const numOr = (s: MinigameSettings, id: string, auto: number): number =>
  typeof s[id] === 'number' ? (s[id] as number) : auto;

/** A Prepare setting's total (0 when nothing is in its slots). */
export const prep = prepNumber;

/** The most of something at any tier (a bar's full length, section 3). */
export const mostOver = (f: (t: Tier) => number): number => Math.max(...TIERS.map(f));

/** A level bar (section 3): to 10, the tier setting the start ([tier + 3], TODO(wyatt)). */
export function levelBar(id: string, label: string, s: MinigameSettings, change: number): Bar {
  const base = Math.min(P.levels, tierIn(s) + P.levelFromTier);
  return {
    id,
    label,
    kind: 'level',
    base,
    value: Math.max(1, Math.min(P.levels, base + change)),
    max: P.levels,
  };
}

/** A count bar: as long as the most it can be at any tier (`most`). */
export const countBar = (
  id: string,
  label: string,
  base: number,
  value: number,
  most: number,
): Bar => ({ id, label, kind: 'count', base, value, max: Math.max(most, base, value) });

/** A time bar: as long as the longest time at any tier (`most`), the value in seconds. */
export const timeBar = (
  id: string,
  label: string,
  base: number,
  value: number,
  most: number,
): Bar => ({
  id,
  label,
  kind: 'time',
  base,
  value,
  max: Math.max(most, base, value),
});

/** The share an engine's speed is cut by `levels` SLOWER uses (each [10%], TODO(wyatt)). */
export const slowerShare = (levels: number): number =>
  Math.min(0.6, Math.max(0, levels) * P.levelStep);

/** Prepare settings are kept apart from the testing tab's own: "prep.slower". */
export const P_ = (name: string) => `prep.${name}`;

/**
 * A Prepare option (section 4.7). `label` is its name, `short` its badge,
 * `note` the line under it; `max` its uses (each hiker's, when per-hiker).
 */
export function opt(
  id: string,
  color: CardColor,
  accepts: readonly Thing[],
  label: string,
  short: string,
  note: string,
  effect: { param: string; step: number },
  more: Partial<
    Omit<Option, 'id' | 'color' | 'accepts' | 'label' | 'short' | 'note' | 'param' | 'step'>
  > = {},
): Option {
  return {
    id,
    title: label,
    color,
    accepts,
    need: 1,
    label,
    short,
    note,
    max: 1,
    param: effect.param,
    step: effect.step,
    ...more,
  };
}

/** +1 heart, life, try or bar for one hiker: Food, once each (section 7). */
export const plusFor = (
  word: string,
  short = `+1`,
  param = 'lives',
  note = 'pick a hiker',
): Option =>
  opt(
    param,
    'green',
    FOOD,
    `+1 ${word}`,
    short,
    note,
    { param: P_(param), step: 1 },
    { perHiker: true },
  );

/** Slower: Food, [2] at most. */
export const slowerOpt = (label: string, color: CardColor = 'red', note = '−1 speed'): Option =>
  opt('slower', color, FOOD, label, 'SLOW', note, { param: P_('slower'), step: 1 }, { max: 2 });

/** +N seconds: Food, [2] at most. */
export const plusSecOpt = (sec: number): Option =>
  opt(
    'extraSec',
    'green',
    FOOD,
    `+${sec} S`,
    `+${sec}S`,
    `+${sec} seconds`,
    { param: P_('extraSec'), step: sec },
    { max: 2 },
  );

// ── How to play ────────────────────────────────────────────────────────────

/** "FROM TIER II", "TIER III AND UP" for a line the tier brings. */
export const fromTier = (t: Tier): string => `TIER ${TIER_LABELS[t]} AND UP`;

/** A rule line: plain text, with a red phrase where it's wrapped in **…**. */
export function line(text: string, when?: string): RuleLine {
  return { text: phrases(text), ...(when ? { when } : {}) };
}

/** "Text with **the red part** in it." as phrases. */
export function phrases(text: string): Phrase[] {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((p) => (p.startsWith('**') ? { text: p.slice(2, -2), red: true as const } : { text: p }));
}

/** Rule lines that apply: each a line, or null when it doesn't (at most [4]). */
export const rulesOf = (...lines: (RuleLine | null | false | undefined)[]): RuleLine[] =>
  lines.filter((l): l is RuleLine => !!l).slice(0, P.ruleLines);

/** "1 hiker", "3 hikers". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** How many hikers take part (the testing tab's or the party's). */
export const hikerCount = (s: MinigameSettings): number =>
  Array.isArray(s.hikers) ? s.hikers.length : 3;

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

/** "25 SECONDS", "1:30". */
export const seconds = (sec: number): string =>
  sec >= 90
    ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`
    : `${Math.round(sec)} SECONDS`;
