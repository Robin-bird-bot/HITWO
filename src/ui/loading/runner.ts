/**
 * The Runner loading screen (35-ui-overhaul.md, section 9; the prototype's
 * `SPR` and its loop in `screens.js`): a little hiker runs across a green
 * floor and hops over each tree, rock, log and bush (`load.jump`). At the
 * edge the obstacles sink into the floor, new ones pop up, and they turn and
 * run back. The movement is a pure step function, so it can be tested; the
 * screen draws it.
 */
import { BALANCE } from '../../config/balance';

const L = BALANCE.ui.overhaul.loading;

/** The sprites, one character a pixel: K ink, p and t mid green, g light green. */
export const SPRITES = {
  run1: [
    '....KKKK....',
    '...KKKKKK...',
    '..KKKKKKKK..',
    '....KKKK....',
    '....KKgK....',
    '....KKKK....',
    '..ppKKKK....',
    '.pppKKKKK...',
    '.pppKKKKKK..',
    '.pppKKKK.K..',
    '..ppKKKK....',
    '....KKKK....',
    '...KK..KK...',
    '..KK....KK..',
    '.KK......KK.',
    '.K........K.',
  ],
  run2: [
    '............',
    '....KKKK....',
    '...KKKKKK...',
    '..KKKKKKKK..',
    '....KKKK....',
    '....KKgK....',
    '....KKKK....',
    '..ppKKKK....',
    '.pppKKKKK...',
    '.pppKKKKKK..',
    '..ppKKKK.K..',
    '....KKKK....',
    '....KKK.....',
    '....KKKK....',
    '....K..K....',
    '...KK..KK...',
  ],
  jump: [
    '....KKKK....',
    '...KKKKKK...',
    '..KKKKKKKK..',
    '....KKKK....',
    '....KKgK....',
    '....KKKK.K..',
    '..ppKKKKKK..',
    '.pppKKKKK...',
    '.pppKKKK....',
    '.pppKKKK....',
    '..ppKKKK....',
    '...KKKKKK...',
    '..KK....KK..',
    '..K......K..',
    '............',
    '............',
  ],
  tree: [
    '.....K.....',
    '....KKK....',
    '....KKK....',
    '...KKKKK...',
    '..KKKKKKK..',
    '....KKK....',
    '...KKKKK...',
    '..KKKKKKK..',
    '.KKKKKKKKK.',
    '...KKKKK...',
    '..KKKKKKK..',
    '.KKKKKKKKK.',
    'KKKKKKKKKKK',
    '....ttt....',
    '....ttt....',
  ],
  rock: ['...KKKKK....', '..KKgKKKKK..', '.KKgKKKKKKK.', 'KKKKKKKKKKKK', 'KKKKKKKKKKKK'],
  log: ['.KKKKKKKKKK.', 'KgKKKKKKKKgK', 'KKKKKKKKKKKK', '.KKKKKKKKKK.'],
  bush: ['..KKK.KK..', '.KKKKKKKK.', 'KKKKgKKKKK', 'KKKKKKKKKK', '.KKKKKKKK.'],
} as const;

export type SpriteName = keyof typeof SPRITES;
export type Obstacle = 'tree' | 'rock' | 'log' | 'bush';
const KINDS: readonly Obstacle[] = ['tree', 'rock', 'log', 'bush'];

export const INK = '#1D2918';
export const MID = '#3C4E2F';
export const LIGHT = '#859A66';

export const spriteWidth = (name: SpriteName) => SPRITES[name][0]!.length * L.pixel;
export const spriteHeight = (name: SpriteName) => SPRITES[name].length * L.pixel;

/** Draws a sprite with its top left at (x, y), facing left when `flip`. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: SpriteName,
  x: number,
  y: number,
  flip = false,
): void {
  const rows = SPRITES[name];
  const w = rows[0]!.length;
  const px = L.pixel;
  rows.forEach((row, j) => {
    for (let i = 0; i < w; i++) {
      const ch = row[flip ? w - 1 - i : i];
      if (ch === '.') continue;
      ctx.fillStyle = ch === 'K' ? INK : ch === 'g' ? LIGHT : MID;
      ctx.fillRect(x + i * px, y + j * px, px, px);
    }
  });
}

/** The stage's floor line, and where the runner turns back. */
export const FLOOR = 750;
const LEFT = 120;
const RIGHT = 1480;
const SPOTS = [420, 710, 1000, 1280];

export interface RunnerState {
  x: number;
  dir: 1 | -1;
  /** Seconds into a hop, or -1 when on the ground. */
  hop: number;
  /** Turning at an edge: seconds into the swap, or -1 while running. */
  swap: number;
  obstacles: { x: number; kind: Obstacle; cleared: boolean }[];
  /** A counter for the next obstacles (no Math.random, so it plays the same). */
  seed: number;
}

const pick = (seed: number, i: number) => {
  const v = Math.sin(seed * 9.13 + i * 3.71) * 10000;
  return v - Math.floor(v);
};

function newObstacles(seed: number): RunnerState['obstacles'] {
  return SPOTS.map((x, i) => ({
    x: x + (pick(seed, i) - 0.5) * 100,
    kind: KINDS[Math.floor(pick(seed, i + 7) * KINDS.length)]!,
    cleared: false,
  }));
}

export function startRunner(): RunnerState {
  return { x: 160, dir: 1, hop: -1, swap: -1, obstacles: newObstacles(1), seed: 1 };
}

const SWAP_SINK = 0.4;
const SWAP_EMPTY = 0.45;
const SWAP_END = 0.9;

/** How far the obstacles have risen out of the floor (0–1). */
export function obstaclesUp(s: RunnerState): number {
  if (s.swap < 0) return 1;
  if (s.swap < SWAP_SINK) return 1 - s.swap / SWAP_SINK;
  if (s.swap < SWAP_EMPTY) return 0;
  return Math.min(1, (s.swap - SWAP_EMPTY) / 0.35);
}

/** The hop's height (stage px). */
export const hopHeight = (s: RunnerState): number =>
  s.hop < 0 ? 0 : Math.sin(Math.min(s.hop / (L.jumpMs / 1000), 1) * Math.PI) * L.jumpPx;

/** Moves the runner on by `dt` seconds. Returns what happened: a hop starting, or new obstacles. */
export function stepRunner(
  s: RunnerState,
  dt: number,
): { state: RunnerState; jumped: boolean; swapped: boolean } {
  const next: RunnerState = { ...s, obstacles: s.obstacles.map((o) => ({ ...o })) };
  let jumped = false;
  let swapped = false;
  if (next.hop >= 0) {
    next.hop += dt;
    if (next.hop >= L.jumpMs / 1000) next.hop = -1;
  }
  if (next.swap < 0) {
    next.x += next.dir * L.runSpeed * dt;
    for (const o of next.obstacles) {
      const ahead = next.dir > 0 ? o.x - next.x : next.x - o.x;
      if (!o.cleared && ahead > 40 && ahead < 120 && next.hop < 0) {
        o.cleared = true;
        next.hop = 0;
        jumped = true;
      }
    }
    if ((next.dir > 0 && next.x > RIGHT) || (next.dir < 0 && next.x < LEFT)) next.swap = 0;
  } else {
    const before = next.swap;
    next.swap += dt;
    if (before < SWAP_EMPTY && next.swap >= SWAP_EMPTY) {
      next.seed += 1;
      next.obstacles = newObstacles(next.seed);
      swapped = true;
    }
    if (next.swap >= SWAP_END) {
      next.swap = -1;
      next.dir = next.dir > 0 ? -1 : 1;
    }
  }
  return { state: next, jumped, swapped };
}
