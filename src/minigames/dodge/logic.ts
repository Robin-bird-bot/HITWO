/**
 * Dodge (docs/design/12-minigames-dodge.md): an Undertale-style dodging game
 * for animal encounters. Pure and seeded, stepped in small fixed steps.
 *
 * - One sprite stands for the party, in the active hiker's color. Every few
 *   seconds the next hiker in line still in takes over (wrapping around).
 * - Whoever is active when the sprite is hit loses a life, then the sprite
 *   is safe for a moment. A hiker with no lives left is out for good; if the
 *   active hiker goes out, the next takes over at once.
 * - Survive until the clock runs out; it ends early if everyone is out.
 * - Every attack is warned first: "!" markers at the bees' entry points, or
 *   the half of the box a sword swing will sweep.
 *
 * Positions are in scene units (320 × 240).
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult } from '../types';

const D = BALANCE.minigames.dodge;

export type Tier = 1 | 2 | 3;
export type Animal = 'bees' | 'bear';

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  /** Middle and size. */
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** The box's middle on screen, per animal (the animal sits above it). */
export const BOX_AT: Readonly<Record<Animal, { cx: number; cy: number }>> = {
  bees: { cx: 160, cy: 138 },
  bear: { cx: 160, cy: 146 },
};

/** The sprite (person.png, 10 × 12): how far its edges are from its middle. */
export const SPRITE_HALF = { w: 5, h: 6 } as const;

/** A bee on its way. Before `activeAt` it's only a warning at its entry point. */
export interface Bee {
  kind: 'bee';
  id: number;
  /** Where it starts (just outside the box), and its velocity (units a second). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Zigzag: it weaves across its path. */
  weave?: { amplitude: number; perSec: number; nx: number; ny: number };
  /** Aimed: it aims at the sprite when it launches, at this speed. */
  aimSpeed?: number;
  warnAt: number;
  activeAt: number;
  /** Where its "!" goes, on the box's edge. */
  mark: Point;
  done: boolean;
}

/** A sword swing: the half of the box it'll sweep is warned, then the blade sweeps it. */
export interface Swing {
  kind: 'swing';
  id: number;
  side: 'left' | 'right';
  warnAt: number;
  activeAt: number;
  sweepSec: number;
  done: boolean;
}

export type Attack = Bee | Swing;

export interface DodgeOptions {
  animal: Animal;
  tier: Tier;
  /** The testing tab's overrides: "auto" uses the tier's value. */
  lives?: 'auto' | number;
  lengthSec?: 'auto' | number;
  switchSec?: 'auto' | number;
}

export interface DodgeState {
  animal: Animal;
  tier: Tier;
  order: string[];
  lives: Record<string, number>;
  hits: Record<string, number>;
  maxLives: number;
  active: string;
  switchSec: number;
  /** Seconds until the next hiker takes over. */
  switchIn: number;
  /** Seconds of safety left after a hit. */
  safeFor: number;
  lengthSec: number;
  /** Seconds played. */
  time: number;
  box: Box;
  boxTarget: { w: number; h: number };
  /** The sprite's middle. */
  pos: Point;
  attacks: Attack[];
  nextAttackAt: number;
  nextId: number;
  lastPattern?: string;
  /** Bear: swings so far, the last sides, and swings left with the box shrunk. */
  swings: number;
  sides: ('left' | 'right')[];
  shrunkFor: number;
  /** The last hit, for the screen ("FINN −1"). */
  lastHit?: { hikerId: string; at: number };
  over: boolean;
  rng: RngState;
}

const orAuto = (v: 'auto' | number | undefined, fallback: number) =>
  typeof v === 'number' ? v : fallback;

export function newDodge(
  options: DodgeOptions,
  order: readonly string[],
  seed: number,
): DodgeState {
  const lives = Math.max(1, Math.round(orAuto(options.lives, D.lives)));
  const size = options.animal === 'bees' ? D.bees.box : D.bear.box;
  const at = BOX_AT[options.animal];
  const box = { cx: at.cx, cy: at.cy, w: size[0], h: size[1] };
  const switchSec = orAuto(options.switchSec, D.switchSec);
  return {
    animal: options.animal,
    tier: options.tier,
    order: [...order],
    lives: Object.fromEntries(order.map((id) => [id, lives])),
    hits: Object.fromEntries(order.map((id) => [id, 0])),
    maxLives: lives,
    active: order[0] ?? '',
    switchSec,
    switchIn: switchSec,
    safeFor: 0,
    lengthSec: orAuto(options.lengthSec, D.tiers[options.tier].lengthSec),
    time: 0,
    box,
    boxTarget: { w: box.w, h: box.h },
    pos: { x: box.cx, y: box.cy },
    attacks: [],
    nextAttackAt: D.firstAttackSec,
    nextId: 1,
    swings: 0,
    sides: [],
    shrunkFor: 0,
    over: order.length === 0,
    rng: seedRng(seed),
  };
}

/** Hikers still in, in line order. */
export const stillIn = (s: DodgeState): string[] => s.order.filter((id) => (s.lives[id] ?? 0) > 0);

/** The next hiker in line after `from` who is still in (wrapping around), or none. */
export function nextInLine(s: DodgeState, from: string): string | undefined {
  const i = s.order.indexOf(from);
  for (let k = 1; k <= s.order.length; k++) {
    const id = s.order[(i + k) % s.order.length]!;
    if (id !== from && (s.lives[id] ?? 0) > 0) return id;
  }
  return undefined;
}

/** Whether a switch is coming (someone else is still in). */
export const switches = (s: DodgeState): boolean => nextInLine(s, s.active) !== undefined;

// ── Moving ─────────────────────────────────────────────────────────────────

/** WASD or the arrow keys, as a direction; diagonals are normalized. */
export function keysToVector(keys: ReadonlySet<string>): Point {
  const has = (...k: string[]) => k.some((x) => keys.has(x));
  const x = (has('ArrowRight', 'd', 'D') ? 1 : 0) - (has('ArrowLeft', 'a', 'A') ? 1 : 0);
  const y = (has('ArrowDown', 's', 'S') ? 1 : 0) - (has('ArrowUp', 'w', 'W') ? 1 : 0);
  const len = Math.hypot(x, y);
  return len ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}

/**
 * The floating joystick: the knob follows the finger up to `radius` from
 * where it landed, and the speed scales with the distance.
 */
export function joystickVector(
  start: Point,
  now: Point,
  radius: number = D.joystickPx,
): { move: Point; knob: Point } {
  const dx = now.x - start.x;
  const dy = now.y - start.y;
  const dist = Math.hypot(dx, dy);
  if (!dist) return { move: { x: 0, y: 0 }, knob: { ...start } };
  const k = Math.min(1, dist / radius);
  return {
    move: { x: (dx / dist) * k, y: (dy / dist) * k },
    knob: {
      x: start.x + (dx / dist) * Math.min(dist, radius),
      y: start.y + (dy / dist) * Math.min(dist, radius),
    },
  };
}

/** Keeps the sprite inside the box. */
export function clampToBox(p: Point, box: Box): Point {
  const minX = box.cx - box.w / 2 + SPRITE_HALF.w;
  const maxX = box.cx + box.w / 2 - SPRITE_HALF.w;
  const minY = box.cy - box.h / 2 + SPRITE_HALF.h;
  const maxY = box.cy + box.h / 2 - SPRITE_HALF.h;
  return { x: Math.min(maxX, Math.max(minX, p.x)), y: Math.min(maxY, Math.max(minY, p.y)) };
}

// ── Attacks ────────────────────────────────────────────────────────────────

type Side = 'left' | 'right' | 'top' | 'bottom';

/** A bee entering from a side at a place along it (0 to 1), flying straight across. */
function laneBee(
  s: DodgeState,
  side: Side,
  along: number,
  warnAt: number,
  speed: number,
  id: number,
): Bee {
  const b = s.box;
  const left = b.cx - b.w / 2;
  const top = b.cy - b.h / 2;
  const out = 6;
  const across = { left: [1, 0], right: [-1, 0], top: [0, 1], bottom: [0, -1] }[side];
  const x = side === 'left' ? left - out : side === 'right' ? left + b.w + out : left + along * b.w;
  const y = side === 'top' ? top - out : side === 'bottom' ? top + b.h + out : top + along * b.h;
  const mark = {
    x: side === 'left' ? left - 5 : side === 'right' ? left + b.w + 5 : x,
    y: side === 'top' ? top - 5 : side === 'bottom' ? top + b.h + 5 : y,
  };
  return {
    kind: 'bee',
    id,
    x,
    y,
    vx: across[0]! * speed,
    vy: across[1]! * speed,
    warnAt,
    activeAt: warnAt + D.warnSec,
    mark,
    done: false,
  };
}

const SIDES: readonly Side[] = ['left', 'right', 'top', 'bottom'];

/** The bees' patterns open to this tier. */
export function beePatterns(tier: Tier): string[] {
  return [
    'lane',
    'cross',
    ...(tier >= 2 ? ['diagonal', 'zigzag'] : []),
    ...(tier >= 3 ? ['aimed'] : []),
  ];
}

/** Lanes across the box with one gap lane. */
function laneWave(
  s: DodgeState,
  rng: RngState,
  side: Side,
  bees: number,
  at: number,
  speed: number,
  idStart: number,
): Bee[] {
  const lanes = bees + 1;
  const gap = int(rng, 0, lanes - 1);
  const out: Bee[] = [];
  let id = idStart;
  for (let k = 0; k < lanes; k++) {
    if (k === gap) continue;
    out.push(laneBee(s, side, (k + 0.5) / lanes, at, speed, id++));
  }
  return out;
}

function spawnBees(s: DodgeState, rng: RngState): { bees: Bee[]; pattern: string } {
  const options = beePatterns(s.tier).filter((p) => p !== s.lastPattern);
  const pattern = options[int(rng, 0, options.length - 1)]!;
  const speed = D.bees.speed * D.tiers[s.tier].speed;
  const at = s.time;
  const b = s.box;
  let id = s.nextId;
  if (pattern === 'lane') {
    const side = SIDES[int(rng, 0, 3)]!;
    return {
      pattern,
      bees: laneWave(s, rng, side, int(rng, D.bees.lane[0], D.bees.lane[1]), at, speed, id),
    };
  }
  if (pattern === 'cross') {
    const a = laneWave(s, rng, 'left', int(rng, D.bees.cross[0], D.bees.cross[1]), at, speed, id);
    id += a.length;
    const c = laneWave(s, rng, 'top', int(rng, D.bees.cross[0], D.bees.cross[1]), at, speed, id);
    return { pattern, bees: [...a, ...c] };
  }
  if (pattern === 'diagonal') {
    // From a corner to the opposite one, in a staggered line across the path.
    const dx = nextFloat(rng) < 0.5 ? 1 : -1;
    const dy = nextFloat(rng) < 0.5 ? 1 : -1;
    const corner = { x: b.cx - (dx * b.w) / 2 - dx * 6, y: b.cy - (dy * b.h) / 2 - dy * 6 };
    const dir = { x: dx / Math.SQRT2, y: dy / Math.SQRT2 };
    const perp = { x: -dir.y, y: dir.x };
    const n = D.bees.diagonal.bees;
    return {
      pattern,
      bees: Array.from({ length: n }, (_, k) => {
        const off = (k - (n - 1) / 2) * D.bees.diagonal.spacing;
        const x = corner.x + perp.x * off;
        const y = corner.y + perp.y * off;
        const warnAt = at + k * D.bees.diagonal.staggerSec;
        return {
          kind: 'bee' as const,
          id: id++,
          x,
          y,
          vx: dir.x * speed,
          vy: dir.y * speed,
          warnAt,
          activeAt: warnAt + D.warnSec,
          mark: { x: x + dir.x * 3, y: y + dir.y * 3 },
          done: false,
        };
      }),
    };
  }
  if (pattern === 'zigzag') {
    const side: Side = nextFloat(rng) < 0.5 ? 'left' : 'right';
    const n = D.bees.zigzag.bees;
    return {
      pattern,
      bees: Array.from({ length: n }, (_, k) => {
        const bee = laneBee(s, side, (k + 1) / (n + 1), at, speed * 0.8, id++);
        return {
          ...bee,
          weave: {
            amplitude: D.bees.zigzag.amplitude / 2,
            perSec: D.bees.zigzag.perSec,
            nx: 0,
            ny: 1,
          },
        };
      }),
    };
  }
  // Aimed: from random edge points, aimed at the sprite when each launches.
  const n = D.bees.aimed.bees;
  return {
    pattern,
    bees: Array.from({ length: n }, (_, k) => {
      const side = SIDES[int(rng, 0, 3)]!;
      const bee = laneBee(
        s,
        side,
        0.1 + nextFloat(rng) * 0.8,
        at + k * D.bees.aimed.staggerSec,
        speed,
        id++,
      );
      return { ...bee, aimSpeed: speed };
    }),
  };
}

/** The warning before a swing: it starts long and gets shorter each swing, never under the minimum. */
export const swingWarnSec = (swings: number): number =>
  Math.max(D.bear.warnMinSec, D.bear.warnStartSec * (1 - D.bear.warnShrink) ** swings);

export const swingSweepSec = (swings: number): number =>
  Math.max(D.bear.sweepMinSec, D.bear.sweepSec * (1 - D.bear.sweepShrink) ** swings);

/** One side, or the other at random, never the same side more than twice in a row. */
function pickSide(s: DodgeState, rng: RngState): 'left' | 'right' {
  const [a, b] = s.sides.slice(-2);
  if (a && a === b) return a === 'left' ? 'right' : 'left';
  return nextFloat(rng) < 0.5 ? 'left' : 'right';
}

function spawnSwings(
  s: DodgeState,
  rng: RngState,
): { swings: Swing[]; sides: ('left' | 'right')[]; shrink: boolean } {
  const side = pickSide(s, rng);
  const warn = swingWarnSec(s.swings);
  const sweep = swingSweepSec(s.swings);
  const first: Swing = {
    kind: 'swing',
    id: s.nextId,
    side,
    warnAt: s.time,
    activeAt: s.time + warn,
    sweepSec: sweep,
    done: false,
  };
  const out = [first];
  const sides = [side];
  if (s.tier >= 2 && nextFloat(rng) < D.bear.doubleChance) {
    // Straight back across the other half; its warning shows from the first sweep on.
    const other = side === 'left' ? 'right' : 'left';
    out.push({
      kind: 'swing',
      id: s.nextId + 1,
      side: other,
      warnAt: first.activeAt,
      activeAt: first.activeAt + sweep + D.bear.doubleGapSec,
      sweepSec: sweep,
      done: false,
    });
    sides.push(other);
  }
  const shrink = s.tier >= 3 && s.shrunkFor <= 0 && nextFloat(rng) < D.bear.shrinkChance;
  return { swings: out, sides, shrink };
}

// ── Where things are ───────────────────────────────────────────────────────

/** Where a bee is now (it flies once its warning is over; aimed bees aim at launch). */
export function beeAt(bee: Bee, time: number): Point {
  const t = Math.max(0, time - bee.activeAt);
  let x = bee.x + bee.vx * t;
  let y = bee.y + bee.vy * t;
  if (bee.weave) {
    const w = Math.sin(2 * Math.PI * bee.weave.perSec * t) * bee.weave.amplitude;
    x += bee.weave.nx * w;
    y += bee.weave.ny * w;
  }
  return { x, y };
}

/** The pivot the sword turns around, above the middle of the box. */
export const swordPivot = (box: Box): Point => ({
  x: box.cx,
  y: box.cy - box.h / 2 - D.bear.pivotAbove,
});

/**
 * The blade's angle from pointing straight down, toward the swing's side:
 * 0 at the start of the sweep, 90° (flat sideways) at the end.
 */
export function swingAngle(sw: Swing, time: number): number | null {
  if (time < sw.activeAt || time > sw.activeAt + sw.sweepSec) return null;
  return ((time - sw.activeAt) / sw.sweepSec) * (Math.PI / 2);
}

/** Whether a point is swept by a blade turning from angle a0 to a1 on a side (within the blade's reach). */
function swept(
  pivot: Point,
  side: 'left' | 'right',
  a0: number,
  a1: number,
  p: Point,
  reach: number,
): boolean {
  const dx = (p.x - pivot.x) * (side === 'right' ? 1 : -1);
  const dy = p.y - pivot.y;
  const dist = Math.hypot(dx, dy);
  if (dist > D.bear.blade + reach) return false;
  // The point's angle from straight down, toward the side.
  const angle = Math.atan2(dx, dy);
  const slack = dist > 0 ? Math.asin(Math.min(1, reach / dist)) : Math.PI;
  return angle >= a0 - slack && angle <= a1 + slack;
}

// ── A step ─────────────────────────────────────────────────────────────────

/** Someone is hit: the active hiker loses a life; at none, they're out and the next takes over. */
function hit(s: DodgeState): DodgeState {
  const who = s.active;
  const lives = { ...s.lives, [who]: Math.max(0, (s.lives[who] ?? 0) - 1) };
  const hits = { ...s.hits, [who]: (s.hits[who] ?? 0) + 1 };
  let next: DodgeState = {
    ...s,
    lives,
    hits,
    safeFor: D.safeSec,
    lastHit: { hikerId: who, at: s.time },
  };
  if (lives[who] === 0) {
    const nextUp = nextInLine(next, who);
    next = nextUp ? { ...next, active: nextUp, switchIn: next.switchSec } : { ...next, over: true };
  }
  return next;
}

/**
 * Moves the game on by `dt` seconds with the player's input (a direction,
 * up to length 1): the clock, switching, the box, the sprite, the attacks,
 * and hits.
 */
export function step(s0: DodgeState, dt: number, input: Point): DodgeState {
  if (s0.over) return s0;
  let s: DodgeState = { ...s0, time: s0.time + dt };
  const rng = [...s.rng] as RngState;
  s.rng = rng;

  // Switching hikers.
  if (switches(s)) {
    const switchIn = s.switchIn - dt;
    s =
      switchIn <= 0
        ? { ...s, active: nextInLine(s, s.active)!, switchIn: s.switchSec }
        : { ...s, switchIn };
  }
  s.safeFor = Math.max(0, s.safeFor - dt);

  // The box eases to its size; the sprite moves and stays inside.
  const ease = (from: number, to: number) => {
    const rate = (Math.abs(to - from) / D.boxEaseSec) * dt;
    return from < to
      ? Math.min(to, from + Math.max(rate, 60 * dt))
      : Math.max(to, from - Math.max(rate, 60 * dt));
  };
  s.box = { ...s.box, w: ease(s.box.w, s.boxTarget.w), h: ease(s.box.h, s.boxTarget.h) };
  const len = Math.hypot(input.x, input.y);
  const k = len > 1 ? 1 / len : 1;
  s.pos = clampToBox(
    { x: s.pos.x + input.x * k * D.moveSpeed * dt, y: s.pos.y + input.y * k * D.moveSpeed * dt },
    s.box,
  );

  // New attacks.
  if (s.time >= s.nextAttackAt) {
    if (s.animal === 'bees') {
      const wave = spawnBees(s, rng);
      const last = Math.max(...wave.bees.map((b) => b.activeAt));
      s = {
        ...s,
        attacks: [...s.attacks, ...wave.bees],
        nextId: s.nextId + wave.bees.length,
        lastPattern: wave.pattern,
        nextAttackAt: last + D.tiers[s.tier].gapSec,
      };
    } else {
      const wave = spawnSwings(s, rng);
      const end = Math.max(...wave.swings.map((w) => w.activeAt + w.sweepSec));
      const shrunkFor = wave.shrink ? D.bear.shrinkSwings : Math.max(0, s.shrunkFor - 1);
      const size = shrunkFor > 0 ? D.bear.shrunk : D.bear.box;
      s = {
        ...s,
        attacks: [...s.attacks, ...wave.swings],
        nextId: s.nextId + wave.swings.length,
        swings: s.swings + wave.swings.length,
        sides: [...s.sides, ...wave.sides].slice(-4),
        shrunkFor,
        boxTarget: { w: size[0], h: size[1] },
        nextAttackAt: end + D.tiers[s.tier].gapSec,
      };
    }
  }

  // Attacks move; any that touch the sprite hit (once its safety is over).
  const reach = D.hitRadius;
  let struck = false;
  const pivot = swordPivot(s.box);
  const attacks = s.attacks.map((a) => {
    if (a.done) return a;
    if (a.kind === 'bee') {
      let bee = a;
      // An aimed bee aims at the sprite as it launches.
      if (bee.aimSpeed && s.time >= bee.activeAt && s0.time < bee.activeAt) {
        const dx = s.pos.x - bee.x;
        const dy = s.pos.y - bee.y;
        const d = Math.hypot(dx, dy) || 1;
        bee = { ...bee, vx: (dx / d) * bee.aimSpeed, vy: (dy / d) * bee.aimSpeed };
      }
      if (s.time < bee.activeAt) return bee;
      const at = beeAt(bee, s.time);
      if (Math.hypot(at.x - s.pos.x, at.y - s.pos.y) <= D.bees.radius + reach) struck = true;
      // Gone once it has flown out of the box (it starts just outside, flying in).
      const outside =
        Math.abs(at.x - s.box.cx) > s.box.w / 2 + 12 ||
        Math.abs(at.y - s.box.cy) > s.box.h / 2 + 12;
      return outside && s.time - bee.activeAt > 0.3 ? { ...bee, done: true } : bee;
    }
    const a1 = swingAngle(a, s.time) ?? (s.time > a.activeAt ? Math.PI / 2 : null);
    if (a1 !== null) {
      const a0 = Math.max(0, swingAngle(a, s0.time) ?? 0);
      if (
        s0.time <= a.activeAt + a.sweepSec &&
        swept(pivot, a.side, a0, a1, s.pos, reach + D.bear.bladeHalfWidth)
      ) {
        struck = true;
      }
    }
    return s.time > a.activeAt + a.sweepSec ? { ...a, done: true } : a;
  });
  s = { ...s, attacks: attacks.filter((a) => !a.done || s.time - a.activeAt < 1) };
  if (struck && s.safeFor <= 0) s = hit(s);

  // The clock.
  if (s.time >= s.lengthSec) s = { ...s, over: true };
  return s;
}

/** A hiker with lives left passes, with their hits; a hiker who ran out fails. */
export function result(s: DodgeState): MinigameResult {
  return { ...passFailResult(s.order, (id) => (s.lives[id] ?? 0) > 0), hits: { ...s.hits } };
}
