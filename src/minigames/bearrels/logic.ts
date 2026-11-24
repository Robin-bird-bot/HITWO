/**
 * Bearrels' rules (docs/design/10-minigames.md, "Bearrels"), pure and seeded
 * so they can be tested. Hide hikers behind barrels; each round the bear
 * shoots 1 or 2 barrels (never the same one twice in a round), and anyone
 * behind a barrel it hits is out for the rest of the game. The game ends
 * after the last round, or once every hiker is out.
 *
 * The scene is laid out in its own units: a 1280 × 720 view.
 */
import { BALANCE } from '../../config/balance';
import { int, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import type { MinigameResult } from '../types';

const B = BALANCE.minigames.bearrels;

export const SCENE = { width: 1280, height: 720 } as const;

// ── Layout ─────────────────────────────────────────────────────────────────

export interface BarrelBox {
  /** Center. */
  x: number;
  width: number;
  height: number;
  top: number;
}

/**
 * The barrels in one row, evenly spaced from x 150 to 1130 (one barrel at
 * 640). Width min(150, 980 ÷ (n − 1) × 0.7); height width × 1.06; top at 418.
 */
export function barrelLayout(n: number): BarrelBox[] {
  const [from, to] = B.rowX;
  const span = to - from;
  const width =
    n <= 1 ? B.maxBarrelWidth : Math.min(B.maxBarrelWidth, (span / (n - 1)) * B.widthShare);
  const height = width * B.heightRatio;
  return Array.from({ length: n }, (_, i) => ({
    x: n <= 1 ? SCENE.width / 2 : from + (span / (n - 1)) * i,
    width,
    height,
    top: B.barrelTop,
  }));
}

/** Where the token bar and Ready start (scene units): nothing there may cover a barrel. */
export const BOTTOM_BAR_TOP = 612;

/** Where each hiker behind a barrel stands: their head's center and their scale. */
export function hikerSpots(
  barrel: BarrelBox,
  count: number,
): { x: number; y: number; scale: number }[] {
  const s = B.hikerScale;
  const base = count <= 1 ? s.one : count === 2 ? s.two : s.more;
  const scale = base * Math.min(1, barrel.width / B.maxBarrelWidth);
  const gap = B.hikerSpacing * scale;
  return Array.from({ length: count }, (_, i) => ({
    x: barrel.x + (i - (count - 1) / 2) * gap,
    y: barrel.top - B.headAbove * scale,
    scale,
  }));
}

// ── The game ───────────────────────────────────────────────────────────────

export interface BearrelsSettings {
  barrels: number;
  rounds: number;
  shots: number;
}

export type BearrelsPhase = 'placing' | 'shooting' | 'over';

export interface BearrelsState {
  settings: BearrelsSettings;
  /** The hikers, in token order. */
  hikers: string[];
  rng: RngState;
  /** 1-based. */
  round: number;
  phase: BearrelsPhase;
  /** Which barrel each hiker is behind (index), or none yet. Kept between rounds. */
  placed: Record<string, number>;
  /** Hikers who are out, and the round each was hit in. */
  out: Record<string, number>;
  /** The hiker picked to place next. */
  selected?: string;
  /** The barrel the keyboard's ← → points at. */
  highlight: number;
  /** This round's targets, picked when Ready is pressed (before the crosshair moves). */
  targets: number[];
  /** How many of this round's shots have been fired. */
  fired: number;
}

export function newGame(
  settings: BearrelsSettings,
  hikers: readonly string[],
  seed: number,
): BearrelsState {
  const clean = {
    barrels: Math.min(B.barrels.max, Math.max(B.barrels.min, Math.round(settings.barrels))),
    rounds: Math.min(B.rounds.max, Math.max(B.rounds.min, Math.round(settings.rounds))),
    shots: Math.min(B.shots.max, Math.max(B.shots.min, Math.round(settings.shots))),
  };
  const list = [...new Set(hikers)].slice(0, B.hikers.max);
  return {
    settings: clean,
    hikers: list,
    rng: seedRng(seed),
    round: 1,
    phase: 'placing',
    placed: {},
    out: {},
    ...(list[0] ? { selected: list[0] } : {}),
    highlight: 0,
    targets: [],
    fired: 0,
  };
}

/** Hikers still in the game. */
export const stillIn = (s: BearrelsState): string[] =>
  s.hikers.filter((h) => s.out[h] === undefined);

/** Hikers behind a barrel, in token order (the ones still in). */
export const behind = (s: BearrelsState, barrel: number): string[] =>
  stillIn(s).filter((h) => s.placed[h] === barrel);

/** The first hiker still in who isn't placed yet. */
const nextUnplaced = (s: BearrelsState): string | undefined =>
  stillIn(s).find((h) => s.placed[h] === undefined);

/** Pick a hiker to place (or move). Only while placing, and only a hiker still in. */
export function select(s: BearrelsState, hikerId: string): BearrelsState {
  if (s.phase !== 'placing' || s.out[hikerId] !== undefined || !s.hikers.includes(hikerId))
    return s;
  const at = s.placed[hikerId];
  return { ...s, selected: hikerId, ...(at !== undefined ? { highlight: at } : {}) };
}

/** Put the selected hiker behind a barrel; the next hiker not placed yet is picked. */
export function place(s: BearrelsState, barrel: number): BearrelsState {
  const who = s.selected;
  if (s.phase !== 'placing' || !who || s.out[who] !== undefined) return s;
  if (barrel < 0 || barrel >= s.settings.barrels) return s;
  const placed = { ...s.placed, [who]: barrel };
  const next = { ...s, placed, highlight: barrel };
  const unplaced = nextUnplaced(next);
  if (unplaced) next.selected = unplaced;
  else delete next.selected;
  return next;
}

/** Ready lights up once every hiker still in is placed. */
export const canReady = (s: BearrelsState): boolean =>
  s.phase === 'placing' &&
  stillIn(s).length > 0 &&
  stillIn(s).every((h) => s.placed[h] !== undefined);

/**
 * Ready: the bear picks this round's barrels now, every barrel equally
 * likely, never the same one twice in a round.
 */
export function ready(s: BearrelsState): BearrelsState {
  if (!canReady(s)) return s;
  const rng = [...s.rng] as RngState;
  const left = Array.from({ length: s.settings.barrels }, (_, i) => i);
  const targets: number[] = [];
  const shots = Math.min(s.settings.shots, left.length);
  for (let i = 0; i < shots; i++) {
    const [t] = left.splice(int(rng, 0, left.length - 1), 1);
    if (t !== undefined) targets.push(t);
  }
  const next: BearrelsState = { ...s, rng, phase: 'shooting', targets, fired: 0 };
  delete next.selected;
  return next;
}

/** The next shot of this round lands: everyone behind that barrel is out. Returns who was hit. */
export function fire(s: BearrelsState): { state: BearrelsState; barrel: number; hit: string[] } {
  const barrel = s.targets[s.fired];
  if (s.phase !== 'shooting' || barrel === undefined) return { state: s, barrel: -1, hit: [] };
  const hit = behind(s, barrel);
  const out = { ...s.out };
  for (const h of hit) out[h] = s.round;
  return { state: { ...s, out, fired: s.fired + 1 }, barrel, hit };
}

/** Every shot this round has been fired. */
export const roundDone = (s: BearrelsState): boolean =>
  s.phase === 'shooting' && s.fired >= s.targets.length;

/** The game is over after the last round, or once every hiker is out. */
export const isOver = (s: BearrelsState): boolean =>
  stillIn(s).length === 0 || (roundDone(s) && s.round >= s.settings.rounds);

/**
 * After the round's shots: the game ends, or the next round starts with the
 * hikers still in where they were (so Ready is lit at once).
 */
export function endRound(s: BearrelsState): BearrelsState {
  if (s.phase !== 'shooting') return s;
  if (isOver(s)) return { ...s, phase: 'over', targets: [], fired: 0 };
  // Everyone left is still placed: nobody is picked, and Ready is lit at once.
  return { ...s, round: s.round + 1, phase: 'placing', targets: [], fired: 0 };
}

/** Who was safe and who was hit, in token order. */
export function result(s: BearrelsState): MinigameResult {
  return {
    safe: stillIn(s),
    hit: s.hikers
      .filter((h) => s.out[h] !== undefined)
      .map((h) => ({ hikerId: h, round: s.out[h] ?? 0 })),
  };
}

/** "1 safe, 2 hit". */
export function resultLine(r: MinigameResult): string {
  return `${r.safe.length} safe, ${r.hit.length} hit`;
}

/** "Finn was hit!", "Ellie and Mom were hit!", "Finn, Ellie and Mom were hit!". */
export function hitLine(names: readonly string[]): string {
  if (names.length === 1) return `${names[0]} was hit!`;
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)} were hit!`;
}

// ── Keyboard ───────────────────────────────────────────────────────────────

export type KeyMove = { state: BearrelsState; pressedReady?: true; placed?: true };

/**
 * The keyboard while placing: 1–4 picks a hiker, ← → moves a highlight over
 * the barrels, and Enter or Space places the hiker there, or presses Ready
 * once everyone still in is placed (and nobody is picked to move).
 */
export function keyAction(s: BearrelsState, key: string): KeyMove {
  if (s.phase !== 'placing') return { state: s };
  const n = s.settings.barrels;
  if (/^[1-4]$/.test(key)) {
    const id = s.hikers[Number(key) - 1];
    return { state: id ? select(s, id) : s };
  }
  if (key === 'ArrowLeft') return { state: { ...s, highlight: (s.highlight - 1 + n) % n } };
  if (key === 'ArrowRight') return { state: { ...s, highlight: (s.highlight + 1) % n } };
  if (key === 'Enter' || key === ' ') {
    // A hiker is picked: place them. Nobody picked and everyone placed: Ready.
    if (s.selected) return { state: place(s, s.highlight), placed: true };
    if (canReady(s)) return { state: ready(s), pressedReady: true };
  }
  return { state: s };
}
