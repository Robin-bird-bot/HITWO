/**
 * Squirrel Theft (docs/design/23-minigames-final.md, section 4), a shooting
 * gallery: a squirrel stole from the party's packs. Throw nuts to the
 * squirrels to make them happy, and they bring it all back. Pure and seeded.
 *
 * - **The intro:** what the thief took, [3–6] random single resources from
 *   across the party's packs (taken out now).
 * - **Targets** pop up from behind the bushes and the log for a moment,
 *   then duck; from Tier II some run along a branch instead. From Tier III
 *   a bear sometimes pops up; from Tier IV one sometimes pops up right
 *   where a squirrel just ducked.
 * - **Throwing:** a nut flies to the spot tapped and lands [0.35 s] later,
 *   feeding whatever is within [7] units of that spot *when it lands*. A
 *   fed squirrel adds 1 to the shared HAPPY bar and ducks; a fed bear takes
 *   [2] off it.
 * - **Turns:** hikers throw in line order, each with their own nuts.
 * - **The end,** when every nut has landed: at or above the line (a share of
 *   all the party's nuts), everything stolen comes back and everyone
 *   passes; below it, the stolen things are lost and everyone fails.
 *   Nothing else is lost.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import {
  allDone,
  current,
  endTurn,
  newTurns,
  playing,
  quickResult,
  tickTurns,
  type Turns,
} from '../quick/turns';
import type { MinigameResult, Pay, Tier } from '../types';

const ST = BALANCE.minigames.squirrelTheft;

export type Pack = Readonly<Partial<Record<string, number>>>;

export interface Point {
  x: number;
  y: number;
}

/** A target: a squirrel or a bear, up from `upAt` until `until`; a runner moves along its branch. */
export interface Target {
  id: number;
  kind: 'squirrel' | 'bear';
  x: number;
  y: number;
  upAt: number;
  until: number;
  /** A branch runner: from `x` toward `toX` at `speed` (then back). */
  run?: { x0: number; x1: number; speed: number };
  /** Fed (a squirrel smiles and ducks a moment later). */
  fedAt?: number;
}

export interface Nut {
  id: number;
  by: string;
  to: Point;
  thrownAt: number;
  landAt: number;
}

export interface SquirrelTheftOptions {
  tier: Tier;
  /** What each hiker carries (the thief steals from it). */
  packs: Readonly<Record<string, Pack>>;
  /** Things stolen ("auto": [4]); bears ("auto": from Tier III). */
  stolen?: number | 'auto';
  bears?: 'auto' | 'on' | 'off';
  /** Prepare: +1 nut for some hikers, squirrels up longer (BAIT), no bears (Bear Spray). */
  extraNuts?: Readonly<Record<string, number>>;
  baitSec?: number;
  noBears?: boolean;
}

export interface SquirrelTheftState {
  tier: Tier;
  turns: Turns;
  phase: 'intro' | 'play' | 'end';
  /** What the thief took: each a resource from one hiker's pack. */
  stolen: { hiker: string; id: string }[];
  nutsLeft: Record<string, number>;
  nutsAll: number;
  happy: number;
  /** The line the bar has to reach. */
  line: number;
  targets: Target[];
  nuts: Nut[];
  nextAt: number;
  nextId: number;
  upSec: number;
  bears: boolean;
  /** The last thing a nut did (for the screen). */
  last?: { kind: 'fed' | 'bear' | 'miss'; at: number; x: number; y: number };
  time: number;
  over: boolean;
  rng: RngState;
}

/** The resource units in a pack, one entry each, in a fixed order. */
const unitsOf = (pack: Pack | undefined): string[] =>
  Object.entries(pack ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([id, n]) => Array.from({ length: Math.max(0, n ?? 0) }, () => id));

export function newSquirrelTheft(
  options: SquirrelTheftOptions,
  order: readonly string[],
  seed: number,
): SquirrelTheftState {
  const rng = seedRng(seed);
  const t = ST.tiers[options.tier];
  const want = typeof options.stolen === 'number' ? options.stolen : ST.stolenAuto;
  const all = order.flatMap((hiker) => unitsOf(options.packs[hiker]).map((id) => ({ hiker, id })));
  const stolen = shuffle(rng, all).slice(0, want);
  const nutsLeft = Object.fromEntries(
    order.map((id) => [id, t.nuts + (options.extraNuts?.[id] ?? 0)]),
  );
  const nutsAll = Object.values(nutsLeft).reduce((a, b) => a + b, 0);
  const bears =
    !options.noBears &&
    (options.bears === 'on'
      ? true
      : options.bears === 'off'
        ? false
        : options.tier >= ST.bear.from);
  return {
    tier: options.tier,
    turns: newTurns(order),
    phase: order.length ? 'intro' : 'end',
    stolen,
    nutsLeft,
    nutsAll,
    happy: 0,
    line: Math.ceil(nutsAll * t.line),
    targets: [],
    nuts: [],
    nextAt: 0,
    nextId: 1,
    upSec: t.upSec + (options.baitSec ?? 0),
    bears,
    time: 0,
    over: order.length === 0,
    rng,
  };
}

/** The hiker throwing now. */
export const thrower = (s: SquirrelTheftState): string | undefined => current(s.turns);

/** Past the intro (after [3 s], or a tap). */
export const skipIntro = (s: SquirrelTheftState): SquirrelTheftState =>
  s.phase === 'intro' ? { ...s, phase: 'play', nextAt: s.time + ST.firstSec } : s;

/** Where a target is now (a runner moves along its branch and back). */
export function targetAt(t: Target, time: number): Point {
  if (!t.run) return { x: t.x, y: t.y };
  const span = Math.abs(t.run.x1 - t.run.x0);
  const d = (Math.max(0, time - t.upAt) * t.run.speed) % (2 * span);
  const k = d <= span ? d : 2 * span - d;
  return { x: t.run.x0 + Math.sign(t.run.x1 - t.run.x0) * k, y: t.y };
}

/** Whether a target is up now (fed squirrels duck a moment after). */
export const isUp = (t: Target, time: number): boolean =>
  time >= t.upAt &&
  time < (t.fedAt !== undefined ? Math.min(t.until, t.fedAt + ST.fedSec) : t.until);

/** How far a spot is from a target's body (0 inside it). */
export function reachTo(t: Target, time: number, p: Point): number {
  const c = targetAt(t, time);
  const [hw, hh] = t.kind === 'bear' ? ST.bear.half : ST.half;
  const dx = Math.max(0, Math.abs(p.x - c.x) - hw);
  const dy = Math.max(0, Math.abs(p.y - c.y) - hh);
  return Math.hypot(dx, dy);
}

/** Throw a nut at a spot: it lands [0.35 s] later. */
export function throwNut(s: SquirrelTheftState, to: Point): SquirrelTheftState {
  const who = thrower(s);
  if (s.over || s.phase !== 'play' || !who || !playing(s.turns) || (s.nutsLeft[who] ?? 0) <= 0)
    return s;
  return {
    ...s,
    nutsLeft: { ...s.nutsLeft, [who]: s.nutsLeft[who]! - 1 },
    nuts: [
      ...s.nuts,
      { id: s.nextId, by: who, to, thrownAt: s.time, landAt: s.time + ST.flightSec },
    ],
    nextId: s.nextId + 1,
  };
}

/** A new target: a squirrel popping up, a runner on a branch (Tier II and up), or a bear (Tier III and up). */
function spawn(s: SquirrelTheftState, rng: RngState): Target {
  const id = s.nextId;
  if (s.bears && nextFloat(rng) < ST.bear.chance) {
    const row = ST.rows[Math.floor(nextFloat(rng) * ST.rows.length)]!;
    return {
      id,
      kind: 'bear',
      x: row.x0 + nextFloat(rng) * (row.x1 - row.x0),
      y: row.y,
      upAt: s.time,
      until: s.time + s.upSec,
    };
  }
  if (s.tier >= ST.runner.from && nextFloat(rng) < ST.runner.chance) {
    const b = ST.branches[Math.floor(nextFloat(rng) * ST.branches.length)]!;
    const span = b.x1 - b.x0;
    return {
      id,
      kind: 'squirrel',
      x: b.x0,
      y: b.y,
      upAt: s.time,
      until: s.time + s.upSec + span / ST.runner.speed,
      run: { x0: b.x0, x1: b.x1, speed: ST.runner.speed },
    };
  }
  const row = ST.rows[Math.floor(nextFloat(rng) * ST.rows.length)]!;
  return {
    id,
    kind: 'squirrel',
    x: row.x0 + nextFloat(rng) * (row.x1 - row.x0),
    y: row.y,
    upAt: s.time,
    until: s.time + s.upSec,
  };
}

export function tick(s0: SquirrelTheftState, dt: number): SquirrelTheftState {
  if (s0.over) return s0;
  let s: SquirrelTheftState = { ...s0, time: s0.time + dt };
  if (s.phase === 'intro') return s.time >= ST.introSec ? skipIntro(s) : s;
  s = { ...s, turns: tickTurns(s.turns, dt) };
  const rng: RngState = [...s.rng];
  // New targets when due (a few up at once at most).
  const up = s.targets.filter((t) => isUp(t, s.time));
  if (s.time >= s.nextAt && up.length < ST.maxUp) {
    const t = spawn(s, rng);
    s = {
      ...s,
      targets: [...s.targets, t],
      nextId: s.nextId + 1,
      nextAt: s.time + ST.everySec[0] + nextFloat(rng) * (ST.everySec[1] - ST.everySec[0]),
    };
  }
  // Nuts land: each feeds the nearest target within reach of its spot, as it is now.
  let happy = s.happy;
  let last = s.last;
  let targets = s.targets;
  const flying: Nut[] = [];
  for (const n of s.nuts) {
    if (s.time < n.landAt) {
      flying.push(n);
      continue;
    }
    const hit = targets
      .filter(
        (t) => isUp(t, s.time) && t.fedAt === undefined && reachTo(t, s.time, n.to) <= ST.reach,
      )
      .sort((a, b) => reachTo(a, s.time, n.to) - reachTo(b, s.time, n.to))[0];
    if (!hit) {
      last = { kind: 'miss', at: s.time, ...n.to };
      continue;
    }
    if (hit.kind === 'bear') {
      happy = Math.max(0, happy - ST.bear.cost);
      last = { kind: 'bear', at: s.time, ...n.to };
    } else {
      happy += 1;
      last = { kind: 'fed', at: s.time, ...n.to };
    }
    targets = targets.map((t) => (t.id === hit.id ? { ...t, fedAt: s.time } : t));
  }
  // From Tier IV, a bear sometimes pops up right where a squirrel just ducked.
  const ducked = targets.filter(
    (t) =>
      t.kind === 'squirrel' &&
      !t.run &&
      t.until <= s.time &&
      t.until > s.time - dt &&
      t.fedAt === undefined,
  );
  for (const d of ducked) {
    if (s.bears && s.tier >= ST.bear.ambushFrom && nextFloat(rng) < ST.bear.ambushChance) {
      targets = [
        ...targets,
        { id: s.nextId, kind: 'bear', x: d.x, y: d.y, upAt: s.time, until: s.time + s.upSec },
      ];
      s = { ...s, nextId: s.nextId + 1 };
    }
  }
  targets = targets.filter((t) => s.time < t.until + 0.5);
  s = { ...s, rng, happy, targets, nuts: flying, ...(last ? { last } : {}) };
  // A hiker's turn ends when their nuts are thrown and have landed.
  const who = thrower(s);
  if (who && playing(s.turns) && (s.nutsLeft[who] ?? 0) <= 0 && !s.nuts.some((n) => n.by === who)) {
    const turns = endTurn(s.turns, true);
    s = { ...s, turns };
    if (allDone(turns)) return { ...s, phase: 'end', over: true };
  }
  return s;
}

/** Whether the squirrels are happy: the bar at or above the line. */
export const happyEnough = (s: SquirrelTheftState): boolean => s.happy >= s.line;

/**
 * All or nothing: at or above the line, everything stolen comes back and
 * everyone passes; below it, everyone fails and the stolen things are lost
 * (from their owners' packs). Nothing else is lost.
 */
export function result(s: SquirrelTheftState): MinigameResult {
  const ok = happyEnough(s);
  const pays: Record<string, Pay> = {};
  for (const id of s.turns.order) {
    const lost = s.stolen.filter((x) => x.hiker === id).map((x) => x.id);
    pays[id] = ok || !lost.length ? {} : { stolen: lost };
  }
  return quickResult(s.turns.order, () => ok, pays);
}
