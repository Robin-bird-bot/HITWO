/**
 * Claude's ideas (docs/design/12-minigames-dodge.md, section 6): attacks
 * suggested on top of Wyatt's list. Wyatt keeps or cuts them after playing,
 * and the testing tab's "Include Claude's ideas" switches them all off.
 *
 * Everything for them is here, so cutting one means removing it from this
 * file, from the animals' lists (animals.ts) and its drawing
 * (ui/minigames/dodge/parts/ClaudesIdeasParts.tsx).
 *
 * - **Shout** (Bear; it was Roar): a burst of small arc waves from the
 *   bear's mouth toward the sprite, spreading as they go; step sideways out
 *   of it. Tier III: sometimes a second shout at a slightly different angle.
 * - **Bear hug** (Bear, a changer): the side walls squeeze in, hold for 3 s,
 *   and go back; the sprite is pushed inward. Other attacks keep coming.
 * - **Honey drips** (Bear): drops fall in columns and leave sticky puddles
 *   that slow the sprite (puddles never hit).
 * - **X slash** (Bear with a Sword): two diagonal slashes across the box.
 * - **Thrown sword** (Bear with a Sword): it spins across like a boomerang
 *   and comes back on a lower line; its whole path shows first.
 * - **Zigzag dash** (Bobcat): the bobcat dashes along a sharp zigzag and
 *   bounces off the walls for 2 or 3 passes.
 * - **Landing swipe** (Bobcat): a pounce, then a curved row of claws bursts
 *   out from where it lands.
 * - **Pinecone rain** (Squirrel Army): pinecones drop, bounce once, and
 *   roll off toward the nearer side wall.
 * - **Wall scurry** (Squirrel Army): a line of squirrels runs around the
 *   box just inside the walls, each flicking nuts at the sprite.
 * - **Herd rush** (Stampede): a wall of moose charges across, with gaps.
 */
import { BALANCE } from '../../../config/balance';
import {
  alongPath,
  between,
  coin,
  count,
  DEG,
  edges,
  INWARD,
  onSide,
  oneOf,
  pathLength,
  rayToWall,
  rotate,
  SIDES,
  unit,
  type Box,
} from '../geometry';
import type { Point, Shape } from '../shapes';
import type { AttackDef, Part, PartBase, PartRules } from '../types';
import { clawsBurst } from './bear';
import { pounce } from './bobcat';
import { base, from, warnFor } from './common';

const D = BALANCE.minigames.dodge;

// ── Parts ──────────────────────────────────────────────────────────────────

/** One wave of a shout: a small arc spreading from the bear's mouth (cx, cy) along angle `at`. */
export interface ShoutPart extends PartBase {
  kind: 'shout';
  cx: number;
  cy: number;
  at: number;
  spread: number;
  speed: number;
  half: number;
  maxR: number;
  /** The first wave of a shout carries its warning: the mouth glows and an arrow shows the way. */
  lead?: true;
}

/** A bear hug: the side walls squeeze in to `width` of the box, hold, and go back. */
export interface HugPart extends PartBase {
  kind: 'hug';
  squeezeSec: number;
  holdSec: number;
  width: number;
}

/** A honey drop falling from the top. */
export interface DropPart extends PartBase {
  kind: 'drop';
  x: number;
  y0: number;
  speed: number;
  floor: number;
}

/** A sticky honey puddle: it slows the sprite and never hits. */
export interface PuddlePart extends PartBase {
  kind: 'puddle';
  x: number;
  y: number;
  rx: number;
  ry: number;
  until: number;
}

/** One slash of an X slash. */
export interface SlashPart extends PartBase {
  kind: 'slash';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  endAt: number;
}

/** A thrown sword spinning along a path. */
export interface ThrownPart extends PartBase {
  kind: 'thrown';
  path: Point[];
  speed: number;
}

/** The bobcat dashing along a zigzag, bouncing off the walls. */
export interface DashPart extends PartBase {
  kind: 'dash';
  path: Point[];
  speed: number;
  /** Where each pass starts on the path (a point's index), and where it bounced to start it. */
  passes: number[];
  bounces: Point[];
  /** Each pass after the first shows this long before its bounce. */
  nextWarnSec: number;
}

/** A pinecone: falls, bounces once, then rolls off toward the nearer side wall. */
export interface PineconePart extends PartBase {
  kind: 'pinecone';
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  roll: number;
  bounced?: true;
  rolling?: true;
}

/** A line of squirrels running around the box from a corner, flicking nuts. */
export interface ScurryPart extends PartBase {
  kind: 'scurry';
  /** Where on the way round it starts (units from the top-left corner, clockwise), and which way. */
  start: number;
  dir: 1 | -1;
  speed: number;
  /** Each squirrel flicks a nut this often, the four a quarter of that apart. */
  throwEvery: number;
  nutSpeed: number;
}

/** A nut flicked at the sprite, flying straight until it leaves the box. */
export interface NutPart extends PartBase {
  kind: 'nut';
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** A wall of moose charging across, with gaps. */
export interface HerdPart extends PartBase {
  kind: 'herd';
  from: 'left' | 'right';
  /** The middle of each moose's lane. */
  lanes: number[];
  x0: number;
  vx: number;
}

export type ClaudePart =
  | ShoutPart
  | HugPart
  | DropPart
  | PuddlePart
  | SlashPart
  | ThrownPart
  | DashPart
  | PineconePart
  | ScurryPart
  | NutPart
  | HerdPart;

// ── Shout ──────────────────────────────────────────────────────────────────

const SH = D.shout;

/** How far a shout's wave has spread. */
export const waveRadius = (p: ShoutPart, time: number): number =>
  Math.max(0, (time - p.activeAt) * p.speed);

/** The bear's mouth, above the middle of the box. */
export const mouthOf = (box: Box): Point => ({ x: box.cx, y: edges(box).top - SH.mouthAbove });

export const SHOUT: AttackDef = {
  id: 'shout',
  name: 'Shout',
  kind: 'area',
  claudesIdea: true,
  start(ctx) {
    const mouth = mouthOf(ctx.box);
    const e = edges(ctx.box);
    const maxR =
      Math.max(
        ...[
          [e.left, e.bottom],
          [e.right, e.bottom],
        ].map(([x, y]) => Math.hypot(x! - mouth.x, y! - mouth.y)),
      ) + SH.thickness;
    const aim = Math.atan2(ctx.pos.y - mouth.y, ctx.pos.x - mouth.x);
    const burst = (at: number, warnAt: number, firstAt: number): ShoutPart[] =>
      Array.from({ length: count(ctx.rng, SH.waves) }, (_, k) => ({
        kind: 'shout',
        ...base(ctx, warnAt, firstAt + k * SH.everySec),
        cx: mouth.x,
        cy: mouth.y,
        at,
        spread: SH.spreadDeg * DEG,
        speed: SH.speed * ctx.speed,
        half: SH.thickness / 2,
        maxR,
        ...(k === 0 ? { lead: true as const } : {}),
      }));
    const first = burst(aim, ctx.time, ctx.time + warnFor());
    if (!from(ctx, SH.twoFrom) || !coin(ctx.rng, SH.twoChance)) {
      return { parts: first, endsAt: 'parts' };
    }
    // A second shout right after, a little to one side, with its own warning.
    const at = first.at(-1)!.activeAt + SH.everySec;
    const turn = (coin(ctx.rng) ? 1 : -1) * SH.twoAngleDeg * DEG;
    const second = burst(aim + turn, Math.max(ctx.time, at - warnFor()), at);
    return { parts: [...first, ...second], endsAt: 'parts' };
  },
};

const SHOUT_RULES: PartRules<ShoutPart> = {
  shapes(p, w) {
    const r = waveRadius(p, w.time);
    if (w.time < p.activeAt || r <= 0 || r > p.maxR) return [];
    return [{ kind: 'arc', cx: p.cx, cy: p.cy, r, half: p.half, at: p.at, spread: p.spread }];
  },
  done: (p, w) => waveRadius(p, w.time) > p.maxR,
};

// ── Bear hug ───────────────────────────────────────────────────────────────

const H = D.hug;

/** How wide the box is during a hug (1 is its full width). */
export function hugWidth(p: HugPart, time: number): number {
  const u = time - p.activeAt;
  if (u <= 0) return 1;
  const sq = p.squeezeSec;
  if (u < sq) return 1 - (1 - p.width) * (u / sq);
  if (u < sq + p.holdSec) return p.width;
  if (u < 2 * sq + p.holdSec) return p.width + (1 - p.width) * ((u - sq - p.holdSec) / sq);
  return 1;
}

/** The box squeezed by any bear hug that's on. */
export function squeezed(box: Box, parts: readonly Part[], time: number): Box {
  let k = 1;
  for (const p of parts) if (p.kind === 'hug') k = Math.min(k, hugWidth(p, time));
  return k === 1 ? box : { ...box, w: box.w * k };
}

export const HUG: AttackDef = {
  id: 'hug',
  name: 'Bear hug',
  kind: 'changer',
  claudesIdea: true,
  start(ctx) {
    // A changer: other attacks keep coming while the walls are in.
    const hug: HugPart = {
      kind: 'hug',
      ...base(ctx, ctx.time, ctx.time + warnFor()),
      squeezeSec: H.squeezeSec,
      holdSec: H.holdSec,
      width: H.width,
    };
    return { parts: [hug], endsAt: 'parts' };
  },
};

const HUG_RULES: PartRules<HugPart> = {
  shapes: () => [],
  done: (p, w) => w.time > p.activeAt + 2 * p.squeezeSec + p.holdSec,
};

// ── Honey drips ────────────────────────────────────────────────────────────

const HO = D.honey;

export const dropY = (p: DropPart, time: number): number =>
  p.y0 + Math.max(0, time - p.activeAt) * p.speed;

/** Spread-out spots across the box: one in each of `n` slices of its width. */
function columns(
  rng: Parameters<typeof between>[0],
  box: Box,
  n: number,
  margin: number,
): number[] {
  const e = edges(box);
  const span = box.w - 2 * margin;
  return Array.from(
    { length: n },
    (_, k) => e.left + margin + (span * (k + between(rng, 0.2, 0.8))) / n,
  );
}

export const HONEY: AttackDef = {
  id: 'honey',
  name: 'Honey drips',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const e = edges(ctx.box);
    const n = count(ctx.rng, HO.columns);
    const xs = columns(ctx.rng, ctx.box, n, HO.puddle[0] / 2);
    const parts = xs.map((x, k): DropPart => {
      const warnAt = ctx.time + k * HO.staggerSec;
      return {
        kind: 'drop',
        ...base(ctx, warnAt, warnAt + warnFor()),
        x,
        y0: e.top - 4,
        speed: HO.speed * ctx.speed,
        floor: e.bottom - HO.radius,
      };
    });
    return { parts, endsAt: 'parts' };
  },
};

const DROP_RULES: PartRules<DropPart> = {
  update(p, w) {
    if (p.done || dropY(p, w.time) < p.floor) return { part: p };
    const puddle: PuddlePart = {
      kind: 'puddle',
      id: w.nextId(),
      round: p.round,
      warnAt: w.time,
      activeAt: w.time,
      child: true,
      x: p.x,
      y: edges(w.box).bottom - HO.puddle[1] / 2,
      rx: HO.puddle[0] / 2,
      ry: HO.puddle[1] / 2,
      until: w.time + HO.puddleSec,
    };
    return { part: { ...p, done: true }, spawn: [puddle] };
  },
  shapes(p, w) {
    if (w.time < p.activeAt || p.done) return [];
    return [{ kind: 'circle', x: p.x, y: dropY(p, w.time), r: HO.radius }];
  },
  done: (p) => !!p.done,
};

/** A puddle's outline (it slows the sprite while they touch). */
export const puddleShape = (p: PuddlePart): Shape => ({
  kind: 'ellipse',
  cx: p.x,
  cy: p.y,
  rx: p.rx,
  ry: p.ry,
});

const PUDDLE_RULES: PartRules<PuddlePart> = {
  shapes: () => [],
  done: (p, w) => w.time > p.until,
};

// ── X slash ────────────────────────────────────────────────────────────────

const X = D.xSlash;

export const X_SLASH: AttackDef = {
  id: 'xSlash',
  name: 'X slash',
  kind: 'area',
  claudesIdea: true,
  start(ctx) {
    const e = edges(ctx.box);
    const first = ctx.time + warnFor();
    const down = coin(ctx.rng);
    const lines = [
      [e.left, e.top, e.right, e.bottom],
      [e.left, e.bottom, e.right, e.top],
    ];
    const order = down ? lines : [lines[1]!, lines[0]!];
    const parts = order.map(([x1, y1, x2, y2], k): SlashPart => {
      const activeAt = first + k * X.gapSec;
      return {
        kind: 'slash',
        ...base(ctx, ctx.time, activeAt),
        x1: x1!,
        y1: y1!,
        x2: x2!,
        y2: y2!,
        endAt: activeAt + X.showSec,
      };
    });
    return { parts, endsAt: 'parts' };
  },
};

const SLASH_RULES: PartRules<SlashPart> = {
  shapes(p, w) {
    if (w.time < p.activeAt || w.time > p.endAt) return [];
    return [{ kind: 'segment', x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, half: X.thickness / 2 }];
  },
  done: (p, w) => w.time > p.endAt + 0.1,
};

// ── Thrown sword ───────────────────────────────────────────────────────────

const T = D.thrown;

/** Where the thrown sword is, and its spin (radians). */
export function thrownAt(p: ThrownPart, time: number): { at: Point; angle: number; end: boolean } {
  const t = Math.max(0, time - p.activeAt);
  const { at, end } = alongPath(p.path, t * p.speed);
  return { at, angle: t * T.spinPerSec * 2 * Math.PI, end };
}

/** When the thrown sword is back (the bear catches it). */
export const thrownBackAt = (p: ThrownPart): number => p.activeAt + pathLength(p.path) / p.speed;

export const THROWN: AttackDef = {
  id: 'thrown',
  name: 'Thrown sword',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const e = edges(ctx.box);
    const ltr = coin(ctx.rng);
    const out = T.length / 2 + 6;
    const [x0, x1] = ltr ? [e.left - out, e.right + out] : [e.right + out, e.left - out];
    const y1 = e.top + T.lines[0] * ctx.box.h;
    const y2 = e.top + T.lines[1] * ctx.box.h;
    return {
      parts: [
        {
          kind: 'thrown',
          ...base(ctx, ctx.time, ctx.time + warnFor()),
          path: [
            { x: x0, y: y1 },
            { x: x1, y: y1 },
            { x: x1, y: y2 },
            { x: x0, y: y2 },
          ],
          speed: T.speed * ctx.speed,
        },
      ],
      endsAt: 'parts',
    };
  },
};

const THROWN_RULES: PartRules<ThrownPart> = {
  shapes(p, w) {
    if (w.time < p.activeAt) return [];
    const { at, angle, end } = thrownAt(p, w.time);
    if (end) return [];
    const dx = (Math.cos(angle) * T.length) / 2;
    const dy = (Math.sin(angle) * T.length) / 2;
    return [
      {
        kind: 'segment',
        x1: at.x - dx,
        y1: at.y - dy,
        x2: at.x + dx,
        y2: at.y + dy,
        half: T.thickness / 2,
      },
    ];
  },
  done: (p, w) => w.time > p.activeAt && thrownAt(p, w.time).end,
};

// ── Zigzag dash ────────────────────────────────────────────────────────────

const DA = D.dash;

export const dashAt = (p: DashPart, time: number) =>
  alongPath(p.path, Math.max(0, time - p.activeAt) * p.speed);

/** How far along the path each point is. */
const distances = (path: readonly Point[]): number[] =>
  path.reduce<number[]>(
    (acc, q, i) => [
      ...acc,
      i ? acc[i - 1]! + Math.hypot(q.x - path[i - 1]!.x, q.y - path[i - 1]!.y) : 0,
    ],
    [],
  );

/** Each pass of the dash (its points) and when its dotted line shows. */
export function dashPasses(p: DashPart): { points: Point[]; showAt: number; doneAt: number }[] {
  const d = distances(p.path);
  return p.passes.map((startIdx, k) => {
    const endIdx = p.passes[k + 1] ?? p.path.length - 1;
    const startAt = p.activeAt + d[startIdx]! / p.speed;
    return {
      points: p.path.slice(startIdx, endIdx + 1),
      showAt: k === 0 ? p.warnAt : startAt - p.nextWarnSec,
      doneAt: p.activeAt + d[endIdx]! / p.speed,
    };
  });
}

/** A sharp zigzag along a straight line from a to b: legs of about `leg`, turning `turn` at each corner. */
function zigzag(a: Point, b: Point): Point[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const u = unit({ x: b.x - a.x, y: b.y - a.y });
  const n = { x: -u.y, y: u.x };
  const half = (DA.turnDeg / 2) * DEG;
  const legs = Math.max(2, Math.round(len / (DA.leg * Math.cos(half))));
  const step = len / legs;
  const side = step * Math.tan(half);
  return Array.from({ length: legs + 1 }, (_, i) => {
    const off = i === 0 || i === legs ? 0 : (i % 2 ? side : -side) / 2;
    return { x: a.x + u.x * step * i + n.x * off, y: a.y + u.y * step * i + n.y * off };
  });
}

export const DASH: AttackDef = {
  id: 'dash',
  name: 'Zigzag dash',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const box = ctx.box;
    const e = edges(box);
    const side = oneOf(ctx.rng, SIDES);
    let at = onSide(box, side, between(ctx.rng, 0.25, 0.75));
    // Slanted from straight across, so each bounce sends it back on a new line.
    let dir = rotate(
      INWARD[side],
      (coin(ctx.rng) ? 1 : -1) * between(ctx.rng, DA.slantDeg[0], DA.slantDeg[1]) * DEG,
    );
    const out = DA.radius + 2;
    const path: Point[] = [{ x: at.x - dir.x * out, y: at.y - dir.y * out }];
    const passes: number[] = [];
    const bounces: Point[] = [];
    const n = DA.passes[ctx.tier];
    for (let k = 0; k < n; k++) {
      const far = { x: at.x + dir.x * 1e-6, y: at.y + dir.y * 1e-6 };
      const d = rayToWall(box, far, dir);
      const to = { x: far.x + dir.x * d, y: far.y + dir.y * d };
      passes.push(path.length - 1);
      path.push(...zigzag(path.at(-1)!, to).slice(1));
      if (k < n - 1) {
        // Bounce: mirror off the wall (or both, in a corner).
        const near = (a: number, b: number) => Math.abs(a - b) < 1e-3;
        if (near(to.x, e.left) || near(to.x, e.right)) dir = { x: -dir.x, y: dir.y };
        if (near(to.y, e.top) || near(to.y, e.bottom)) dir = { x: dir.x, y: -dir.y };
        bounces.push(to);
      }
      at = to;
    }
    path.push({ x: at.x + dir.x * out, y: at.y + dir.y * out });
    return {
      parts: [
        {
          kind: 'dash',
          ...base(ctx, ctx.time, ctx.time + warnFor(DA.warnSec)),
          path,
          speed: DA.speed * ctx.speed,
          passes,
          bounces,
          nextWarnSec: warnFor(DA.nextWarnSec),
        },
      ],
      endsAt: 'parts',
    };
  },
};

const DASH_RULES: PartRules<DashPart> = {
  shapes(p, w) {
    if (w.time < p.activeAt) return [];
    const { at, end } = dashAt(p, w.time);
    return end ? [] : [{ kind: 'circle', x: at.x, y: at.y, r: DA.radius }];
  },
  done: (p, w) => w.time > p.activeAt && dashAt(p, w.time).end,
};

// ── Landing swipe ──────────────────────────────────────────────────────────

export const LANDING_SWIPE: AttackDef = {
  id: 'landingSwipe',
  name: 'Landing swipe',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const land = pounce(ctx, { ...ctx.pos }, ctx.time, ctx.time + warnFor(D.pounce.growSec));
    // A curved row of claws bursts out from the landing spot, warned during the shadow.
    const dir = rotate({ x: 1, y: 0 }, between(ctx.rng, 0, Math.PI * 2));
    const speed = D.claws.speed * ctx.speed * (ctx.tweak.speed ?? 1);
    const claws = clawsBurst(
      ctx,
      { x: land.cx, y: land.cy },
      dir,
      Math.max(ctx.time, land.activeAt - warnFor()),
      land.activeAt,
      speed,
    );
    return { parts: [land, claws], endsAt: 'parts' };
  },
};

// ── Pinecone rain ──────────────────────────────────────────────────────────

const PC = D.pinecones;

export const PINECONES: AttackDef = {
  id: 'pinecones',
  name: 'Pinecone rain',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const e = edges(ctx.box);
    const n = count(ctx.rng, PC.columns);
    const xs = columns(ctx.rng, ctx.box, n, PC.radius + 4);
    const parts = xs.map((x, k): PineconePart => {
      const warnAt = ctx.time + k * PC.staggerSec;
      return {
        kind: 'pinecone',
        ...base(ctx, warnAt, warnAt + warnFor()),
        x,
        y: e.top - PC.radius,
        vx: 0,
        vy: 0,
        gravity: PC.gravity * ctx.speed,
        roll: PC.rollSpeed * ctx.speed,
      };
    });
    return { parts, endsAt: 'parts' };
  },
};

const PINECONE_RULES: PartRules<PineconePart> = {
  update(p, w) {
    if (w.time < p.activeAt || p.done) return { part: p };
    const e = edges(w.box);
    const dt = Math.min(w.dt, w.time - p.activeAt);
    const floor = e.bottom - PC.radius;
    if (p.rolling) {
      const x = p.x + p.vx * dt;
      const gone = x < e.left - PC.radius || x > e.right + PC.radius;
      return { part: gone ? { ...p, x, done: true } : { ...p, x } };
    }
    const vy = p.vy + p.gravity * dt;
    const y = p.y + vy * dt;
    if (y < floor) return { part: { ...p, y, vy } };
    if (!p.bounced) return { part: { ...p, y: floor, vy: -vy * PC.bounce, bounced: true } };
    // Second time down: roll off toward the nearer side wall.
    return {
      part: { ...p, y: floor, vy: 0, vx: p.x < w.box.cx ? -p.roll : p.roll, rolling: true },
    };
  },
  shapes(p, w) {
    if (w.time < p.activeAt || p.done) return [];
    return [{ kind: 'circle', x: p.x, y: p.y, r: PC.radius }];
  },
  done: (p) => !!p.done,
};

// ── Wall scurry ────────────────────────────────────────────────────────────

const SC = D.scurry;

/** The way round just inside the walls: its corners, clockwise from the top-left. */
export function scurryLoop(box: Box): { corners: Point[]; length: number } {
  const e = edges(box);
  const i = SC.inset;
  const corners = [
    { x: e.left + i, y: e.top + i },
    { x: e.right - i, y: e.top + i },
    { x: e.right - i, y: e.bottom - i },
    { x: e.left + i, y: e.bottom - i },
  ];
  return { corners, length: 2 * (box.w - 2 * i) + 2 * (box.h - 2 * i) };
}

/** A point `d` units clockwise round the loop from the top-left corner, and its direction. */
function aroundLoop(box: Box, d: number): { at: Point; dir: Point } {
  const { corners, length } = scurryLoop(box);
  const wrapped = ((d % length) + length) % length;
  const { at, dir } = alongPath([...corners, corners[0]!], wrapped);
  return { at, dir };
}

/** Each squirrel still running (`k` is its place in the line): where it is and which way it faces. */
export function scurryAt(
  p: ScurryPart,
  box: Box,
  time: number,
): { k: number; at: Point; dir: Point }[] {
  const { length } = scurryLoop(box);
  const run = Math.max(0, time - p.activeAt) * p.speed;
  const out: { k: number; at: Point; dir: Point }[] = [];
  for (let k = 0; k < SC.squirrels; k++) {
    const d = run - k * SC.spacing;
    if (d < 0 || d > length || time < p.activeAt) continue;
    const spot = aroundLoop(box, p.start + p.dir * d);
    out.push({ k, at: spot.at, dir: { x: spot.dir.x * p.dir, y: spot.dir.y * p.dir } });
  }
  return out;
}

/** When squirrel `k` flicks its `j`-th nut: one interval in, the four a quarter interval apart. */
export const nutThrowAt = (p: ScurryPart, k: number, j: number): number =>
  p.activeAt + (j + 1) * p.throwEvery + (k * p.throwEvery) / SC.squirrels;

/** Whether squirrel `k` is blinking now (it's about to throw). */
export function scurryBlinking(p: ScurryPart, k: number, time: number): boolean {
  const j = Math.ceil((time - nutThrowAt(p, k, 0)) / p.throwEvery);
  const at = nutThrowAt(p, k, Math.max(0, j));
  return time >= at - SC.nuts.blinkSec && time < at;
}

/** Where the line starts (for its warning). */
export const scurryStart = (p: ScurryPart, box: Box): Point => aroundLoop(box, p.start).at;

export const SCURRY: AttackDef = {
  id: 'scurry',
  name: 'Wall scurry',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const { corners, length } = scurryLoop(ctx.box);
    // Start at a corner.
    const k = Math.floor(between(ctx.rng, 0, 4)) % 4;
    const sides = [0, 1, 2, 3].map((j) =>
      Math.hypot(corners[(j + 1) % 4]!.x - corners[j]!.x, corners[(j + 1) % 4]!.y - corners[j]!.y),
    );
    const start = sides.slice(0, k).reduce((a, b) => a + b, 0) % length;
    return {
      parts: [
        {
          kind: 'scurry',
          ...base(ctx, ctx.time, ctx.time + warnFor()),
          start,
          dir: coin(ctx.rng) ? 1 : -1,
          speed: SC.speed * ctx.speed,
          throwEvery: SC.nuts.everySec[ctx.tier],
          nutSpeed: SC.nuts.speed * ctx.speed,
        },
      ],
      endsAt: 'parts',
    };
  },
};

const SCURRY_RULES: PartRules<ScurryPart> = {
  update(p, w) {
    // Each squirrel still running flicks a nut at the sprite when its time comes.
    const t0 = w.time - w.dt;
    const nuts: NutPart[] = [];
    for (const sq of scurryAt(p, w.box, w.time)) {
      const j = Math.ceil((w.time - nutThrowAt(p, sq.k, 0)) / p.throwEvery);
      const at = nutThrowAt(p, sq.k, Math.max(0, j));
      const prev = nutThrowAt(p, sq.k, Math.max(0, j - 1));
      const due = [at, prev].find((t) => t > t0 && t <= w.time);
      if (due === undefined) continue;
      const dir = unit({ x: w.pos.x - sq.at.x, y: w.pos.y - sq.at.y });
      nuts.push({
        kind: 'nut',
        id: w.nextId(),
        round: p.round,
        warnAt: w.time,
        activeAt: w.time,
        child: true,
        x: sq.at.x,
        y: sq.at.y,
        vx: dir.x * p.nutSpeed,
        vy: dir.y * p.nutSpeed,
      });
    }
    return nuts.length ? { part: p, spawn: nuts } : { part: p };
  },
  shapes(p, w) {
    return scurryAt(p, w.box, w.time).map((s): Shape => ({
      kind: 'circle',
      x: s.at.x,
      y: s.at.y,
      r: SC.radius,
    }));
  },
  done: (p, w) =>
    w.time > p.activeAt &&
    (w.time - p.activeAt) * p.speed - (SC.squirrels - 1) * SC.spacing > scurryLoop(w.box).length,
};

const NUT_RULES: PartRules<NutPart> = {
  update(p, w) {
    const x = p.x + p.vx * w.dt;
    const y = p.y + p.vy * w.dt;
    const e = edges(w.box);
    const gone = x < e.left || x > e.right || y < e.top || y > e.bottom;
    return { part: gone ? { ...p, x, y, done: true } : { ...p, x, y } };
  },
  shapes: (p) => (p.done ? [] : [{ kind: 'circle', x: p.x, y: p.y, r: SC.nuts.radius }]),
  done: (p) => !!p.done,
};

// ── Herd rush ──────────────────────────────────────────────────────────────

const HR = D.herd;

/** moose.png is 26 × 20, facing right. */
export const MOOSE = { w: 26, h: 20 } as const;

export const herdX = (p: HerdPart, time: number): number =>
  p.x0 + p.vx * Math.max(0, time - p.activeAt);

export const HERD: AttackDef = {
  id: 'herd',
  name: 'Herd rush',
  kind: 'area',
  claudesIdea: true,
  start(ctx) {
    const e = edges(ctx.box);
    const lanes = Math.max(2, Math.floor(ctx.box.h / HR.lane));
    const gaps = Math.min(lanes - 1, HR.gaps[ctx.tier]);
    const all = Array.from({ length: lanes }, (_, k) => e.top + ((k + 0.5) * ctx.box.h) / lanes);
    const open = new Set<number>();
    while (open.size < gaps)
      open.add(
        oneOf(
          ctx.rng,
          all.map((_, k) => k),
        ),
      );
    const side = coin(ctx.rng) ? 'left' : 'right';
    const out = MOOSE.w / 2 + 4;
    const speed = HR.speed * ctx.speed;
    return {
      parts: [
        {
          kind: 'herd',
          ...base(ctx, ctx.time, ctx.time + warnFor()),
          from: side,
          lanes: all.filter((_, k) => !open.has(k)),
          x0: side === 'left' ? e.left - out : e.right + out,
          vx: side === 'left' ? speed : -speed,
        },
      ],
      endsAt: 'parts',
    };
  },
};

const HERD_RULES: PartRules<HerdPart> = {
  shapes(p, w) {
    if (w.time < p.activeAt) return [];
    const x = herdX(p, w.time);
    const i = HR.hitInset;
    return p.lanes.map((y): Shape => ({
      kind: 'rect',
      x: x - MOOSE.w / 2 + i,
      y: y - MOOSE.h / 2 + i,
      w: MOOSE.w - 2 * i,
      h: MOOSE.h - 2 * i,
    }));
  },
  done(p, w) {
    const e = edges(w.box);
    const x = herdX(p, w.time);
    return p.vx > 0 ? x > e.right + MOOSE.w : x < e.left - MOOSE.w;
  },
};

// ── The lists ──────────────────────────────────────────────────────────────

export const CLAUDES_IDEAS: readonly AttackDef[] = [
  SHOUT,
  HUG,
  HONEY,
  X_SLASH,
  THROWN,
  DASH,
  LANDING_SWIPE,
  PINECONES,
  SCURRY,
  HERD,
];

export const CLAUDE_RULES: {
  [K in ClaudePart['kind']]: PartRules<Extract<ClaudePart, { kind: K }>>;
} = {
  shout: SHOUT_RULES,
  hug: HUG_RULES,
  drop: DROP_RULES,
  puddle: PUDDLE_RULES,
  slash: SLASH_RULES,
  thrown: THROWN_RULES,
  dash: DASH_RULES,
  pinecone: PINECONE_RULES,
  scurry: SCURRY_RULES,
  nut: NUT_RULES,
  herd: HERD_RULES,
};
