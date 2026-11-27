/**
 * The Woods Monster's attacks (docs/design/12-minigames-dodge.md, section
 * 12). He's the night events' monster, with two cultists holding candles
 * beside the box, and he's meant to be really hard.
 *
 * - **Fire tongues** (Wyatt's idea; area): flames rise from the floor in
 *   columns with gaps between them, each column warned by embers and a "!"
 *   below the box. Tier II: a second set follows at once, in the gaps.
 *   Tier III: flames come down from the ceiling too, in the other columns.
 * - **Long arms** (Wyatt's idea; missile): two long arms reach out from
 *   behind his head, taking turns. One winds up beside him, aiming at the
 *   sprite (a dotted line and a "!"), then thrusts down along the line,
 *   grabs and pulls back, while the other winds up.
 * - **Glare** (area; it was The Eye): his eyes flash red, then a beam from
 *   each eye sweeps across the box, the two in opposite directions;
 *   staying in one a moment is a hit.
 *
 * Claude's ideas (all switched off together in the testing tab):
 * - **Grasping hands** (missile): a chain of hands bursts up where the
 *   sprite is, each warned by a crack a moment before.
 * - **Candle wisps** (missile): wisps drift from the cultists' candles
 *   toward the sprite, turning slowly, and fade after a while.
 * - **Rune beams** (area): lines flash, then burn. Tier III: sometimes a
 *   5-line star through the middle.
 * - **Ritual circle** (area): runes draw a ring around the sprite; when it
 *   closes, the inside erupts.
 * - **Darkness** (changer, Tier III second half): the box goes dark but for
 *   a light around the sprite; other attacks and their warnings go on.
 */
import { BALANCE } from '../../../config/balance';
import {
  between,
  coin,
  count,
  DEG,
  edges,
  onSide,
  oneOf,
  SIDES,
  unit,
  type Box,
} from '../geometry';
import { MONSTER_EYES, portraitAt } from '../animals';
import { touches, type Point, type Shape } from '../shapes';
import type { AttackCtx, AttackDef, PartBase, PartRules } from '../types';
import { base, from, warnFor } from './common';

const D = BALANCE.minigames.dodge;

/**
 * The cultists' candles (where wisps come from): the tips of `candle.png`
 * beside the box, as in mockup 14. The heads above the box draw them here.
 */
export const CANDLES: readonly Point[] = [
  { x: 55, y: 78 },
  { x: 265, y: 78 },
];

// ── Parts ──────────────────────────────────────────────────────────────────

/** A tongue of flame rising from the floor (or the ceiling) in one column of the box. */
export interface FlamePart extends PartBase {
  kind: 'flame';
  /** Its middle and width as shares of the box's width, and its height at most as a share of the box's height. */
  u: number;
  uw: number;
  height: number;
  ceiling?: true;
  riseSec: number;
  flickerSec: number;
  sinkSec: number;
}

/** A hand bursting up where the sprite was when its crack showed (`warnAt`), at `activeAt`. */
export interface HandPart extends PartBase {
  kind: 'hand';
  x: number;
  y: number;
  aimPending?: true;
  riseSec: number;
  grabSec: number;
}

/** A wisp drifting from a candle toward the sprite, turning slowly. */
export interface WispPart extends PartBase {
  kind: 'wisp';
  candle: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  /** The fastest it turns (radians a second), and when it fades out. */
  turn: number;
  until: number;
}

/** A rune beam: a line that flashes, then burns. */
export interface BeamPart extends PartBase {
  kind: 'beam';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  half: number;
  endAt: number;
}

/** A ritual circle drawing itself around a spot; it erupts when it closes (`activeAt`). */
export interface RitualPart extends PartBase {
  kind: 'ritual';
  cx: number;
  cy: number;
  r: number;
  runes: number;
  eruptSec: number;
}

/**
 * Glare: a beam from each of his eyes (on screen), each one's middle at
 * the floor going from `from` to `to` (x) over `sweepSec` from `activeAt`.
 */
export interface GlarePart extends PartBase {
  kind: 'glare';
  eyes: readonly [Point, Point];
  from: readonly [number, number];
  to: readonly [number, number];
  sweepSec: number;
  width: number;
  /** How long the sprite has been in a beam, and whether that's long enough to hit this step. */
  gaze: number;
  firing?: true;
}

/**
 * One thrust of a long arm: its shoulder (behind his head), which side it
 * reaches from (−1 left, 1 right), and its target (set when the wind-up
 * starts, where the sprite is then). Wind-up from `warnAt`, the thrust from
 * `activeAt`, the grab from `grabAt`, the pull back from `pullAt` to `endAt`.
 */
export interface ArmPart extends PartBase {
  kind: 'arm';
  side: -1 | 1;
  shoulder: Point;
  target?: Point;
  grabAt: number;
  pullAt: number;
  endAt: number;
}

/** Darkness: the box goes dark but for a light around the sprite, until `until`. */
export interface DarkPart extends PartBase {
  kind: 'dark';
  until: number;
  light: number;
}

export type MonsterPart =
  FlamePart | HandPart | WispPart | BeamPart | RitualPart | GlarePart | ArmPart | DarkPart;

// ── Fire tongues ───────────────────────────────────────────────────────────

const F = D.fire;

/** How tall a flame is now (units): rising, flickering, then sinking. */
export function flameHeight(p: FlamePart, box: Box, time: number): number {
  const full = p.height * box.h;
  const t = time - p.activeAt;
  if (t <= 0) return 0;
  if (t < p.riseSec) return full * (t / p.riseSec);
  if (t < p.riseSec + p.flickerSec) return full;
  const sink = t - p.riseSec - p.flickerSec;
  return sink < p.sinkSec ? full * (1 - sink / p.sinkSec) : 0;
}

/** A flame's base (its middle on the floor or ceiling, and its width), in the box as it is now. */
export function flameBase(p: FlamePart, box: Box): { x: number; y: number; w: number } {
  const e = edges(box);
  return { x: e.left + p.u * box.w, y: p.ceiling ? e.top : e.bottom, w: p.uw * box.w };
}

export const FIRE: AttackDef = {
  id: 'fire',
  name: 'Fire tongues',
  kind: 'area',
  start(ctx) {
    const n = count(ctx.rng, F.columns);
    const slots = 2 * n;
    const set = (parity: number, warnAt: number, activeAt: number, ceiling: boolean) =>
      Array.from({ length: n }, (_, j): FlamePart => ({
        kind: 'flame',
        ...base(ctx, warnAt, activeAt),
        u: (2 * j + parity + 0.5) / slots,
        uw: F.width / slots,
        height: between(ctx.rng, F.height[0], F.height[1]),
        ...(ceiling ? { ceiling: true as const } : {}),
        riseSec: F.riseSec,
        flickerSec: F.flickerSec,
        sinkSec: F.sinkSec,
      }));
    const warn = warnFor(ctx);
    const first = ctx.time + warn;
    const parity = coin(ctx.rng) ? 0 : 1;
    const parts = [...set(parity, ctx.time, first, false)];
    if (from(ctx, F.ceilingFrom)) parts.push(...set(1 - parity, ctx.time, first, true));
    if (from(ctx, F.secondFrom)) {
      // The second set rises in the gaps as the first sinks: move across between them.
      const second = first + F.riseSec + F.flickerSec;
      parts.push(...set(1 - parity, second - warn, second, false));
      if (from(ctx, F.ceilingFrom)) parts.push(...set(parity, second - warn, second, true));
    }
    return { parts, endsAt: 'parts' };
  },
};

/** A flame's hit shape now: a tall triangle on its base, or none. */
export function flameShape(p: FlamePart, box: Box, time: number): Shape | null {
  const h = flameHeight(p, box, time);
  if (h < 0.5) return null;
  const b = flameBase(p, box);
  const tip = p.ceiling ? b.y + h : b.y - h;
  return {
    kind: 'triangle',
    points: [
      { x: b.x - b.w / 2, y: b.y },
      { x: b.x + b.w / 2, y: b.y },
      { x: b.x, y: tip },
    ],
  };
}

const FLAME_RULES: PartRules<FlamePart> = {
  shapes(p, w) {
    const shape = flameShape(p, w.box, w.time);
    return shape ? [shape] : [];
  },
  done: (p, w) => w.time > p.activeAt + p.riseSec + p.flickerSec + p.sinkSec,
};

// ── Grasping hands ─────────────────────────────────────────────────────────

const HA = D.hands;

/** hand.png is 10 × 14, its wrist at the bottom: it stands with its wrist at the sprite's feet. */
export const HAND = { w: 10, h: 14, below: 6 } as const;

/** How far up a hand is (0 to 1): rising, grabbing, sinking. */
export function handUp(p: HandPart, time: number): number {
  const t = time - p.activeAt;
  if (t <= 0) return 0;
  if (t < p.riseSec) return t / p.riseSec;
  if (t < p.riseSec + p.grabSec) return 1;
  const sink = t - p.riseSec - p.grabSec;
  return sink < p.riseSec ? 1 - sink / p.riseSec : 0;
}

export const HANDS: AttackDef = {
  id: 'hands',
  name: 'Grasping hands',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const n = count(ctx.rng, HA.count);
    const parts = Array.from({ length: n }, (_, k): HandPart => {
      const warnAt = ctx.time + k * HA.everySec;
      return {
        kind: 'hand',
        ...base(ctx, warnAt, warnAt + warnFor(ctx, HA.crackSec)),
        x: ctx.pos.x,
        y: ctx.pos.y,
        aimPending: true,
        riseSec: HA.riseSec,
        grabSec: HA.grabSec,
      };
    });
    return { parts, endsAt: 'parts' };
  },
};

const HAND_RULES: PartRules<HandPart> = {
  update(p, w) {
    // Each one where the sprite is when its crack shows.
    if (!p.aimPending || w.time < p.warnAt) return { part: p };
    const part: HandPart = { ...p, x: w.pos.x, y: w.pos.y };
    delete part.aimPending;
    return { part };
  },
  shapes(p, w) {
    const t = w.time - p.activeAt;
    if (t < 0 || t > p.riseSec + p.grabSec) return [];
    const bottom = p.y + HAND.below;
    return [{ kind: 'rect', x: p.x - 4, y: bottom - HAND.h + 1, w: 8, h: HAND.h - 1 }];
  },
  done: (p, w) => w.time > p.activeAt + 2 * p.riseSec + p.grabSec,
};

// ── Candle wisps ───────────────────────────────────────────────────────────

const WI = D.wisps;

export const WISPS: AttackDef = {
  id: 'wisps',
  name: 'Candle wisps',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const n = count(ctx.rng, WI.count);
    const first = coin(ctx.rng) ? 0 : 1;
    const parts = Array.from({ length: n }, (_, k): WispPart => {
      const warnAt = ctx.time + k * WI.everySec;
      const activeAt = warnAt + warnFor(ctx);
      const candle = (first + k) % CANDLES.length;
      return {
        kind: 'wisp',
        ...base(ctx, warnAt, activeAt),
        candle,
        x: CANDLES[candle]!.x,
        y: CANDLES[candle]!.y,
        vx: 0,
        vy: 0,
        speed: WI.speed * ctx.speed,
        turn: WI.turnDegPerSec * DEG,
        until: activeAt + WI.lifeSec,
      };
    });
    return { parts, endsAt: 'parts' };
  },
};

const WISP_RULES: PartRules<WispPart> = {
  update(p, w) {
    if (w.time < p.activeAt) return { part: p };
    const want = unit({ x: w.pos.x - p.x, y: w.pos.y - p.y });
    let dir: Point;
    if (!p.vx && !p.vy) {
      dir = want;
    } else {
      // It can only turn so fast, so it can be outrun.
      const now = Math.atan2(p.vy, p.vx);
      let diff = Math.atan2(want.y, want.x) - now;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const step = Math.max(-p.turn * w.dt, Math.min(p.turn * w.dt, diff));
      dir = { x: Math.cos(now + step), y: Math.sin(now + step) };
    }
    const vx = dir.x * p.speed;
    const vy = dir.y * p.speed;
    return { part: { ...p, vx, vy, x: p.x + vx * w.dt, y: p.y + vy * w.dt } };
  },
  shapes(p, w) {
    if (w.time < p.activeAt || w.time > p.until) return [];
    return [{ kind: 'circle', x: p.x, y: p.y, r: WI.radius }];
  },
  done: (p, w) => w.time > p.until,
};

// ── Rune beams ─────────────────────────────────────────────────────────────

const RB = D.runes;

/** The whole of the line through a and b that's inside the box. */
function clipToBox(box: Box, a: Point, b: Point): [Point, Point] {
  const e = edges(box);
  const d = unit({ x: b.x - a.x, y: b.y - a.y });
  let lo = -Infinity;
  let hi = Infinity;
  const slab = (p: number, v: number, min: number, max: number) => {
    if (Math.abs(v) < 1e-9) return;
    const t1 = (min - p) / v;
    const t2 = (max - p) / v;
    lo = Math.max(lo, Math.min(t1, t2));
    hi = Math.min(hi, Math.max(t1, t2));
  };
  slab(a.x, d.x, e.left, e.right);
  slab(a.y, d.y, e.top, e.bottom);
  return [
    { x: a.x + d.x * lo, y: a.y + d.y * lo },
    { x: a.x + d.x * hi, y: a.y + d.y * hi },
  ];
}

export const RUNES: AttackDef = {
  id: 'runes',
  name: 'Rune beams',
  kind: 'area',
  claudesIdea: true,
  start(ctx) {
    const box = ctx.box;
    let lines: [Point, Point][];
    if (from(ctx, RB.starFrom) && coin(ctx.rng, RB.starChance)) {
      // A 5-line star through the middle, with safe pockets between its points.
      const r = 0.4 * Math.min(box.w, box.h);
      const turn = between(ctx.rng, 0, 2 * Math.PI);
      const v = Array.from({ length: 5 }, (_, i) => ({
        x: box.cx + r * Math.cos(turn + (i * 2 * Math.PI) / 5),
        y: box.cy + r * Math.sin(turn + (i * 2 * Math.PI) / 5),
      }));
      lines = v.map((a, i) => clipToBox(box, a, v[(i + 2) % 5]!));
    } else {
      lines = Array.from({ length: count(ctx.rng, RB.lines) }, () => {
        const s1 = oneOf(ctx.rng, SIDES);
        const s2 = oneOf(
          ctx.rng,
          SIDES.filter((x) => x !== s1),
        );
        return [
          onSide(box, s1, between(ctx.rng, 0.15, 0.85)),
          onSide(box, s2, between(ctx.rng, 0.15, 0.85)),
        ];
      });
    }
    const activeAt = ctx.time + warnFor(ctx);
    const parts = lines.map(([a, b]): BeamPart => ({
      kind: 'beam',
      ...base(ctx, ctx.time, activeAt),
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      half: RB.thickness / 2,
      endAt: activeAt + RB.burnSec,
    }));
    return { parts, endsAt: 'parts' };
  },
};

const BEAM_RULES: PartRules<BeamPart> = {
  shapes(p, w) {
    if (w.time < p.activeAt || w.time > p.endAt) return [];
    return [{ kind: 'segment', x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, half: p.half }];
  },
  done: (p, w) => w.time > p.endAt + 0.1,
};

// ── Ritual circle ──────────────────────────────────────────────────────────

const RI = D.ritual;

/** How much of the ring is drawn (0 to 1). */
export const ritualDrawn = (p: RitualPart, time: number): number =>
  Math.max(0, Math.min(1, (time - p.warnAt) / Math.max(0.01, p.activeAt - p.warnAt)));

export const RITUAL: AttackDef = {
  id: 'ritual',
  name: 'Ritual circle',
  kind: 'area',
  claudesIdea: true,
  start(ctx) {
    const e = edges(ctx.box);
    const m = 6;
    return {
      parts: [
        {
          kind: 'ritual',
          ...base(ctx, ctx.time, ctx.time + warnFor(ctx, RI.drawSec)),
          cx: Math.min(e.right - m, Math.max(e.left + m, ctx.pos.x)),
          cy: Math.min(e.bottom - m, Math.max(e.top + m, ctx.pos.y)),
          r: RI.radius,
          runes: RI.runes,
          eruptSec: RI.eruptSec,
        },
      ],
      endsAt: 'parts',
    };
  },
};

const RITUAL_RULES: PartRules<RitualPart> = {
  shapes(p, w, t0) {
    // When it closes: the inside erupts.
    if (w.time < p.activeAt || t0 > p.activeAt + p.eruptSec) return [];
    return [{ kind: 'circle', x: p.cx, y: p.cy, r: p.r }];
  },
  done: (p, w) => w.time > p.activeAt + p.eruptSec + 0.2,
};

// ── Glare ──────────────────────────────────────────────────────────────────

const GL = D.glare;

/** Where his eyes are on screen: in his portrait, which sits above his box at the start. */
export function monsterEyes(): [Point, Point] {
  const at = portraitAt('monster');
  const [a, b] = MONSTER_EYES;
  return [
    { x: at.x + a!.x, y: at.y + a!.y },
    { x: at.x + b!.x, y: at.y + b!.y },
  ];
}

/** How far along the sweep is (0 to 1). */
const sweepAt = (p: GlarePart, time: number) =>
  Math.max(0, Math.min(1, (time - p.activeAt) / p.sweepSec));

/** One eye's beam now: a cone from the eye to the floor, `width` wide there. */
export function glareBeam(p: GlarePart, box: Box, time: number, eye: 0 | 1): Shape {
  const u = sweepAt(p, time);
  const mid = p.from[eye] + (p.to[eye] - p.from[eye]) * u;
  const floor = edges(box).bottom;
  return {
    kind: 'triangle',
    points: [p.eyes[eye], { x: mid - p.width / 2, y: floor }, { x: mid + p.width / 2, y: floor }],
  };
}

const glaring = (p: GlarePart, time: number) =>
  time >= p.activeAt && time <= p.activeAt + p.sweepSec;

export const GLARE: AttackDef = {
  id: 'glare',
  name: 'Glare',
  kind: 'area',
  start(ctx) {
    // The two beams sweep across in opposite directions, crossing in the middle.
    const e = edges(ctx.box);
    const lo = e.left + GL.floorWidth / 2;
    const hi = e.right - GL.floorWidth / 2;
    const leftFirst = coin(ctx.rng);
    return {
      parts: [
        {
          kind: 'glare',
          ...base(ctx, ctx.time, ctx.time + warnFor(ctx, GL.warnSec)),
          eyes: monsterEyes(),
          from: leftFirst ? [lo, hi] : [hi, lo],
          to: leftFirst ? [hi, lo] : [lo, hi],
          sweepSec: GL.sweepSec,
          width: GL.floorWidth,
          gaze: 0,
        },
      ],
      endsAt: 'parts',
    };
  },
};

const GLARE_RULES: PartRules<GlarePart> = {
  update(p, w) {
    // Staying in a beam long enough is a hit; then the count starts over.
    let gaze = 0;
    if (
      glaring(p, w.time) &&
      ([0, 1] as const).some((k) => touches(glareBeam(p, w.box, w.time, k), w.pos, D.hitRadius))
    ) {
      gaze = p.gaze + w.dt;
    }
    const part: GlarePart = { ...p, gaze };
    delete part.firing;
    if (gaze >= GL.holdSec - 1e-9) {
      part.gaze = 0;
      part.firing = true;
    }
    return { part };
  },
  shapes: (p, w) =>
    p.firing ? [glareBeam(p, w.box, w.time, 0), glareBeam(p, w.box, w.time, 1)] : [],
  outline: (p, w) =>
    glaring(p, w.time) ? [glareBeam(p, w.box, w.time, 0), glareBeam(p, w.box, w.time, 1)] : [],
  done: (p, w) => w.time > p.activeAt + p.sweepSec + 0.3,
};

// ── Long arms ──────────────────────────────────────────────────────────────

const AR = D.arms;

/** Where each arm's shoulder is in his portrait (behind his head, as in mockup 18). */
const SHOULDERS = [
  { x: 13, y: 51 },
  { x: 52, y: 51 },
] as const;

const lerp = (a: Point, b: Point, u: number): Point => ({
  x: a.x + (b.x - a.x) * u,
  y: a.y + (b.y - a.y) * u,
});

/** The wound-up pose: the elbow out and up beside him, the hand hanging from it toward the target. */
function woundUp(p: ArmPart, target: Point): { elbow: Point; hand: Point } {
  const elbow = {
    x: p.shoulder.x + p.side * AR.elbowOut[0],
    y: p.shoulder.y - AR.elbowOut[1],
  };
  const d = unit({ x: target.x - elbow.x, y: target.y - elbow.y });
  return { elbow, hand: { x: elbow.x + d.x * AR.hang, y: elbow.y + d.y * AR.hang } };
}

/**
 * An arm now: its shoulder, elbow and hand. Wound up until the thrust; then
 * the hand shoots along the aim line to the target (the arm straightening),
 * grabs there, and pulls back.
 */
export function armAt(p: ArmPart, time: number): { shoulder: Point; elbow: Point; hand: Point } {
  const target = p.target ?? { x: p.shoulder.x, y: p.shoulder.y + 60 };
  const up = woundUp(p, target);
  const straight = lerp(p.shoulder, target, 0.5);
  const at = (u: number) => ({
    shoulder: p.shoulder,
    elbow: lerp(up.elbow, straight, u),
    hand: lerp(up.hand, target, u),
  });
  if (time < p.activeAt) return at(0);
  if (time < p.grabAt) return at((time - p.activeAt) / Math.max(0.01, p.grabAt - p.activeAt));
  if (time < p.pullAt) return at(1);
  return at(1 - Math.min(1, (time - p.pullAt) / Math.max(0.01, p.endAt - p.pullAt)));
}

/** Whether the hand is closed (grabbing) now. */
export const armGrabbing = (p: ArmPart, time: number): boolean =>
  time >= p.grabAt && time < p.pullAt;

/** The aim line: from the shoulder through the target, on to the far side of the box. */
export function armAim(p: ArmPart, box: Box): { from: Point; to: Point } | null {
  if (!p.target) return null;
  const d = unit({ x: p.target.x - p.shoulder.x, y: p.target.y - p.shoulder.y });
  const reach = Math.hypot(box.w, box.h) * 2;
  return { from: p.shoulder, to: { x: p.shoulder.x + d.x * reach, y: p.shoulder.y + d.y * reach } };
}

export const ARMS: AttackDef = {
  id: 'arms',
  name: 'Long arms',
  kind: 'missile',
  start(ctx) {
    // The thrusts take turns between the arms; the next one winds up as the last one thrusts,
    // and an arm is never used again before it's back.
    const cycle = AR.windSec + AR.thrustSec + AR.grabSec + AR.pullSec;
    const every = Math.max(AR.windSec, cycle / 2);
    const at = portraitAt('monster');
    const first: -1 | 1 = coin(ctx.rng) ? -1 : 1;
    const parts: ArmPart[] = Array.from({ length: AR.thrusts }, (_, k) => {
      const side = (k % 2 === 0 ? first : -first) as -1 | 1;
      const sh = SHOULDERS[side < 0 ? 0 : 1];
      const warnAt = ctx.time + k * every;
      const activeAt = warnAt + warnFor(ctx, AR.windSec);
      return {
        kind: 'arm',
        ...base(ctx, warnAt, activeAt),
        side,
        shoulder: { x: at.x + sh.x, y: at.y + sh.y },
        grabAt: activeAt + AR.thrustSec,
        pullAt: activeAt + AR.thrustSec + AR.grabSec,
        endAt: activeAt + AR.thrustSec + AR.grabSec + AR.pullSec,
      };
    });
    return { parts, endsAt: 'parts' };
  },
};

const ARM_RULES: PartRules<ArmPart> = {
  update(p, w) {
    // It aims where the sprite is as its wind-up starts.
    if (p.target || w.time < p.warnAt) return { part: p };
    return { part: { ...p, target: { ...w.pos } } };
  },
  shapes(p, w) {
    if (w.time < p.activeAt || w.time > p.endAt) return [];
    const a = armAt(p, w.time);
    const half = AR.thickness / 2;
    return [
      { kind: 'segment', x1: a.shoulder.x, y1: a.shoulder.y, x2: a.elbow.x, y2: a.elbow.y, half },
      { kind: 'segment', x1: a.elbow.x, y1: a.elbow.y, x2: a.hand.x, y2: a.hand.y, half },
      { kind: 'circle', x: a.hand.x, y: a.hand.y, r: AR.handRadius },
    ];
  },
  done: (p, w) => w.time > p.endAt,
};

// ── Darkness ───────────────────────────────────────────────────────────────

const DK = D.darkness;

/** How dark the box is (0 to 1): fading in over the warning, and out at the end. */
export function darkness(p: DarkPart, time: number): number {
  if (time < p.warnAt || time > p.until) return 0;
  if (time < p.activeAt) return (time - p.warnAt) / Math.max(0.01, p.activeAt - p.warnAt);
  return Math.min(1, (p.until - time) / 0.3);
}

export const DARKNESS: AttackDef = {
  id: 'darkness',
  name: 'Darkness',
  kind: 'changer',
  claudesIdea: true,
  secondHalf: true,
  start(ctx: AttackCtx) {
    const activeAt = ctx.time + warnFor(ctx);
    return {
      parts: [
        {
          kind: 'dark',
          ...base(ctx, ctx.time, activeAt),
          until: activeAt + DK.sec,
          light: DK.light,
        },
      ],
      endsAt: 'parts',
    };
  },
};

const DARK_RULES: PartRules<DarkPart> = {
  shapes: () => [],
  done: (p, w) => w.time > p.until,
};

// ── The lists ──────────────────────────────────────────────────────────────

export const MONSTER_ATTACKS: readonly AttackDef[] = [
  FIRE,
  HANDS,
  WISPS,
  RUNES,
  RITUAL,
  GLARE,
  ARMS,
  DARKNESS,
];

export const MONSTER_RULES: {
  [K in MonsterPart['kind']]: PartRules<Extract<MonsterPart, { kind: K }>>;
} = {
  flame: FLAME_RULES,
  hand: HAND_RULES,
  wisp: WISP_RULES,
  beam: BEAM_RULES,
  ritual: RITUAL_RULES,
  glare: GLARE_RULES,
  arm: ARM_RULES,
  dark: DARK_RULES,
};
