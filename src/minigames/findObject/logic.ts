/**
 * Find the Object (docs/design/11-minigames-puzzles.md, section 3): a crowd
 * of trail snacks pops up; find the ones you're asked for before time runs
 * out. Pure and seeded.
 *
 * - **Rounds** (3 by default): round 1 asks for one target per hiker still
 *   in, each later round one more.
 * - **Finding a target** checks a slot showing that same snack (the first
 *   unchecked one of that kind). A wrong click costs time.
 * - **End of a round:** each target still unfound puts one hiker out, from
 *   the back of the line, for the rest of the game. Hikers still in at the
 *   end pass.
 * - **Modes:** Still (Tier I), Windy (Tier II: everything drifts and wraps
 *   around), Dark (a flashlight follows the pointer: only what's in its
 *   light can be seen and picked), and Dark + windy (Tier III: both).
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult, Tier } from '../types';

const F = BALANCE.minigames.findObject;

export type { Tier };
export type Mode = 'still' | 'windy' | 'dark' | 'darkWindy';

export const isWindy = (m: Mode): boolean => m === 'windy' || m === 'darkWindy';
export const isDark = (m: Mode): boolean => m === 'dark' || m === 'darkWindy';

/** The 12 trail snacks (art/find-object/snacks/<name>.png, 16 × 16). Only their shapes differ. */
export const SNACKS = [
  'orange',
  'apple',
  'pear',
  'grapes',
  'banana',
  'strawberry',
  'cherries',
  'lemon',
  'peanut',
  'sandwich',
  'cookie',
  'carrot',
] as const;
export type Snack = (typeof SNACKS)[number];

/** A snack's size, in scene units. */
export const SNACK_SIZE = 16;
/** The field, below the HUD and above the line of hikers (scene units, 320 × 240). */
export const FIELD = { top: 30, bottom: 206 } as const;
const WIDTH = 320;

export interface Item {
  snack: Snack;
  /** Where it starts (top left, scene units). */
  x: number;
  y: number;
  target: boolean;
  found: boolean;
}

export interface FindObjectOptions {
  tier: Tier;
  /** The testing tab's overrides: "auto" uses the tier's (or the default) value. */
  mode: 'auto' | Mode;
  rounds?: 'auto' | number;
  secPerTarget?: 'auto' | number;
  extraSecPerRound?: 'auto' | number;
}

export interface FindObjectState {
  tier: Tier;
  mode: Mode;
  order: string[];
  rounds: number;
  /** 1-based. */
  round: number;
  /** The hikers still in, in line order. */
  line: string[];
  /** Hikers who went out, and the round they went out in. */
  out: Record<string, number>;
  /** This round's FIND slots, and which are checked. */
  targets: Snack[];
  found: boolean[];
  items: Item[];
  /** Windy: which way the wind blows this round. */
  wind: 1 | -1;
  secPerTarget: number;
  extraSecPerRound: number;
  timeTotal: number;
  timeLeft: number;
  /** Playing a round; a round just ended (`lost` went out); or the game is over. */
  phase: 'playing' | 'roundOver' | 'over';
  lost: string[];
  rng: RngState;
}

/** The mode a game plays in: the tier's, unless the testing tab says otherwise. */
export const modeFor = (o: FindObjectOptions): Mode =>
  o.mode === 'auto' ? F.tiers[o.tier].mode : o.mode;

const orAuto = (v: 'auto' | number | undefined, fallback: number) =>
  typeof v === 'number' ? v : fallback;

/** How much of a snack's area another one covers. */
function overlapShare(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const w = Math.max(0, SNACK_SIZE - Math.abs(a.x - b.x));
  const h = Math.max(0, SNACK_SIZE - Math.abs(a.y - b.y));
  return (w * h) / (SNACK_SIZE * SNACK_SIZE);
}

/** How many kinds of snack a round's targets can be. */
export function kindsFor(tier: Tier, round: number): number {
  const k = F.kinds[tier];
  return round >= k.fromRound ? k.more : k.start;
}

/**
 * How many targets a round asks for: one per hiker still in, plus one more
 * each round, plus the tier's extra (Tiers IV and V).
 */
export const targetsFor = (hikersIn: number, round: number, tier: Tier = 1): number =>
  Math.max(1, hikersIn) + F.extraTargetsPerRound * (round - 1) + F.tiers[tier].extraTargets;

/** The clock for a round: the extra seconds, plus seconds per target. */
export const timeFor = (
  s: Pick<FindObjectState, 'secPerTarget' | 'extraSecPerRound'>,
  targets: number,
) => s.extraSecPerRound + s.secPerTarget * targets;

/** Sets up a round: its targets (split as evenly as possible over its kinds), distractors and clock. */
function startRound(s: FindObjectState, round: number): FindObjectState {
  const rng = [...s.rng] as RngState;
  const count = targetsFor(s.line.length, round, s.tier);
  const kinds = Math.min(kindsFor(s.tier, round), count);
  const snacks = shuffle(rng, SNACKS).slice(0, kinds);
  const targets = Array.from({ length: count }, (_, i) => snacks[Math.floor((i * kinds) / count)]!);
  const others = SNACKS.filter((x) => !targets.includes(x));
  const tier = F.tiers[s.tier];
  const distractors =
    tier.distractors +
    F.extraDistractorsPerHiker * Math.max(0, s.line.length - 1) +
    F.extraDistractorsPerRound * (round - 1);
  const wanted: { snack: Snack; target: boolean }[] = [
    ...targets.map((snack) => ({ snack, target: true })),
    ...Array.from({ length: distractors }, () => ({
      snack: others[int(rng, 0, others.length - 1)]!,
      target: false,
    })),
  ];
  // Inside the field (and off the edges, except in the windy modes), overlapping no more than the tier allows.
  const margin = isWindy(s.mode) ? 0 : F.edgeMargin;
  const placed: Item[] = [];
  for (const w of shuffle(rng, wanted)) {
    let spot = { x: 0, y: 0 };
    for (let tryNo = 0; tryNo < 400; tryNo++) {
      spot = {
        x: margin + nextFloat(rng) * (WIDTH - 2 * margin - SNACK_SIZE),
        y: FIELD.top + nextFloat(rng) * (FIELD.bottom - FIELD.top - SNACK_SIZE),
      };
      // Late tries allow a little more overlap, so a crowded field always fits.
      const allowed = tier.overlap + Math.floor(tryNo / 100) * 0.1;
      if (placed.every((p) => overlapShare(p, spot) <= allowed + 1e-9)) break;
    }
    placed.push({ ...w, x: Math.round(spot.x), y: Math.round(spot.y), found: false });
  }
  const time = timeFor(s, count);
  return {
    ...s,
    rng,
    round,
    targets,
    found: targets.map(() => false),
    items: placed,
    wind: nextFloat(rng) < 0.5 ? -1 : 1,
    timeTotal: time,
    timeLeft: time,
    phase: 'playing',
    lost: [],
  };
}

export function newFindObject(
  options: FindObjectOptions,
  order: readonly string[],
  seed: number,
): FindObjectState {
  return startRound(
    {
      tier: options.tier,
      mode: modeFor(options),
      order: [...order],
      rounds: Math.max(1, Math.round(orAuto(options.rounds, F.rounds))),
      round: 1,
      line: [...order],
      out: {},
      targets: [],
      found: [],
      items: [],
      wind: 1,
      secPerTarget: orAuto(options.secPerTarget, F.tiers[options.tier].secPerTarget),
      extraSecPerRound: orAuto(options.extraSecPerRound, F.tiers[options.tier].extraSecPerRound),
      timeTotal: 0,
      timeLeft: 0,
      phase: 'playing',
      lost: [],
      rng: seedRng(seed),
    },
    1,
  );
}

/** Targets still to find this round. */
export const leftToFind = (s: FindObjectState): number => s.found.filter((f) => !f).length;

/** The hikers who'd go out if the clock ran out now: one per target left, from the back of the line. */
export function atRisk(s: FindObjectState): string[] {
  const n = Math.min(leftToFind(s), s.line.length);
  return n > 0 ? s.line.slice(-n) : [];
}

/**
 * The round ends: each target still unfound puts one hiker out, from the
 * back of the line. Then another round, or the end of the game.
 */
function endRound(s: FindObjectState): FindObjectState {
  const lost = atRisk(s);
  const out = { ...s.out };
  for (const id of lost) out[id] = s.round;
  const line = s.line.filter((id) => !lost.includes(id));
  const over = line.length === 0 || s.round >= s.rounds;
  return { ...s, out, line, lost, phase: over ? 'over' : 'roundOver' };
}

/** After a round's result: the next round. */
export function nextRound(s: FindObjectState): FindObjectState {
  return s.phase === 'roundOver' ? startRound(s, s.round + 1) : s;
}

/**
 * Where a snack is `t` seconds after the round's clock starts. In the windy
 * modes it drifts sideways with a small bob, coming back in on the other
 * side; otherwise it stays where it started.
 */
export function positionAt(s: FindObjectState, item: Item, t: number): { x: number; y: number } {
  if (!isWindy(s.mode)) return { x: item.x, y: item.y };
  const span = WIDTH + SNACK_SIZE;
  const raw = item.x + s.wind * F.tiers[s.tier].windSpeed * t + SNACK_SIZE;
  const x = (((raw % span) + span) % span) - SNACK_SIZE;
  const y = item.y + F.wind.bob * Math.sin((2 * Math.PI * t * 1000) / F.wind.bobEveryMs);
  return { x, y };
}

/** Dark: the flashlight's size at a tier. */
export const lightDiameter = (tier: Tier): number => F.tiers[tier].light;

/** Dark: whether a snack's middle is inside the flashlight's circle. */
export function inLight(
  at: { x: number; y: number },
  light: { x: number; y: number },
  tier: Tier = 1,
): boolean {
  const cx = at.x + SNACK_SIZE / 2;
  const cy = at.y + SNACK_SIZE / 2;
  return Math.hypot(cx - light.x, cy - light.y) <= lightDiameter(tier) / 2;
}

/**
 * The snack under a point (the one drawn on top), or none. In the dark modes
 * only snacks inside the light count. Snacks already found are gone.
 */
export function itemAt(
  s: FindObjectState,
  point: { x: number; y: number },
  t: number,
  light?: { x: number; y: number },
): number | null {
  for (let i = s.items.length - 1; i >= 0; i--) {
    const item = s.items[i]!;
    if (item.found) continue;
    const at = positionAt(s, item, t);
    const hit =
      point.x >= at.x &&
      point.x < at.x + SNACK_SIZE &&
      point.y >= at.y &&
      point.y < at.y + SNACK_SIZE;
    if (!hit) continue;
    if (isDark(s.mode) && (!light || !inLight(at, light, s.tier))) return null;
    return i;
  }
  return null;
}

/**
 * A click or tap on the field. A target: it's found, and the first unchecked
 * slot showing that same snack gets the check. Anything else under the
 * pointer: it costs 2 seconds. Nothing there: nothing happens.
 */
export function click(
  s: FindObjectState,
  point: { x: number; y: number },
  t: number,
  light?: { x: number; y: number },
): {
  state: FindObjectState;
  outcome: 'found' | 'wrong' | 'none';
  index: number | null;
  slot?: number;
} {
  if (s.phase !== 'playing') return { state: s, outcome: 'none', index: null };
  const i = itemAt(s, point, t, light);
  if (i === null) return { state: s, outcome: 'none', index: null };
  const item = s.items[i]!;
  if (!item.target) {
    const timeLeft = Math.max(0, s.timeLeft - F.wrongClickSec);
    const next = { ...s, timeLeft };
    return { state: timeLeft <= 0 ? endRound(next) : next, outcome: 'wrong', index: i };
  }
  const slot = s.targets.findIndex((snack, k) => snack === item.snack && !s.found[k]);
  const found = s.found.map((f, k) => f || k === slot);
  const items = s.items.map((it, k) => (k === i ? { ...it, found: true } : it));
  const next = { ...s, items, found };
  return {
    state: found.every(Boolean) ? endRound(next) : next,
    outcome: 'found',
    index: i,
    slot,
  };
}

/** Time passes on the clock; at 0 the round ends. */
export function tick(s: FindObjectState, seconds: number): FindObjectState {
  if (s.phase !== 'playing') return s;
  const timeLeft = Math.max(0, s.timeLeft - seconds);
  const next = { ...s, timeLeft };
  return timeLeft <= 0 ? endRound(next) : next;
}

/** Hikers still in at the end pass; hikers who went out fail. */
export function result(s: FindObjectState): MinigameResult {
  return passFailResult(s.order, (id) => s.out[id] === undefined);
}
