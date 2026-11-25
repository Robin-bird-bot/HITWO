/**
 * Find the Object (docs/design/11-minigames-puzzles.md, section 3): a crowd
 * of trail snacks pops up; find the ones you're asked for before time runs
 * out. Pure and seeded.
 *
 * One target per hiker. Each find keeps the next hiker in line safe: with k
 * found, the first k hikers pass. A wrong click costs time. Still on Tier I,
 * Windy on Tier II (everything drifts and wraps around), Dark on Tier III (a
 * flashlight follows the pointer, and only what's in its light can be seen
 * and picked).
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult } from '../types';

const F = BALANCE.minigames.findObject;

export type Tier = 1 | 2 | 3;
export type Mode = 'still' | 'windy' | 'dark';

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
  /** The testing tab's override: Auto (the tier's) or a mode. */
  mode: 'auto' | Mode;
}

export interface FindObjectState {
  tier: Tier;
  mode: Mode;
  order: string[];
  /** The FIND list, one per hiker; which ones are found doesn't matter, only how many. */
  targets: Snack[];
  found: number;
  items: Item[];
  /** Windy: which way the wind blows. */
  wind: 1 | -1;
  timeTotal: number;
  timeLeft: number;
  over: boolean;
  rng: RngState;
}

/** The mode a game plays in: the tier's, unless the testing tab says otherwise. */
export const modeFor = (o: FindObjectOptions): Mode =>
  o.mode === 'auto' ? F.tiers[o.tier].mode : o.mode;

/** How much of a snack's area another one covers. */
function overlapShare(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const w = Math.max(0, SNACK_SIZE - Math.abs(a.x - b.x));
  const h = Math.max(0, SNACK_SIZE - Math.abs(a.y - b.y));
  return (w * h) / (SNACK_SIZE * SNACK_SIZE);
}

/** The targets: all the same snack on Tier I; from Tier II a mix of 2 ("2 grapes and 2 oranges"). */
function pickTargets(rng: RngState, tier: Tier, count: number): Snack[] {
  const kinds = tier >= F.mixFromTier && count >= 2 ? F.mixKinds : 1;
  const snacks = shuffle(rng, SNACKS).slice(0, kinds);
  return Array.from({ length: count }, (_, i) => snacks[Math.floor((i * kinds) / count)]!);
}

export function newFindObject(
  options: FindObjectOptions,
  order: readonly string[],
  seed: number,
): FindObjectState {
  const rng = seedRng(seed);
  const mode = modeFor(options);
  const n = Math.max(1, order.length);
  const tier = F.tiers[options.tier];
  const targets = pickTargets(rng, options.tier, n);
  const others = SNACKS.filter((s) => !targets.includes(s));
  const distractors = tier.distractors + F.extraDistractorsPerHiker * (n - 1);
  const wanted: { snack: Snack; target: boolean }[] = [
    ...targets.map((snack) => ({ snack, target: true })),
    ...Array.from({ length: distractors }, () => ({
      snack: others[int(rng, 0, others.length - 1)]!,
      target: false,
    })),
  ];
  // Place them: inside the field (and off the edges, except in Windy), overlapping no more than the tier allows.
  const margin = mode === 'windy' ? 0 : F.edgeMargin;
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
  const time = F.timeSec + F.extraSecPerTarget * (n - 1);
  return {
    tier: options.tier,
    mode,
    order: [...order],
    targets,
    found: 0,
    items: placed,
    wind: nextFloat(rng) < 0.5 ? -1 : 1,
    timeTotal: time,
    timeLeft: time,
    over: false,
    rng,
  };
}

/**
 * Where a snack is `t` seconds after the clock starts. Windy: drifting
 * sideways with a small bob, coming back in on the other side; otherwise
 * where it started.
 */
export function positionAt(s: FindObjectState, item: Item, t: number): { x: number; y: number } {
  if (s.mode !== 'windy') return { x: item.x, y: item.y };
  const span = WIDTH + SNACK_SIZE;
  const raw = item.x + s.wind * F.wind.speed * t + SNACK_SIZE;
  const x = (((raw % span) + span) % span) - SNACK_SIZE;
  const y = item.y + F.wind.bob * Math.sin((2 * Math.PI * t * 1000) / F.wind.bobEveryMs);
  return { x, y };
}

/** Dark: whether a snack's middle is inside the flashlight's circle. */
export function inLight(at: { x: number; y: number }, light: { x: number; y: number }): boolean {
  const cx = at.x + SNACK_SIZE / 2;
  const cy = at.y + SNACK_SIZE / 2;
  return Math.hypot(cx - light.x, cy - light.y) <= F.light.diameter / 2;
}

/**
 * The snack under a point (the one drawn on top), or none. In the dark only
 * snacks inside the light count. Snacks already found are gone.
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
    if (s.mode === 'dark' && (!light || !inLight(at, light))) return null;
    return i;
  }
  return null;
}

/**
 * A click or tap on the field. A target: it's found, and the next hiker in
 * line is safe. Anything else under the pointer: it costs 2 seconds.
 * Nothing there: nothing happens.
 */
export function click(
  s: FindObjectState,
  point: { x: number; y: number },
  t: number,
  light?: { x: number; y: number },
): { state: FindObjectState; outcome: 'found' | 'wrong' | 'none'; index: number | null } {
  if (s.over) return { state: s, outcome: 'none', index: null };
  const i = itemAt(s, point, t, light);
  if (i === null) return { state: s, outcome: 'none', index: null };
  const item = s.items[i]!;
  if (!item.target) {
    const timeLeft = Math.max(0, s.timeLeft - F.wrongClickSec);
    return { state: { ...s, timeLeft, over: timeLeft <= 0 }, outcome: 'wrong', index: i };
  }
  const items = s.items.map((it, k) => (k === i ? { ...it, found: true } : it));
  const found = s.found + 1;
  return {
    state: { ...s, items, found, over: found >= s.targets.length },
    outcome: 'found',
    index: i,
  };
}

/** Time passes on the clock; at 0 it's over. */
export function tick(s: FindObjectState, seconds: number): FindObjectState {
  if (s.over) return s;
  const timeLeft = Math.max(0, s.timeLeft - seconds);
  return { ...s, timeLeft, over: timeLeft <= 0 };
}

/** With k targets found, the first k hikers in line pass and the rest fail. */
export function result(s: FindObjectState): MinigameResult {
  return passFailResult(s.order, (id) => s.order.indexOf(id) < s.found);
}
