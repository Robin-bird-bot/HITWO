/**
 * Camp Cleanup (docs/design/21-minigames-dodge-camp.md, section 4): the
 * party is one long line on a grid, like Google's snake, picking up trash
 * in their colors. It replaces Ants Are Marching.
 *
 * - **The snake** starts as the hikers in line order, one cell each, at the
 *   left middle heading right, and moves one cell every 1 ÷ the tier's speed.
 * - **Turning:** no reversing; up to [2] turns queue up, so quick turns
 *   like a U-turn work.
 * - **Trash:** one piece per hiker is out at a time, in their color, on a
 *   free cell at least [3] cells from the head. Picking it up adds a bag of
 *   that color at the end of the line on the next step, and a new piece
 *   shows up. A hiker's count is the number of their bags in the line.
 * - **Crashing** into a wall, an obstacle or the line itself: the snake
 *   stops for [0.6 s] and a random number of bags (the tier's range) fall
 *   off the end. Hiker cells are never lost. Then it waits up to [1.5 s] for
 *   a direction, or turns toward the side with the most room.
 * - **Obstacles** (Tier III and up): rocks, stumps, logs and tents, never on
 *   the start row or near the start, and never closing off part of the board.
 * - **The end:** when the time runs out, each hiker passes with at least
 *   their quota of bags; those who fail lose [1] energy.
 *
 * Pure and seeded. Cells are (x, y), x across, y down.
 */
import { BALANCE } from '../../config/balance';
import { int, pick, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { quickResult } from '../quick/turns';
import type { MinigameResult, Tier } from '../types';

const C = BALANCE.minigames.campCleanup;

export type Dir = 'up' | 'down' | 'left' | 'right';
export const STEP: Readonly<Record<Dir, { x: number; y: number }>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
export const OPPOSITE: Readonly<Record<Dir, Dir>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};
const DIRS: readonly Dir[] = ['up', 'right', 'down', 'left'];

export const TRASH_KINDS = ['can', 'bottle', 'wrapper', 'core'] as const;
export type TrashKind = (typeof TRASH_KINDS)[number];
export const OBSTACLE_KINDS = [
  { kind: 'rock', w: 1, h: 1 },
  { kind: 'stump', w: 1, h: 1 },
  { kind: 'log', w: 2, h: 1 },
  { kind: 'tent', w: 2, h: 2 },
] as const;

export interface Segment {
  x: number;
  y: number;
  /** A hiker's own cell, or one of their bags. */
  kind: 'hiker' | 'bag';
  owner: string;
}

export interface Trash {
  owner: string;
  kind: TrashKind;
  x: number;
  y: number;
}

export interface Obstacle {
  kind: (typeof OBSTACLE_KINDS)[number]['kind'];
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CampCleanupOptions {
  tier: Tier;
  /** Settings ("auto": the tier's), and Prepare's changes on top. */
  timeSec?: number | 'auto';
  quota?: number | 'auto';
  speed?: number | 'auto';
  obstacles?: 'auto' | 'on' | 'off';
  /** Prepare: more time, slower (a share off), fewer bags each, fewer obstacles. */
  extraSec?: number;
  slower?: number;
  fewerBags?: number;
  fewerObstacles?: number;
}

export type CampPhase = 'run' | 'crash' | 'wait' | 'done';

export interface CampCleanupState {
  tier: Tier;
  cols: number;
  rows: number;
  /** Seconds a step takes. */
  stepSec: number;
  timeSec: number;
  quota: number;
  order: readonly string[];
  /** The line, head first: the hikers, then the bags. */
  snake: Segment[];
  dir: Dir;
  /** Turns waiting to happen, in order. */
  queue: Dir[];
  /** Bags waiting to be added at the end (one a step). */
  pending: string[];
  trash: Trash[];
  obstacles: Obstacle[];
  phase: CampPhase;
  phaseLeft: number;
  stepLeft: number;
  timeLeft: number;
  /**
   * The countdown (26-fixes-and-wyatt-trees.md, section 2): seconds left once
   * every hiker has their quota, or null while someone is short. At 0 the
   * game ends and everyone passes.
   */
  countdown: number | null;
  countdownSec: number;
  /** The last crash: when, where the head hit, and the bags that fell off (for the screen). */
  lastCrash?: { at: number; lost: Segment[] };
  /** The last pickup (for a pop). */
  lastPickup?: { at: number; owner: string; x: number; y: number };
  time: number;
  over: boolean;
  rng: RngState;
}

const key = (x: number, y: number) => `${x},${y}`;
export const inside = (s: Pick<CampCleanupState, 'cols' | 'rows'>, x: number, y: number) =>
  x >= 0 && y >= 0 && x < s.cols && y < s.rows;

/** The cells an obstacle covers. */
export const cellsOf = (o: Obstacle): { x: number; y: number }[] =>
  Array.from({ length: o.w * o.h }, (_, k) => ({
    x: o.x + (k % o.w),
    y: o.y + Math.floor(k / o.w),
  }));

/** Each hiker's bag count. */
export const bagsOf = (s: Pick<CampCleanupState, 'snake'>, owner: string): number =>
  s.snake.filter((g) => g.kind === 'bag' && g.owner === owner).length;

const blockedCells = (s: Pick<CampCleanupState, 'obstacles'>): Set<string> =>
  new Set(s.obstacles.flatMap((o) => cellsOf(o).map((c) => key(c.x, c.y))));

/** How many free cells can be reached from a cell (a flood fill), with these cells blocked. */
export function room(
  s: Pick<CampCleanupState, 'cols' | 'rows'>,
  from: { x: number; y: number },
  blocked: ReadonlySet<string>,
): number {
  if (!inside(s, from.x, from.y) || blocked.has(key(from.x, from.y))) return 0;
  const seen = new Set([key(from.x, from.y)]);
  const todo = [from];
  while (todo.length) {
    const c = todo.pop()!;
    for (const d of DIRS) {
      const n = { x: c.x + STEP[d].x, y: c.y + STEP[d].y };
      const k = key(n.x, n.y);
      if (!inside(s, n.x, n.y) || blocked.has(k) || seen.has(k)) continue;
      seen.add(k);
      todo.push(n);
    }
  }
  return seen.size;
}

/** The start: the hikers in line order at the left middle, heading right. */
function startSnake(order: readonly string[], rows: number): Segment[] {
  const y = Math.floor(rows / 2);
  return order.map((owner, k) => ({ x: order.length - k, y, kind: 'hiker' as const, owner }));
}

/**
 * Obstacles (Tier III and up): never on the start row or within [3] cells
 * of the start, and never closing off part of the board (every free cell
 * stays reachable from the start).
 */
export function placeObstacles(
  rng: RngState,
  s: Pick<CampCleanupState, 'cols' | 'rows'>,
  count: number,
): Obstacle[] {
  const out: Obstacle[] = [];
  const startY = Math.floor(s.rows / 2);
  const total = s.cols * s.rows;
  for (let tries = 0; out.length < count && tries < 400; tries++) {
    const shape = pick(rng, OBSTACLE_KINDS);
    const o: Obstacle = {
      kind: shape.kind,
      w: shape.w,
      h: shape.h,
      x: int(rng, 0, s.cols - shape.w),
      y: int(rng, 0, s.rows - shape.h),
    };
    const cells = cellsOf(o);
    if (cells.some((c) => c.y === startY)) continue;
    if (cells.some((c) => c.x <= C.startClear + 6 && Math.abs(c.y - startY) <= C.startClear))
      continue;
    const blocked = blockedCells({ obstacles: [...out, o] });
    if (
      cells.some((c) =>
        out.some((p) => cellsOf(p).some((q) => Math.abs(q.x - c.x) + Math.abs(q.y - c.y) <= 1)),
      )
    )
      continue;
    // Everything free must still be reachable from the start.
    if (room(s, { x: 1, y: startY }, blocked) !== total - blocked.size) continue;
    out.push(o);
  }
  return out;
}

/** A free cell for a new piece of trash: not the line, an obstacle or other trash, and [3] or more cells from the head. */
function trashSpot(rng: RngState, s: CampCleanupState): { x: number; y: number } | null {
  const taken = new Set([
    ...s.snake.map((g) => key(g.x, g.y)),
    ...blockedCells(s),
    ...s.trash.map((t) => key(t.x, t.y)),
  ]);
  const head = s.snake[0]!;
  const free: { x: number; y: number }[] = [];
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      if (taken.has(key(x, y))) continue;
      if (Math.abs(x - head.x) + Math.abs(y - head.y) < C.trashAway) continue;
      free.push({ x, y });
    }
  }
  return free.length ? free[int(rng, 0, free.length - 1)]! : null;
}

function newTrash(rng: RngState, s: CampCleanupState, owner: string): CampCleanupState {
  const at = trashSpot(rng, s);
  if (!at) return s;
  return { ...s, trash: [...s.trash, { owner, kind: pick(rng, TRASH_KINDS), ...at }] };
}

export function newCampCleanup(
  options: CampCleanupOptions,
  order: readonly string[],
  seed: number,
): CampCleanupState {
  const t = C.tiers[options.tier];
  const rng = seedRng(seed);
  const speed =
    (typeof options.speed === 'number' ? options.speed : t.speed) * (1 - (options.slower ?? 0));
  const bigParty = order.length >= C.bigParty ? C.bigPartyLess : 0;
  const quota = Math.max(
    1,
    (typeof options.quota === 'number' ? options.quota : t.quota - bigParty) -
      (options.fewerBags ?? 0),
  );
  const obstacleCount =
    options.obstacles === 'off'
      ? 0
      : Math.max(
          0,
          (options.obstacles === 'on' ? Math.max(t.obstacles, C.tiers[3].obstacles) : t.obstacles) -
            (options.fewerObstacles ?? 0),
        );
  const timeSec =
    (typeof options.timeSec === 'number' ? options.timeSec : t.timeSec) + (options.extraSec ?? 0);
  const base = { cols: t.cols, rows: t.rows };
  let s: CampCleanupState = {
    tier: options.tier,
    ...base,
    stepSec: 1 / Math.max(0.5, speed),
    timeSec,
    quota,
    order,
    snake: startSnake(order, t.rows),
    dir: 'right',
    queue: [],
    pending: [],
    trash: [],
    obstacles: placeObstacles(rng, base, obstacleCount),
    phase: order.length ? 'run' : 'done',
    phaseLeft: 0,
    stepLeft: 1 / Math.max(0.5, speed),
    timeLeft: timeSec,
    countdown: null,
    countdownSec: t.countdownSec,
    time: 0,
    over: order.length === 0,
    rng,
  };
  for (const id of order) s = newTrash(rng, s, id);
  return s;
}

/** The way the snake will go next (the first queued turn, or straight on). */
const heading = (s: CampCleanupState): Dir => s.queue[s.queue.length - 1] ?? s.dir;

/** A direction pressed: queued (up to [2]); never a reverse of the way it's heading. While waiting after a crash, it goes at once. */
export function turn(s: CampCleanupState, d: Dir): CampCleanupState {
  if (s.over) return s;
  if (s.phase === 'wait') {
    const head = s.snake[0]!;
    const neck = s.snake[1];
    if (neck && neck.x === head.x + STEP[d].x && neck.y === head.y + STEP[d].y) return s;
    return { ...s, dir: d, queue: [], phase: 'run', stepLeft: 0 };
  }
  if (s.phase !== 'run') return s;
  const last = heading(s);
  if (d === last || d === OPPOSITE[last] || s.queue.length >= C.queue) return s;
  return { ...s, queue: [...s.queue, d] };
}

/** Where the head would go next, and whether that's a crash. */
function nextCell(s: CampCleanupState, d: Dir): { x: number; y: number; crash: boolean } {
  const head = s.snake[0]!;
  const x = head.x + STEP[d].x;
  const y = head.y + STEP[d].y;
  if (!inside(s, x, y) || blockedCells(s).has(key(x, y))) return { x, y, crash: true };
  // The tail moves out of the way this step unless a bag is about to be added.
  const body = s.pending.length ? s.snake : s.snake.slice(0, -1);
  return { x, y, crash: body.some((g) => g.x === x && g.y === y) };
}

/** A crash: the snake stops, and a random number of bags fall off the end (never a hiker). */
function crash(s: CampCleanupState, rng: RngState): CampCleanupState {
  const [a, b] = C.tiers[s.tier].crash;
  const bags = s.snake.filter((g) => g.kind === 'bag').length;
  const lose = Math.min(bags, int(rng, a, b));
  const lost = s.snake.slice(s.snake.length - lose);
  return {
    ...s,
    snake: s.snake.slice(0, s.snake.length - lose),
    pending: [],
    queue: [],
    phase: 'crash',
    phaseLeft: C.crashSec,
    lastCrash: { at: s.time, lost },
  };
}

/** One step along: the line follows the head; a bag waiting is added at the end; trash is picked up. */
function move(s: CampCleanupState, rng: RngState): CampCleanupState {
  const d = s.queue[0] ?? s.dir;
  const queue = s.queue.slice(1);
  const next = nextCell(s, d);
  if (next.crash) return crash({ ...s, dir: d, queue }, rng);
  const tail = s.snake[s.snake.length - 1]!;
  const moved = s.snake.map((g, k) => {
    const to = k === 0 ? next : s.snake[k - 1]!;
    return { ...g, x: to.x, y: to.y };
  });
  let pending = s.pending;
  if (pending.length) {
    moved.push({ x: tail.x, y: tail.y, kind: 'bag', owner: pending[0]! });
    pending = pending.slice(1);
  }
  let out: CampCleanupState = { ...s, snake: moved, dir: d, queue, pending };
  const got = out.trash.find((t) => t.x === next.x && t.y === next.y);
  if (got) {
    out = {
      ...out,
      trash: out.trash.filter((t) => t !== got),
      pending: [...out.pending, got.owner],
      lastPickup: { at: s.time, owner: got.owner, x: got.x, y: got.y },
    };
    out = newTrash(rng, out, got.owner);
  }
  return out;
}

/** After a crash with no direction given: the open way with the most room. */
function bestWay(s: CampCleanupState): Dir {
  const head = s.snake[0]!;
  const blocked = new Set([...blockedCells(s), ...s.snake.slice(0, -1).map((g) => key(g.x, g.y))]);
  let best: Dir = s.dir;
  let most = -1;
  for (const d of DIRS) {
    const n = { x: head.x + STEP[d].x, y: head.y + STEP[d].y };
    const r = room(s, n, blocked);
    if (r > most) {
      most = r;
      best = d;
    }
  }
  return best;
}

/** Does every hiker have their quota (or more) right now? */
export const everyoneHasEnough = (s: Pick<CampCleanupState, 'order' | 'snake' | 'quota'>) =>
  s.order.length > 0 && s.order.every((id) => bagsOf(s, id) >= s.quota);

export function tick(s0: CampCleanupState, dt: number): CampCleanupState {
  if (s0.over) return s0;
  const s = moveOn({ ...s0, time: s0.time + dt, timeLeft: s0.timeLeft - dt }, dt);
  // Time ran out first: the usual end.
  if (s.over) return s;
  return countDown(s, dt);
}

/**
 * The countdown: it starts when everyone has their quota, is cancelled when
 * a crash drops someone below it (and starts over from the full time when
 * they're back), and at 0 the game ends with everyone passing. The game's
 * own timer keeps running under it.
 */
function countDown(s: CampCleanupState, dt: number): CampCleanupState {
  if (!everyoneHasEnough(s)) return s.countdown === null ? s : { ...s, countdown: null };
  // The step it starts on doesn't count down yet.
  if (s.countdown === null) return { ...s, countdown: s.countdownSec };
  const countdown = s.countdown - dt;
  if (countdown > 0) return { ...s, countdown };
  return { ...s, countdown: 0, phase: 'done', over: true };
}

/** The line moves (or waits out a crash), and the time runs. */
function moveOn(s0: CampCleanupState, dt: number): CampCleanupState {
  let s = s0;
  if (s.timeLeft <= 0 || s.phase === 'done')
    return { ...s, timeLeft: Math.max(0, s.timeLeft), phase: 'done', over: true };
  const rng: RngState = [...s.rng];
  if (s.phase === 'crash') {
    const phaseLeft = s.phaseLeft - dt;
    return phaseLeft > 0 ? { ...s, phaseLeft } : { ...s, phase: 'wait', phaseLeft: C.waitSec };
  }
  if (s.phase === 'wait') {
    const phaseLeft = s.phaseLeft - dt;
    if (phaseLeft > 0) return { ...s, phaseLeft };
    return { ...s, dir: bestWay(s), phase: 'run', stepLeft: 0, rng };
  }
  let stepLeft = s.stepLeft - dt;
  while (stepLeft <= 0 && s.phase === 'run') {
    s = move({ ...s }, rng);
    stepLeft += s.stepSec;
  }
  return { ...s, stepLeft: Math.max(stepLeft, s.phase === 'run' ? 0 : s.stepSec), rng };
}

/** Each hiker passes with at least their quota of bags when time runs out; those who fail lose [1] energy. */
export const result = (s: CampCleanupState): MinigameResult =>
  quickResult(s.order, (id) => bagsOf(s, id) >= s.quota);
