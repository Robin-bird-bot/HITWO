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
 * - **Attacks** come from the shared library (library.ts), one round at a
 *   time: picked at random from the animal's list (animals.ts), only what's
 *   unlocked at the tier, never the same attack twice in a row. In the
 *   Stampede the box and the head follow whoever is attacking, no animal
 *   attacks more than twice in a row, and on Tier III two attacks sometimes
 *   overlap.
 * - Every attack warns first. Honey puddles slow the sprite; a bear hug or
 *   a shrinking box pushes it back inside.
 *
 * Positions are in scene units (320 × 240).
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult } from '../types';
import { boxFor, isAnimal, pool, type PoolEntry } from './animals';
import { puddleShape, squeezed } from './attacks/claudesIdeas';
import { clampToBox, type Box } from './geometry';
import { ATTACKS, rulesFor } from './library';
import { touches, type Point, type Shape } from './shapes';
import type {
  AnimalId,
  AttackCtx,
  AttackId,
  Attacker,
  DodgeState,
  Part,
  Round,
  Tier,
  World,
} from './types';

export type { AnimalId, AttackId, Attacker, DodgeState, Part, Tier } from './types';
export type { Box } from './geometry';
export type { Point, Shape } from './shapes';
export { clampToBox, SPRITE_HALF } from './geometry';
export { beeAt } from './attacks/bees';
export { swingAngle, swingWarnSec, swordPivot } from './attacks/sword';

const D = BALANCE.minigames.dodge;

export interface DodgeOptions {
  animal: AnimalId;
  tier: Tier;
  /** The testing tab's Attack picker: all, or only one attack. */
  attack?: AttackId | 'all';
  /** Include Claude's ideas (on unless switched off). */
  ideas?: boolean;
  /** The testing tab's overrides: "auto" uses the tier's value. */
  lives?: 'auto' | number;
  lengthSec?: 'auto' | number;
  switchSec?: 'auto' | number;
}

const orAuto = (v: 'auto' | number | undefined, fallback: number) =>
  typeof v === 'number' ? v : fallback;

/** The length when Auto: the tier's, plus extra for the Stampede. */
export const autoLength = (animal: AnimalId, tier: Tier): number =>
  D.tiers[tier].lengthSec + (animal === 'stampede' ? D.stampede.extraSec : 0);

/** The box an attacker uses (the sword bear's shrinks while `shrunkFor` lasts). */
function targetBox(attacker: Attacker, shrunkFor: number): Box {
  const box = boxFor(attacker);
  if (attacker === 'swordBear' && shrunkFor > 0) {
    return { ...box, w: D.sword.shrunk[0], h: D.sword.shrunk[1] };
  }
  return box;
}

export function newDodge(
  options: DodgeOptions,
  order: readonly string[],
  seed: number,
): DodgeState {
  const animal: AnimalId = isAnimal(options.animal) ? options.animal : 'bees';
  const ideas = options.ideas ?? true;
  const lives = Math.max(1, Math.round(orAuto(options.lives, D.lives)));
  // A picked attack this animal can't make at this tier plays as All.
  const wanted = options.attack ?? 'all';
  const only =
    wanted !== 'all' && pool(animal, options.tier, ideas, wanted).length > 0 ? wanted : 'all';
  const first: Attacker = animal === 'stampede' ? 'herd' : animal;
  const box = targetBox(first, 0);
  const switchSec = orAuto(options.switchSec, D.switchSec);
  return {
    animal,
    tier: options.tier,
    only,
    ideas,
    order: [...order],
    lives: Object.fromEntries(order.map((id) => [id, lives])),
    hits: Object.fromEntries(order.map((id) => [id, 0])),
    maxLives: lives,
    active: order[0] ?? '',
    switchSec,
    switchIn: switchSec,
    safeFor: 0,
    lengthSec: orAuto(options.lengthSec, autoLength(animal, options.tier)),
    time: 0,
    box,
    boxTarget: box,
    pos: { x: box.cx, y: box.cy },
    parts: [],
    rounds: [],
    history: [],
    nextAttackAt: D.firstAttackSec,
    showing: animal === 'stampede' ? [] : [animal],
    nextId: 1,
    roundNo: 1,
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

/** The box as the sprite feels it now: squeezed by a bear hug, if one is on. */
export const effectiveBox = (s: DodgeState): Box => squeezed(s.box, s.parts, s.time);

/** Whether the sprite is in a honey puddle (it moves slower there). */
export const inHoney = (s: DodgeState): boolean =>
  s.parts.some((p) => p.kind === 'puddle' && touches(puddleShape(p), s.pos, D.hitRadius));

// ── Picking attacks ────────────────────────────────────────────────────────

/**
 * The next attack: from the pool, never the same attack twice in a row
 * (unless it's the only one), and in the Stampede no animal more than twice
 * in a row. An overlap (`notBy`) is always another animal, or none.
 */
function pick(s: DodgeState, rng: RngState, notBy?: Attacker): PoolEntry | undefined {
  const all = pool(s.animal, s.tier, s.ideas, s.only);
  if (!all.length) return undefined;
  const last = s.history.at(-1);
  const recent = s.history.slice(-D.stampede.maxSameAnimal).map((h) => h.attacker);
  const tooMany =
    s.animal === 'stampede' &&
    recent.length === D.stampede.maxSameAnimal &&
    recent.every((a) => a === recent[0])
      ? recent[0]
      : undefined;
  const tries = [
    (e: PoolEntry) => e.attack !== last?.attack && e.attacker !== tooMany && e.attacker !== notBy,
    (e: PoolEntry) => e.attack !== last?.attack && e.attacker !== notBy,
    (e: PoolEntry) => e.attacker !== notBy,
    // An overlap is always two different animals: with no other, there's none.
    ...(notBy ? [] : [() => true]),
  ];
  for (const ok of tries) {
    const list = all.filter(ok);
    if (list.length) return list[int(rng, 0, list.length - 1)];
  }
  return undefined;
}

/** Starts a round of an attack: its parts, the box it happens in, and what's remembered. */
function startRound(s: DodgeState, rng: RngState, entry: PoolEntry, moveBox: boolean): DodgeState {
  let state = s;
  // The sword bear's shrunk box lasts for a few of its attacks.
  if (entry.attacker === 'swordBear')
    state = { ...state, shrunkFor: Math.max(0, state.shrunkFor - 1) };
  const box = moveBox ? targetBox(entry.attacker, state.shrunkFor) : state.boxTarget;
  let nextId = state.nextId;
  const ctx: AttackCtx = {
    tier: state.tier,
    time: state.time,
    box,
    pos: { ...state.pos },
    rng,
    speed: D.tiers[state.tier].speed,
    round: state.roundNo,
    nextId: () => nextId++,
    tweak: entry.tweak,
    state,
  };
  const started = ATTACKS[entry.attack].start(ctx);
  const next: DodgeState = {
    ...state,
    ...started.patch,
    parts: [...state.parts, ...started.parts],
    rounds: [
      ...state.rounds,
      { no: state.roundNo, attacker: entry.attacker, attack: entry.attack, endsAt: started.endsAt },
    ],
    history: [...state.history, { attacker: entry.attacker, attack: entry.attack }].slice(-6),
    nextId,
    roundNo: state.roundNo + 1,
  };
  const showing = next.rounds.map((r) => r.attacker);
  return {
    ...next,
    showing: [...new Set(showing)],
    boxTarget: moveBox ? targetBox(entry.attacker, next.shrunkFor) : next.boxTarget,
  };
}

/** Whether a round is over: its time has come, or all its parts are done. */
function roundOver(s: DodgeState, r: Round): boolean {
  if (r.endsAt !== 'parts') return s.time >= r.endsAt;
  return !s.parts.some((p) => p.round === r.no && !p.child);
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

/** The box eases toward its target: size and place. */
function easeBox(box: Box, target: Box, dt: number): Box {
  const ease = (from: number, to: number) => {
    const rate = (Math.abs(to - from) / D.boxEaseSec) * dt;
    return from < to
      ? Math.min(to, from + Math.max(rate, 60 * dt))
      : Math.max(to, from - Math.max(rate, 60 * dt));
  };
  return {
    cx: ease(box.cx, target.cx),
    cy: ease(box.cy, target.cy),
    w: ease(box.w, target.w),
    h: ease(box.h, target.h),
  };
}

const worldOf = (s: DodgeState, dt: number, rng: RngState, ids: { next: number }): World => ({
  time: s.time,
  dt,
  tier: s.tier,
  box: effectiveBox(s),
  pos: s.pos,
  rng,
  nextId: () => ids.next++,
});

/**
 * Every shape that can hit right now, for the testing tab's "Show hitboxes"
 * (a hit that only happens at one moment, like a bite's snap, shows for
 * `window` seconds after it).
 */
export function hitShapes(s: DodgeState, window = 0.15): Shape[] {
  const w = worldOf(s, 0, [...s.rng] as RngState, { next: s.nextId });
  return s.parts.flatMap((p) => rulesFor(p).shapes(p, w, s.time - window));
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

  // The box eases to its size; the sprite moves (slower in honey) and stays inside.
  s.box = easeBox(s.box, s.boxTarget, dt);
  const len = Math.hypot(input.x, input.y);
  const k = (len > 1 ? 1 / len : 1) * (inHoney(s) ? D.honey.slow : 1);
  s.pos = clampToBox(
    { x: s.pos.x + input.x * k * D.moveSpeed * dt, y: s.pos.y + input.y * k * D.moveSpeed * dt },
    effectiveBox(s),
  );

  // A new round; in the Stampede on Tier III, sometimes a second one overlapping it.
  if (s.nextAttackAt !== null && s.time >= s.nextAttackAt) {
    const entry = pick(s, rng);
    if (entry) {
      s = startRound({ ...s, rounds: [], nextAttackAt: null }, rng, entry, true);
      const st = D.stampede;
      if (
        s.animal === 'stampede' &&
        s.tier >= st.overlapFrom &&
        nextFloat(rng) < st.overlapChance
      ) {
        s.overlapAt = s.time + st.overlapAfterSec;
      }
    } else {
      s = { ...s, nextAttackAt: Infinity };
    }
  }
  if (s.overlapAt !== undefined && s.time >= s.overlapAt) {
    const entry = pick(s, rng, s.rounds[0]?.attacker);
    s = { ...s };
    delete s.overlapAt;
    // The box stays the first animal's while they overlap.
    if (entry) s = startRound(s, rng, entry, false);
  }

  // The parts move (and can make new ones: shrapnel, crumbs, puddles).
  const ids = { next: s.nextId };
  const w = worldOf(s, dt, rng, ids);
  const parts: Part[] = [];
  for (const p0 of s.parts) {
    const rules = rulesFor(p0);
    const moved = rules.update ? rules.update(p0, w) : { part: p0 };
    if (!rules.done(moved.part, w)) parts.push(moved.part);
    if (moved.spawn) parts.push(...moved.spawn);
  }
  s = { ...s, parts, nextId: ids.next };

  // Any that touch the sprite hit (once its safety is over).
  if (s.safeFor <= 0) {
    const shapes = s.parts.flatMap((p) =>
      rulesFor(p).shapes(p, { ...w, box: effectiveBox(s) }, s0.time),
    );
    if (shapes.some((sh) => touches(sh, s.pos, D.hitRadius))) s = hit(s);
  }
  // The sprite is pushed back inside if the box moved under it.
  s = { ...s, pos: clampToBox(s.pos, effectiveBox(s)) };

  // The round ends: the next one comes after the tier's gap.
  if (
    s.nextAttackAt === null &&
    s.overlapAt === undefined &&
    s.rounds.every((r) => roundOver(s, r))
  ) {
    s = { ...s, nextAttackAt: s.time + D.tiers[s.tier].gapSec };
  }

  // The clock.
  if (s.time >= s.lengthSec) s = { ...s, over: true };
  return s;
}

/** A hiker with lives left passes, with their hits; a hiker who ran out fails. */
export function result(s: DodgeState): MinigameResult {
  return { ...passFailResult(s.order, (id) => (s.lives[id] ?? 0) > 0), hits: { ...s.hits } };
}
