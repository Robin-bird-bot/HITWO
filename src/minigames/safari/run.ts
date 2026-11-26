/**
 * Safari's run (docs/design/18-minigames-quick.md, section 4): planned in
 * full before anything moves, so the questions can be picked to fit it and
 * every answer can be checked against it (the plan is the log).
 *
 * - **Kinds:** the tier's number, from deer, raccoon, turkey, rabbit, fox,
 *   bear and (from Tier II) bird.
 * - **Speeds:** each walking kind gets its own. The middle kinds take the
 *   tier's walk time; the fastest is at least [1.4×] the next and the
 *   slowest at most [0.7×] the next, past the tier's range if need be
 *   (Wyatt, Nov 25). Birds fly across on their own clock and are left out
 *   of "fastest" and "slowest".
 * - **Animals:** [8±2…16±2], in groups (herds of [2–3] of one kind from
 *   Tier II), each group coming in at least [0.5 s] after the last, never
 *   more on screen than the tier allows, and the last one at least [2 s]
 *   before the watch ends. Every kind comes at least once.
 * - **What they do:** walk straight down; stop and look around; turn back
 *   up and out the top; or walk behind a bush and stay there.
 * - **Bigfoot** (from Tier III): crosses once, quickly, partly behind a
 *   bush, never first or last, and when it can be arranged while exactly one
 *   other kind is on screen.
 *
 * Pure: every number comes from the RNG passed in. Scene units, y down; an
 * animal's y is its feet.
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import type { Tier } from '../types';

const S = BALANCE.minigames.safari;

export const KINDS = [
  { id: 'deer', one: 'Deer', many: 'Deer', w: 34, h: 42 },
  { id: 'raccoon', one: 'Raccoon', many: 'Raccoons', w: 28, h: 26 },
  { id: 'turkey', one: 'Turkey', many: 'Turkeys', w: 30, h: 32 },
  { id: 'rabbit', one: 'Rabbit', many: 'Rabbits', w: 20, h: 26 },
  { id: 'fox', one: 'Fox', many: 'Foxes', w: 24, h: 26 },
  { id: 'bear', one: 'Bear', many: 'Bears', w: 34, h: 34 },
  { id: 'bird', one: 'Bird', many: 'Birds', w: 20, h: 14 },
] as const;
export type Kind = (typeof KINDS)[number]['id'];
export const BIGFOOT = { w: 30, h: 46 } as const;

export const kindInfo = (k: Kind) => KINDS.find((x) => x.id === k)!;

/** The distance a walk time is measured over (the hillside's height plus a little). */
export const WALK = S.bottom - S.top + 20;

export type Does = 'walk' | 'stop' | 'turnBack' | 'hide' | 'fly';

export interface Animal {
  id: number;
  kind: Kind;
  /** Its herd (animals that came in together), if any. */
  herd: number | null;
  enterAt: number;
  /** Walkers: where they walk down (x). Birds: their height (y) and direction. */
  x: number;
  y: number;
  dir: 1 | -1;
  /** Units a second (birds: across). */
  speed: number;
  does: Does;
  /** Stop: where (feet y) and how long. Turn back: where. Hide: the bush. */
  at?: number;
  stopSec?: number;
  bush?: number;
}

export interface Bush {
  x: number;
  /** Its bottom (feet y of whatever hides behind it). */
  y: number;
}

export interface FogPatch {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
}

export interface SafariRun {
  tier: Tier;
  watchSec: number;
  kinds: Kind[];
  /** Each walking kind's speed (units a second). */
  speeds: Partial<Record<Kind, number>>;
  animals: Animal[];
  bushes: Bush[];
  night: boolean;
  fog: FogPatch[] | null;
  bigfoot: { at: number; bush: number; dir: 1 | -1 } | null;
}

export interface PlanOptions {
  night: boolean;
  fog: boolean;
  bigfoot: boolean;
  /** Prepare's FEWER ANIMALS: this many fewer. */
  fewer?: number;
}

const span = (rng: RngState, [a, b]: readonly [number, number]) => a + nextFloat(rng) * (b - a);

/** Where an animal is at a moment (feet), or null when it isn't on the hillside (not yet, gone, or hidden). */
export function positionAt(
  a: Animal,
  t: number,
): { x: number; y: number; stopped: boolean; up: boolean } | null {
  const dt = t - a.enterAt;
  if (dt < 0) return null;
  const k = kindInfo(a.kind);
  if (a.does === 'fly') {
    const x = a.dir > 0 ? -k.w + a.speed * dt : 320 + k.w - a.speed * dt;
    if (x < -k.w || x > 320 + k.w) return null;
    const phase = (dt / S.zigzagSec) % 2;
    const zig = (phase < 1 ? phase : 2 - phase) * 2 - 1;
    return { x, y: a.y + zig * S.zigzag, stopped: false, up: false };
  }
  const down = (sec: number) => S.top + a.speed * sec;
  if (a.does === 'stop' && a.at !== undefined && a.stopSec !== undefined) {
    const reach = (a.at - S.top) / a.speed;
    if (dt >= reach && dt < reach + a.stopSec) return { x: a.x, y: a.at, stopped: true, up: false };
    const y = dt < reach ? down(dt) : a.at + a.speed * (dt - reach - a.stopSec);
    return y > S.bottom + k.h ? null : { x: a.x, y, stopped: false, up: false };
  }
  if (a.does === 'turnBack' && a.at !== undefined) {
    const reach = (a.at - S.top) / a.speed;
    if (dt < reach) return { x: a.x, y: down(dt), stopped: false, up: false };
    const y = a.at - a.speed * (dt - reach);
    return y <= S.top ? null : { x: a.x, y, stopped: false, up: true };
  }
  if (a.does === 'hide' && a.at !== undefined) {
    const reach = (a.at - S.top) / a.speed;
    return dt < reach ? { x: a.x, y: down(dt), stopped: false, up: false } : null;
  }
  const y = down(dt);
  return y > S.bottom + k.h ? null : { x: a.x, y, stopped: false, up: false };
}

/** How long an animal is out (seconds from coming in until it's gone or hidden). */
export function outFor(a: Animal): number {
  const k = kindInfo(a.kind);
  if (a.does === 'fly') return (320 + 2 * k.w) / a.speed;
  const full = (S.bottom + k.h - S.top) / a.speed;
  if (a.does === 'stop') return full + (a.stopSec ?? 0);
  if (a.does === 'turnBack') return (2 * ((a.at ?? S.top) - S.top)) / a.speed;
  if (a.does === 'hide') return ((a.at ?? S.top) - S.top) / a.speed;
  return full;
}

/**
 * When an animal comes into view: a walker as its feet clear the top edge,
 * a bird as half of it is on screen.
 */
export const seenAt = (a: Animal): number =>
  a.enterAt + (a.does === 'fly' ? kindInfo(a.kind).w / 2 : 2) / a.speed;

/** When Bigfoot comes into view (half of him on screen). */
export const bigfootSeenAt = (run: SafariRun): number | null =>
  run.bigfoot ? run.bigfoot.at + (S.bigfootSec * (BIGFOOT.w / 2)) / (320 + 2 * BIGFOOT.w) : null;

/** Bigfoot's spot at a moment (feet), or null when he isn't crossing. */
export function bigfootAt(run: SafariRun, t: number): { x: number; y: number } | null {
  const b = run.bigfoot;
  if (!b) return null;
  const dt = t - b.at;
  if (dt < 0 || dt > S.bigfootSec) return null;
  const travel = 320 + 2 * BIGFOOT.w;
  const x =
    b.dir > 0
      ? -BIGFOOT.w + (travel * dt) / S.bigfootSec
      : 320 + BIGFOOT.w - (travel * dt) / S.bigfootSec;
  return { x, y: run.bushes[b.bush]!.y };
}

/** The kinds on the hillside at a moment. */
export const kindsOut = (run: SafariRun, t: number): Set<Kind> =>
  new Set(run.animals.filter((a) => positionAt(a, t)).map((a) => a.kind));

/** Each kind's speed: the middle ones in the tier's range, the fastest and slowest set apart. */
function planSpeeds(rng: RngState, tier: Tier, walkers: Kind[]): Partial<Record<Kind, number>> {
  const [lo, hi] = S.tiers[tier].walkSec;
  const inRange = () => WALK / span(rng, [lo, hi]);
  const order = shuffle(rng, walkers);
  const out: Partial<Record<Kind, number>> = {};
  if (order.length === 1) {
    out[order[0]!] = inRange();
    return out;
  }
  const mids = order.slice(2).map(inRange);
  if (mids.length === 0) {
    // Two walkers: one in the range, the other set apart from it both ways.
    const mid = inRange();
    out[order[0]!] = mid * Math.max(S.fastestGap, 1 / S.slowestGap) * (1 + 0.1 * nextFloat(rng));
    out[order[1]!] = mid;
    return out;
  }
  out[order[0]!] = Math.max(...mids) * S.fastestGap * (1 + 0.1 * nextFloat(rng));
  out[order[1]!] = Math.min(...mids) * S.slowestGap * (0.9 + 0.1 * nextFloat(rng));
  order.slice(2).forEach((k, i) => (out[k] = mids[i]!));
  return out;
}

/** The bushes: [3], spread out over the hillside. */
function planBushes(rng: RngState): Bush[] {
  const out: Bush[] = [];
  for (let k = 0; k < 200 && out.length < S.bushes; k++) {
    const b = { x: span(rng, [40, 280]), y: span(rng, [96, 176]) };
    if (out.every((o) => Math.hypot(o.x - b.x, o.y - b.y) >= 70)) out.push(b);
  }
  return out;
}

interface Group {
  kind: Kind;
  size: number;
  does: Does;
}

/** The most animals out at once during [from, to], counting `placed`. */
function busiest(placed: readonly Animal[], from: number, to: number): number {
  const moments = [from, ...placed.map((a) => a.enterAt).filter((t) => t > from && t < to)];
  let most = 0;
  for (const t of moments) {
    const n = placed.filter((a) => a.enterAt <= t && t < a.enterAt + outFor(a)).length;
    most = Math.max(most, n);
  }
  return most;
}

export function planRun(rng: RngState, tier: Tier, o: PlanOptions): SafariRun {
  const t = S.tiers[tier];
  const pool = KINDS.map((k) => k.id).filter((k) => k !== 'bird' || t.does.birds);
  const kinds = shuffle(rng, pool).slice(0, Math.min(t.kinds, pool.length));
  const walkers = kinds.filter((k) => k !== 'bird');
  const speeds = planSpeeds(rng, tier, walkers);
  const bushes = planBushes(rng);
  const total = Math.max(3, t.animals + int(rng, -S.animalsSpread, S.animalsSpread) - (o.fewer ?? 0));

  // The groups: one of each kind first (so every kind comes), then any kind.
  const groups: Group[] = [];
  let count = 0;
  const firsts = shuffle(rng, kinds);
  while (count < total) {
    const kind =
      groups.length < firsts.length
        ? firsts[groups.length]!
        : kinds[int(rng, 0, kinds.length - 1)]!;
    const bird = kind === 'bird';
    const herd = !bird && t.does.herd > 0 && total - count >= 2 && nextFloat(rng) < t.does.herd;
    const size = herd ? Math.min(total - count, int(rng, S.herd[0], S.herd[1])) : 1;
    let does: Does = bird ? 'fly' : 'walk';
    if (!bird) {
      if (size === 1 && nextFloat(rng) < t.does.turnBack) does = 'turnBack';
      else if (size === 1 && bushes.length && nextFloat(rng) < t.does.hide) does = 'hide';
      else if (nextFloat(rng) < t.does.stop) does = 'stop';
    }
    groups.push({ kind, size, does });
    count += size;
  }
  const order = [...groups.slice(0, firsts.length), ...shuffle(rng, groups.slice(firsts.length))];

  // Place them in time: a gap after the last group, and never too many out at once.
  const animals: Animal[] = [];
  const lastEntry = t.watchSec - S.lastEntrySec;
  let cursor = 0.3;
  let herdId = 0;
  for (const g of order) {
    const members: Animal[] = [];
    const herd = g.size > 1 ? herdId++ : null;
    const baseX = span(rng, [50, 270]);
    for (let m = 0; m < g.size; m++) {
      const a: Animal = {
        id: 0,
        kind: g.kind,
        herd,
        enterAt: 0,
        x: Math.min(290, Math.max(30, baseX + (m - (g.size - 1) / 2) * 16)),
        y: span(rng, [50, 140]),
        dir: nextFloat(rng) < 0.5 ? 1 : -1,
        speed:
          g.kind === 'bird'
            ? (320 + 2 * kindInfo('bird').w) / span(rng, S.birdSec)
            : speeds[g.kind]!,
        does: g.does,
      };
      if (g.does === 'stop') {
        a.at = S.top + span(rng, [0.3, 0.6]) * (S.bottom - S.top);
        a.stopSec = span(rng, S.stopSec);
      }
      if (g.does === 'turnBack') a.at = S.top + span(rng, [0.3, 0.55]) * (S.bottom - S.top);
      if (g.does === 'hide') {
        a.bush = int(rng, 0, bushes.length - 1);
        a.x = bushes[a.bush]!.x;
        a.at = bushes[a.bush]!.y - 3;
      }
      members.push(a);
    }
    const longest = Math.max(...members.map(outFor));
    let start = cursor + span(rng, S.gapSec);
    while (
      start <= lastEntry &&
      busiest(animals, start, start + longest) + g.size > t.maxOnScreen
    ) {
      start += 0.1;
    }
    if (start > lastEntry) continue;
    members.forEach((a, m) => {
      a.enterAt = start + m * 0.15;
      a.id = animals.length;
      animals.push(a);
    });
    cursor = start;
  }

  const fog: FogPatch[] | null = o.fog
    ? Array.from({ length: S.fogPatches }, (_, k) => ({
        x: span(rng, [0, 320]),
        y:
          S.top +
          20 +
          (k * (S.bottom - S.top - 50)) / Math.max(1, S.fogPatches - 1) +
          span(rng, [-8, 8]),
        w: span(rng, [80, 120]),
        h: span(rng, [26, 36]),
        speed: span(rng, S.fogDrift) * (nextFloat(rng) < 0.5 ? 1 : -1),
      }))
    : null;

  const run: SafariRun = {
    tier,
    watchSec: t.watchSec,
    kinds: [...new Set(animals.map((a) => a.kind))],
    speeds,
    animals,
    bushes,
    night: o.night,
    fog,
    bigfoot: null,
  };
  return o.bigfoot && animals.length >= 2 ? { ...run, bigfoot: planBigfoot(rng, run) } : run;
}

/**
 * Bigfoot's crossing: after the first animal comes in and before the last,
 * clear of the thirds' edges (for "when"), and, when it can be arranged,
 * while exactly one other kind is on the hillside the whole time.
 */
function planBigfoot(rng: RngState, run: SafariRun): SafariRun['bigfoot'] {
  const entries = run.animals.map((a) => a.enterAt).sort((a, b) => a - b);
  const from = entries[0]! + 0.3;
  const to = entries.at(-1)! - 0.3 - S.bigfootSec;
  const third = run.watchSec / 3;
  const clearOfEdges = (t: number) => {
    const mid = t + S.bigfootSec / 2;
    return [third, 2 * third].every((edge) => Math.abs(mid - edge) > 0.5);
  };
  const candidates: number[] = [];
  const oneKind: number[] = [];
  // Nothing comes into view within a moment of him (so "right before" is clear).
  const seen = run.animals.map(seenAt);
  const lead = (S.bigfootSec * (BIGFOOT.w / 2)) / (320 + 2 * BIGFOOT.w);
  const clearOfArrivals = (t: number) => seen.every((x) => Math.abs(x - (t + lead)) >= 0.6);
  for (let t = from; t <= to; t += 0.1) {
    if (!clearOfEdges(t) || !clearOfArrivals(t)) continue;
    candidates.push(t);
    let kind: Kind | null = null;
    let ok = true;
    for (let s = t; s <= t + S.bigfootSec + 1e-9 && ok; s += 0.05) {
      const out = kindsOut(run, s);
      if (out.size !== 1) ok = false;
      else {
        const k = [...out][0]!;
        if (kind && k !== kind) ok = false;
        kind = k;
      }
    }
    if (ok) oneKind.push(t);
  }
  const pool = oneKind.length ? oneKind : candidates;
  if (!pool.length) return null;
  return {
    at: pool[int(rng, 0, pool.length - 1)]!,
    bush: int(rng, 0, Math.max(0, run.bushes.length - 1)),
    dir: nextFloat(rng) < 0.5 ? 1 : -1,
  };
}
