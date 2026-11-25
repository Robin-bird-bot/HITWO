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
 * - **Attacks** come from the shared library (library.ts): picked at random
 *   from the animal's list (animals.ts), only what's unlocked at the tier,
 *   never the same attack twice in a row. In the Stampede the box and the
 *   head follow whoever is attacking, and no animal attacks more than twice
 *   in a row.
 * - **Pacing** (section 6): the next attack comes the tier's gap after the
 *   running ones end, or, with the tier's chance, overlaps the current one.
 *   Only one area attack and one changer at a time, and never more than the
 *   tier's most at once. A changer (a bear hug, Darkness) doesn't hold up
 *   the next attack once its warning is over.
 * - **The Woods Monster** plays one tier up; on Tier III he's faster still,
 *   and at half time the box shrinks and Darkness can come.
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
import { attackChoices, boxFor, isAnimal, playTier, pool, type PoolEntry } from './animals';
import { oneClawRow } from './attacks/bear';
import { puddleShape, squeezed } from './attacks/claudesIdeas';
import { between, clampToBox, coin, type Box } from './geometry';
import { ATTACKS, rulesFor } from './library';
import { touches, type Point, type Shape } from './shapes';
import type {
  AnimalId,
  AttackCtx,
  AttackId,
  Attacker,
  BoxMove,
  DodgeState,
  Part,
  Round,
  Tier,
  World,
} from './types';

export type { AnimalId, AttackId, Attacker, DodgeState, Part, Tier } from './types';
export type { Box } from './geometry';
export type { Point, Shape } from './shapes';
export { clampToBox, markSpot, SPRITE_HALF } from './geometry';
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
  /** The testing tab's Overlaps: the tier's chance (auto), never, or whenever they fit. */
  overlaps?: 'auto' | 'off' | 'on';
  /** The testing tab's overrides: "auto" uses the tier's value. */
  lives?: 'auto' | number;
  lengthSec?: 'auto' | number;
  switchSec?: 'auto' | number;
}

const orAuto = (v: 'auto' | number | undefined, fallback: number) =>
  typeof v === 'number' ? v : fallback;

/** The length when Auto: the tier's, plus extra for the Stampede; the Woods Monster's own. */
export const autoLength = (animal: AnimalId, tier: Tier): number =>
  animal === 'monster'
    ? D.monster.lengthSec
    : D.tiers[tier].lengthSec + (animal === 'stampede' ? D.stampede.extraSec : 0);

const sameBox = (a: Box, b: Box) => a.cx === b.cx && a.cy === b.cy && a.w === b.w && a.h === b.h;

/** Whether a changer is on: a running one, or the sword bear's shrunk box. */
const changerOn = (s: DodgeState): boolean =>
  s.shrunk || s.rounds.some((r) => r.kind === 'changer');

/**
 * The box an attacker uses: the sword bear's shrinks while `shrunkFor`
 * lasts (but never during another changer), and the Woods Monster's in his
 * second half.
 */
function targetBox(attacker: Attacker, s: DodgeState): { box: Box; shrunk: boolean } {
  const box = boxFor(attacker);
  if (attacker === 'swordBear' && s.shrunkFor > 0 && !s.rounds.some((r) => r.kind === 'changer')) {
    return { box: { ...box, w: D.sword.shrunk[0], h: D.sword.shrunk[1] }, shrunk: true };
  }
  if (attacker === 'monster' && s.secondHalf) {
    return { box: { ...box, w: D.monster.shrunk[0], h: D.monster.shrunk[1] }, shrunk: false };
  }
  return { box, shrunk: false };
}

/** The box at a time as it moves: straight from one to the other. */
export function boxAt(m: BoxMove, time: number): Box {
  const u = m.sec > 0 ? Math.max(0, Math.min(1, (time - m.at) / m.sec)) : 1;
  const mix = (a: number, b: number) => a + (b - a) * u;
  return {
    cx: mix(m.from.cx, m.to.cx),
    cy: mix(m.from.cy, m.to.cy),
    w: mix(m.from.w, m.to.w),
    h: mix(m.from.h, m.to.h),
  };
}

/** Starts the box moving toward `to` (if it isn't already heading there). */
function moveBoxTo(s: DodgeState, to: Box, sec: number = D.boxEaseSec): BoxMove {
  return sameBox(s.boxMove.to, to) ? s.boxMove : { from: { ...s.box }, to, at: s.time, sec };
}

export function newDodge(
  options: DodgeOptions,
  order: readonly string[],
  seed: number,
): DodgeState {
  const animal: AnimalId = isAnimal(options.animal) ? options.animal : 'bees';
  const ideas = options.ideas ?? true;
  const hudTier = options.tier;
  const tier = playTier(animal, hudTier);
  const boost = animal === 'monster' && hudTier === 3;
  const lives = Math.max(1, Math.round(orAuto(options.lives, D.lives)));
  // A picked attack this animal can't make at this tier plays as All.
  const wanted = options.attack ?? 'all';
  const only =
    wanted !== 'all' &&
    attackChoices(animal, hudTier, ideas).some((c) => c.id === wanted && c.unlocked)
      ? wanted
      : 'all';
  const first: Attacker = animal === 'stampede' ? 'herd' : animal;
  const box = boxFor(first);
  const switchSec = orAuto(options.switchSec, D.switchSec);
  const t = D.tiers[tier];
  const B = D.monster.boost;
  // With one attack picked, nothing overlaps: it's there to be studied alone.
  const overlaps = only !== 'all' ? 'off' : (options.overlaps ?? 'auto');
  const overlapChance =
    overlaps === 'off'
      ? 0
      : overlaps === 'on'
        ? 1
        : Math.min(1, t.overlapChance + (boost ? B.overlapChance : 0));
  return {
    animal,
    tier,
    hudTier,
    boost,
    speed: t.speed * (boost ? B.speed : 1),
    overlapChance,
    maxAtOnce: t.maxAtOnce + (boost ? B.maxAtOnce : 0),
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
    lengthSec: orAuto(options.lengthSec, autoLength(animal, hudTier)),
    time: 0,
    box,
    boxMove: { from: box, to: box, at: 0, sec: 0 },
    shrunk: false,
    secondHalf: false,
    pos: { x: box.cx, y: box.cy },
    parts: [],
    rounds: [],
    history: [],
    nextAttackAt: D.firstAttackSec,
    starts: [],
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

/** Whether an attack of this kind can start now: one area and one changer at most, under the cap. */
function fits(s: DodgeState, e: PoolEntry): boolean {
  const def = ATTACKS[e.attack];
  if (s.rounds.length >= s.maxAtOnce) return false;
  if (def.secondHalf && !s.secondHalf) return false;
  if (def.kind === 'area' && s.rounds.some((r) => r.kind === 'area')) return false;
  if (def.kind === 'changer' && changerOn(s)) return false;
  return true;
}

/**
 * The next attack: from the pool, only what fits what's running, never the
 * same attack twice in a row (unless it's the only one), and in the
 * Stampede no animal more than twice in a row. An overlap comes from an
 * animal that isn't attacking yet when one fits.
 */
function pick(s: DodgeState, rng: RngState): PoolEntry | undefined {
  const all = pool(s.animal, s.tier, s.ideas, s.only).filter((e) => fits(s, e));
  if (!all.length) return undefined;
  const last = s.history.at(-1);
  const recent = s.history.slice(-D.stampede.maxSameAnimal).map((h) => h.attacker);
  const tooMany =
    s.animal === 'stampede' &&
    recent.length === D.stampede.maxSameAnimal &&
    recent.every((a) => a === recent[0])
      ? recent[0]
      : undefined;
  const busy = new Set(s.rounds.map((r) => r.attacker));
  const tries = [
    (e: PoolEntry) => e.attack !== last?.attack && e.attacker !== tooMany && !busy.has(e.attacker),
    (e: PoolEntry) => e.attack !== last?.attack && e.attacker !== tooMany,
    (e: PoolEntry) => e.attack !== last?.attack,
    () => true,
  ];
  for (const ok of tries) {
    const list = all.filter(ok);
    if (list.length) return list[int(rng, 0, list.length - 1)];
  }
  return undefined;
}

/**
 * Starts a round of an attack: its parts, the box it happens in (the
 * attacker's, unless other attacks are already running in the current
 * one), and what's remembered.
 */
function startRound(s: DodgeState, rng: RngState, entry: PoolEntry): DodgeState {
  let state = s;
  // The sword bear's shrunk box lasts for a few of its attacks.
  if (entry.attacker === 'swordBear')
    state = { ...state, shrunkFor: Math.max(0, state.shrunkFor - 1) };
  const alone = !state.rounds.some((r) => r.kind !== 'changer');
  const overlapped = state.rounds.some((r) => r.kind !== 'changer');
  const box = alone ? targetBox(entry.attacker, state).box : state.boxMove.to;
  let nextId = state.nextId;
  const ctx: AttackCtx = {
    tier: state.tier,
    time: state.time,
    box,
    pos: { ...state.pos },
    rng,
    speed: state.speed,
    round: state.roundNo,
    nextId: () => nextId++,
    tweak: entry.tweak,
    state,
  };
  const def = ATTACKS[entry.attack];
  const started = def.start(ctx);
  const parts = [...started.parts];
  // Bear with a Sword: sometimes a row of claws comes in on top of a sword attack.
  if (entry.tweak.withClaws && state.only === 'all' && coin(rng, D.claws.withSword[state.tier])) {
    parts.push(oneClawRow(ctx, state.time));
  }
  const calmAt = Math.min(...parts.filter((p) => !p.child).map((p) => p.activeAt));
  const next: DodgeState = {
    ...state,
    ...started.patch,
    parts: [...state.parts, ...parts],
    rounds: [
      ...state.rounds,
      {
        no: state.roundNo,
        attacker: entry.attacker,
        attack: entry.attack,
        kind: def.kind,
        endsAt: started.endsAt,
        calmAt: Number.isFinite(calmAt) ? calmAt : state.time,
      },
    ],
    history: [...state.history, { attacker: entry.attacker, attack: entry.attack }].slice(-6),
    starts: [...state.starts, { at: state.time, attack: entry.attack, overlapped }],
    nextId,
    roundNo: state.roundNo + 1,
  };
  const showing = [...new Set(next.rounds.map((r) => r.attacker))];
  if (!alone) return { ...next, showing };
  const target = targetBox(entry.attacker, next);
  return { ...next, showing, boxMove: moveBoxTo(next, target.box), shrunk: target.shrunk };
}

/** Whether a round is over: its time has come, or all its parts are done. */
function roundOver(s: DodgeState, r: Round): boolean {
  if (r.endsAt !== 'parts') return s.time >= r.endsAt;
  return !s.parts.some((p) => p.round === r.no && !p.child);
}

/** Whether a round still holds up the next attack (a changer doesn't, once its warning is over). */
const holdsUp = (s: DodgeState, r: Round) => !(r.kind === 'changer' && s.time >= r.calmAt);

/** Starts the next attack if it's due, then decides when the one after comes. */
function schedule(s0: DodgeState, rng: RngState): DodgeState {
  let s = s0;
  if (s.nextAttackAt === null || s.time < s.nextAttackAt) return s;
  const entry = pick(s, rng);
  if (!entry) {
    // Nothing fits now: wait for the running attacks to end (or, with none, try again after the gap).
    const waitFor = s.rounds.some((r) => holdsUp(s, r));
    return { ...s, nextAttackAt: waitFor ? null : s.time + D.tiers[s.tier].gapSec };
  }
  s = startRound(s, rng, entry);
  // The next one overlaps this one (with the chance), or waits until they end.
  const overlap = s.rounds.length < s.maxAtOnce && nextFloat(rng) < s.overlapChance;
  return {
    ...s,
    nextAttackAt: overlap
      ? s.time + between(rng, D.overlapAfterSec[0], D.overlapAfterSec[1])
      : null,
  };
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
  return s.parts.flatMap((p) => {
    const rules = rulesFor(p);
    return (rules.outline ?? rules.shapes)(p, w, s.time - window);
  });
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

  // The Woods Monster, Tier III: at half time the woods close in.
  if (s.animal === 'monster' && s.hudTier === 3 && !s.secondHalf && s.time >= s.lengthSec / 2) {
    s = { ...s, secondHalf: true };
    s.boxMove = moveBoxTo(s, targetBox('monster', s).box, D.monster.shrinkSec);
  }

  // The box moves to its size; the sprite moves (slower in honey) and stays inside.
  s.box = boxAt(s.boxMove, s.time);
  const len = Math.hypot(input.x, input.y);
  const k = (len > 1 ? 1 / len : 1) * (inHoney(s) ? D.honey.slow : 1);
  s.pos = clampToBox(
    { x: s.pos.x + input.x * k * D.moveSpeed * dt, y: s.pos.y + input.y * k * D.moveSpeed * dt },
    effectiveBox(s),
  );

  // The next attack, when it's due.
  s = schedule(s, rng);

  // The parts move (and can make new ones: shrapnel, crumbs, puddles, nuts).
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

  // Finished attacks go; once none holds up the next, it comes after the tier's gap.
  const rounds = s.rounds.filter((r) => !roundOver(s, r));
  if (rounds.length !== s.rounds.length) s = { ...s, rounds, showing: showingNow(s, rounds) };
  if (s.nextAttackAt === null && !s.rounds.some((r) => holdsUp(s, r))) {
    s = { ...s, nextAttackAt: s.time + D.tiers[s.tier].gapSec };
  }
  // The clock.
  if (s.time >= s.lengthSec) s = { ...s, over: true };
  return s;
}

/** Who's shown attacking: whoever has a round on, or the last one while none is. */
const showingNow = (s: DodgeState, rounds: readonly Round[]): Attacker[] =>
  rounds.length ? [...new Set(rounds.map((r) => r.attacker))] : s.showing;

/** A hiker with lives left passes, with their hits; a hiker who ran out fails. */
export function result(s: DodgeState): MinigameResult {
  return { ...passFailResult(s.order, (id) => (s.lives[id] ?? 0) > 0), hits: { ...s.hits } };
}
