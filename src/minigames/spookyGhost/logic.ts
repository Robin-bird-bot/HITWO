/**
 * Spooky Ghost! (docs/design/24-challenges-reset.md, section 6; mockup
 * 54-spooky-ghost.png): a haunted Find the Object.
 *
 * - **The dark:** everything is pitch black but the flashlight, a circle
 *   around the pointer (on touch, dragged with the finger).
 * - **The mittens:** each hiker has one lost mitten in their color at a
 *   time, somewhere in the dark. A tap on a lit mitten finds it, and a new
 *   one appears at least [80] from the light. Everyone plays at once; each
 *   hiker needs [3–5] finds. No decoys: there's nothing wrong to tap.
 * - **Sanity** is the party's one bar, and the clock: it drains on its own
 *   over [45–35] s, and [4×] as fast while the light is within [20] of a ghost.
 * - **Ghosts** ([4–8] at a time) show only in the light. Each fades in, stays
 *   [3–6] s, fades out and comes back somewhere else, never near the pointer
 *   or a mitten. From Tier III they drift; from Tier IV some drift toward
 *   the light. One the light finds says BOO.
 * - **The end:** when sanity runs out, hikers short of their finds fail. If
 *   everyone has theirs first, everyone passes.
 *
 * Pure and seeded: the screen moves the light (`moveLight`), taps (`tap`)
 * and ticks.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { quickResult } from '../quick/turns';
import type { MinigameResult, Tier } from '../types';

const G = BALANCE.minigames.spookyGhost;

export interface Point {
  x: number;
  y: number;
}

export interface Mitten extends Point {
  owner: string;
  /** When it appeared. */
  at: number;
}

export interface Ghost extends Point {
  id: number;
  /** Drifting (Tier III and up): its speed; a chaser drifts toward the light instead (Tier IV and up). */
  vx: number;
  vy: number;
  chaser: boolean;
  /** It fades in from `bornAt`, starts fading out at `leaveAt`, and is gone at `goneAt`. */
  bornAt: number;
  leaveAt: number;
  goneAt: number;
  /** When the light first found it (BOO). */
  booAt: number | null;
}

export interface SpookyGhostOptions {
  tier: Tier;
  /** Testing settings ("auto": the tier's). */
  finds?: number | 'auto';
  sanitySec?: number | 'auto';
  ghosts?: number | 'auto';
  /** Prepare: FOOD (a share slower), LANTERN (units bigger), LUCKY CHARM (ghosts drain half as much). */
  slower?: number;
  biggerLight?: number;
  calmGhosts?: boolean;
}

export interface SpookyGhostState {
  tier: Tier;
  order: readonly string[];
  /** Finds each hiker needs, and has. */
  need: number;
  found: Record<string, number>;
  mittens: Mitten[];
  ghosts: Ghost[];
  nextGhostId: number;
  light: Point;
  lightR: number;
  /** Sanity left (seconds of plain draining), of the full bar. */
  sanity: number;
  sanitySec: number;
  /** How fast sanity drains on its own (FOOD makes it less than 1), and near a ghost. */
  drain: number;
  ghostDrain: number;
  /** The light was near a ghost on the last tick: sanity draining fast (the screen's edges pulse). */
  draining: boolean;
  lastFind: { owner: string; at: number; x: number; y: number } | null;
  time: number;
  over: boolean;
  rng: RngState;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const between = (rng: RngState, a: number, b: number) => a + nextFloat(rng) * (b - a);
const num = (v: number | 'auto' | undefined, auto: number) => (typeof v === 'number' ? v : auto);

/** Keeps a point inside the field. */
export function inField(p: Point): Point {
  const f = G.field;
  return {
    x: Math.max(f.left, Math.min(f.right, p.x)),
    y: Math.max(f.top, Math.min(f.bottom, p.y)),
  };
}

/** A random spot in the field that passes `ok` (the best of a few tries if none does). */
function spot(rng: RngState, ok: (p: Point) => number): Point {
  const f = G.field;
  let best: Point = { x: (f.left + f.right) / 2, y: (f.top + f.bottom) / 2 };
  let bestScore = -Infinity;
  for (let k = 0; k < 40; k++) {
    const p = {
      x: between(rng, f.left + 6, f.right - 6),
      y: between(rng, f.top + 6, f.bottom - 6),
    };
    const score = ok(p);
    if (score >= 0) return p;
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

/** Where a new mitten goes: at least [80] from the light, and clear of the other mittens. */
function mittenSpot(s: Pick<SpookyGhostState, 'light' | 'mittens'>, rng: RngState): Point {
  return spot(rng, (p) =>
    Math.min(dist(p, s.light) - G.newAway, ...s.mittens.map((m) => dist(p, m) - 16)),
  );
}

/** Where a ghost (re)appears: never within [50] of the pointer, or [20] of a mitten. */
function ghostSpot(s: Pick<SpookyGhostState, 'light' | 'mittens'>, rng: RngState): Point {
  return spot(rng, (p) =>
    Math.min(
      dist(p, s.light) - G.clearOfLight,
      ...s.mittens.map((m) => dist(p, m) - G.clearOfMitten),
    ),
  );
}

/** A ghost starting now (or, at the start, part way through its stay). */
function newGhost(s: SpookyGhostState, rng: RngState, bornAt: number): Ghost {
  const at = ghostSpot(s, rng);
  const stay = between(rng, G.staySec[0], G.staySec[1]);
  const angle = nextFloat(rng) * 2 * Math.PI;
  const drifts = s.tier >= G.driftFrom;
  const chaser = s.tier >= G.chaseFrom && nextFloat(rng) < G.chaseShare;
  return {
    id: s.nextGhostId++,
    ...at,
    vx: drifts ? Math.cos(angle) * G.drift : 0,
    vy: drifts ? Math.sin(angle) * G.drift : 0,
    chaser,
    bornAt,
    leaveAt: bornAt + G.fadeSec + stay,
    goneAt: bornAt + G.fadeSec + stay + G.fadeSec,
    booAt: null,
  };
}

/** How visible a ghost is (when lit): fading in, fully there, fading out. */
export function ghostOpacity(g: Ghost, time: number): number {
  if (time < g.bornAt || time >= g.goneAt) return 0;
  if (time < g.bornAt + G.fadeSec) return (time - g.bornAt) / G.fadeSec;
  if (time > g.leaveAt) return Math.max(0, (g.goneAt - time) / G.fadeSec);
  return 1;
}

/** Is this point inside the flashlight? */
export const lit = (s: Pick<SpookyGhostState, 'light' | 'lightR'>, p: Point): boolean =>
  dist(s.light, p) <= s.lightR;

/** Is the light near a ghost (sanity draining fast)? */
export const nearGhost = (s: Pick<SpookyGhostState, 'light' | 'ghosts' | 'time'>): boolean =>
  s.ghosts.some((g) => ghostOpacity(g, s.time) > 0 && dist(g, s.light) <= G.ghostNear);

export const isDone = (s: Pick<SpookyGhostState, 'found' | 'need'>, id: string): boolean =>
  (s.found[id] ?? 0) >= s.need;

export function newSpookyGhost(
  options: SpookyGhostOptions,
  order: readonly string[],
  seed: number,
): SpookyGhostState {
  const t = G.tiers[options.tier];
  const rng = seedRng(seed);
  const sanitySec = num(options.sanitySec, t.sanitySec);
  const f = G.field;
  const s: SpookyGhostState = {
    tier: options.tier,
    order,
    need: Math.max(1, num(options.finds, t.finds)),
    found: Object.fromEntries(order.map((id) => [id, 0])),
    mittens: [],
    ghosts: [],
    nextGhostId: 1,
    light: { x: (f.left + f.right) / 2, y: (f.top + f.bottom) / 2 },
    lightR: t.light + (options.biggerLight ?? 0),
    sanity: sanitySec,
    sanitySec,
    drain: Math.max(0.1, 1 - (options.slower ?? 0)),
    ghostDrain: options.calmGhosts ? G.ghostDrain * G.charmDrain : G.ghostDrain,
    draining: false,
    lastFind: null,
    time: 0,
    over: order.length === 0,
    rng,
  };
  for (const owner of order) s.mittens.push({ owner, ...mittenSpot(s, rng), at: 0 });
  const count = Math.max(0, num(options.ghosts, t.ghosts));
  for (let k = 0; k < count; k++) {
    // Spread out through their stays, so they don't all come and go together.
    s.ghosts.push(newGhost(s, rng, -nextFloat(rng) * (G.fadeSec + G.staySec[0])));
  }
  return s;
}

/** The pointer (or the finger) moved: the light follows, inside the field. */
export function moveLight(s: SpookyGhostState, p: Point): SpookyGhostState {
  if (s.over) return s;
  return { ...s, light: inField(p) };
}

/**
 * A tap (or click) at `p`: the light is there, and a lit mitten within
 * reach is found. Its hiker gets a new one far from the light, until they
 * have all their finds. Nothing happens for a tap on nothing (no decoys).
 */
export function tap(s0: SpookyGhostState, p: Point): SpookyGhostState {
  if (s0.over) return s0;
  const s = { ...s0, light: inField(p) };
  const hit = s.mittens
    .filter((m) => dist(m, p) <= G.tapReach && lit(s, m))
    .sort((a, b) => dist(a, p) - dist(b, p))[0];
  if (!hit) return s;
  const rng: RngState = [...s.rng];
  const found = { ...s.found, [hit.owner]: (s.found[hit.owner] ?? 0) + 1 };
  let mittens = s.mittens.filter((m) => m !== hit);
  if ((found[hit.owner] ?? 0) < s.need) {
    mittens = [...mittens, { owner: hit.owner, ...mittenSpot({ ...s, mittens }, rng), at: s.time }];
  }
  const allDone = s.order.every((id) => (found[id] ?? 0) >= s.need);
  return {
    ...s,
    found,
    mittens,
    lastFind: { owner: hit.owner, at: s.time, x: hit.x, y: hit.y },
    over: allDone,
    rng,
  };
}

/** Ghosts drift, come and go; sanity drains (faster near a ghost); at none, it's over. */
export function tick(s0: SpookyGhostState, dt: number): SpookyGhostState {
  if (s0.over) return s0;
  const rng: RngState = [...s0.rng];
  const s: SpookyGhostState = { ...s0, time: s0.time + dt, ghosts: [], rng };
  for (const g0 of s0.ghosts) {
    if (s.time >= g0.goneAt) {
      s.ghosts.push(newGhost(s, rng, s.time));
      continue;
    }
    let g = g0;
    if (g.chaser) {
      const d = dist(g, s.light);
      if (d > 1) {
        const k = (G.drift * dt) / d;
        g = { ...g, x: g.x + (s.light.x - g.x) * k, y: g.y + (s.light.y - g.y) * k };
      }
    } else if (g.vx || g.vy) {
      let { vx, vy } = g;
      const f = G.field;
      const x = g.x + vx * dt;
      const y = g.y + vy * dt;
      if (x < f.left || x > f.right) vx = -vx;
      if (y < f.top || y > f.bottom) vy = -vy;
      g = { ...g, ...inField({ x, y }), vx, vy };
    }
    if (g.booAt === null && ghostOpacity(g, s.time) > 0 && lit(s, g)) g = { ...g, booAt: s.time };
    s.ghosts.push(g);
  }
  const draining = nearGhost(s);
  const sanity = s.sanity - dt * s.drain * (draining ? s.ghostDrain : 1);
  if (sanity <= 0) return { ...s, sanity: 0, draining, over: true };
  return { ...s, sanity, draining };
}

/** Each hiker with all their finds passes; the rest fail (when sanity ran out). */
export const result = (s: SpookyGhostState): MinigameResult =>
  quickResult(s.order, (id) => isDone(s, id));
