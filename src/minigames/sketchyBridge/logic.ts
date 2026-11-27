/**
 * Sketchy Bridge (docs/design/23-minigames-final.md, section 1), a passing
 * challenge in the style of Stardew Valley's fishing bar: hikers cross a
 * rope bridge one at a time. Pure and seeded.
 *
 * - **The balance bar** ([150] tall): the hiker's icon moves up and down it
 *   on its own. **The zone** is yours: hold and it rises, let go and it
 *   falls, bouncing softly off the bottom.
 * - **How the icon moves:** every [0.6–1.4 s] it picks a new height and
 *   eases toward it, faster by tier. From Tier III it sometimes darts (a
 *   sudden jump); from Tier IV wind gusts flap the ropes, then push it one
 *   way.
 * - **Crossing:** while the icon is in the zone, the hiker walks; a crossing
 *   takes the tier's in-zone time. Outside the zone the hiker stops and
 *   wobbles, and **the bridge's integrity drops**. Planks crack and fall as
 *   it does (one every [4] points).
 * - **Integrity is shared and never resets** (Wyatt), so it's easier with
 *   fewer hikers.
 * - **The bridge breaks** at 0: the hiker on it falls and fails, hurt (the
 *   challenge's stake); everyone behind fails too, losing only the cost of
 *   trying ([1] energy). The Harness (Prepare): the one on it isn't hurt.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passingResult } from '../passing';
import {
  allDone,
  current,
  endTurn,
  newTurns,
  playing,
  tickTurns,
  type Turns,
} from '../quick/turns';
import type { MinigameResult, Pay, Tier } from '../types';

const B = BALANCE.minigames.sketchyBridge;

export interface SketchyBridgeOptions {
  tier: Tier;
  /** The bridge's integrity at the start ("auto": [100]). */
  integrity?: number | 'auto';
  /** Prepare: more integrity (patched planks), a bigger zone, less sway (FOOD; a share), the Harness. */
  patch?: number;
  extraZone?: number;
  lessSway?: number;
  harness?: boolean;
}

export interface SketchyBridgeState {
  tier: Tier;
  turns: Turns;
  /** The bridge: integrity now and at the start (the most it can be). */
  integrity: number;
  full: number;
  /** The zone: its bottom on the bar, its speed (up is +), its height. */
  zoneY: number;
  zoneV: number;
  zoneH: number;
  holding: boolean;
  /** The icon: its height on the bar, where it's heading, and when it picks again. */
  iconY: number;
  target: number;
  retargetAt: number;
  /** Wind (Tier IV and up): the ropes flap until `pushAt`, then the icon is pushed `dir` until `until`. */
  gust: { pushAt: number; until: number; dir: 1 | -1 } | null;
  nextGustAt: number;
  sway: number;
  /** How far the hiker on the bridge has walked (seconds in the zone, to the tier's crossing time). */
  walked: number;
  crossSec: number;
  /** Who broke the bridge (fell), if it broke, and whether the Harness held them. */
  brokeOn: string | null;
  harness: boolean;
  time: number;
  over: boolean;
  rng: RngState;
}

export function newSketchyBridge(
  options: SketchyBridgeOptions,
  order: readonly string[],
  seed: number,
): SketchyBridgeState {
  const t = B.tiers[options.tier];
  const rng = seedRng(seed);
  const full =
    (typeof options.integrity === 'number' ? options.integrity : B.integrity) +
    (options.patch ?? 0);
  const zoneH = t.zone + (options.extraZone ?? 0);
  const start = B.barH / 2;
  return {
    tier: options.tier,
    turns: newTurns(order),
    integrity: full,
    full,
    zoneY: start - zoneH / 2,
    zoneV: 0,
    zoneH,
    holding: false,
    iconY: start,
    target: start,
    retargetAt: 0,
    gust: null,
    nextGustAt: B.gust.everySec[0],
    sway: t.sway * Math.max(0, 1 - (options.lessSway ?? 0)),
    walked: 0,
    crossSec: t.crossSec,
    brokeOn: null,
    harness: options.harness ?? false,
    time: 0,
    over: order.length === 0,
    rng,
  };
}

/** The hiker on the bridge now (or about to step on). */
export const onBridge = (s: SketchyBridgeState): string | undefined => current(s.turns);

/** Whether the icon is inside the zone. */
export const inZone = (s: Pick<SketchyBridgeState, 'iconY' | 'zoneY' | 'zoneH'>): boolean =>
  s.iconY >= s.zoneY && s.iconY <= s.zoneY + s.zoneH;

/** Planks that have cracked and fallen so far: one every [4] points lost. */
export const fallenPlanks = (s: Pick<SketchyBridgeState, 'integrity' | 'full'>): number =>
  Math.floor(Math.max(0, s.full - s.integrity) / B.plankEvery);

/** Hold (or let go of) the zone. */
export const setHolding = (s: SketchyBridgeState, holding: boolean): SketchyBridgeState =>
  s.holding === holding ? s : { ...s, holding };

const between = (rng: RngState, [a, b]: readonly [number, number]) => a + nextFloat(rng) * (b - a);

/**
 * The zone moves: up while held, down when not, never faster than [140]
 * units a second, bouncing softly off the bottom, stopping at the top.
 */
function moveZone(s: SketchyBridgeState, dt: number): SketchyBridgeState {
  let v = s.zoneV + (s.holding ? B.rise : -B.fall) * dt;
  v = Math.max(-B.maxSpeed, Math.min(B.maxSpeed, v));
  let y = s.zoneY + v * dt;
  if (y < 0) {
    y = 0;
    v = -v * B.bounce;
  }
  const top = B.barH - s.zoneH;
  if (y > top) {
    y = top;
    v = Math.min(0, v);
  }
  return { ...s, zoneY: y, zoneV: v };
}

/**
 * The icon's next target (Nov 26 evening): a small step from where it is,
 * [24–40] up or down, turned around when that would leave the bar.
 */
export function nextTarget(iconY: number, rng: RngState): number {
  const lo = B.iconMargin;
  const hi = B.barH - B.iconMargin;
  const step = between(rng, B.targetStep);
  const up = nextFloat(rng) < 0.5;
  let t = iconY + (up ? step : -step);
  if (t < lo || t > hi) t = iconY + (up ? -step : step);
  return Math.max(lo, Math.min(hi, t));
}

/** The icon eases toward its target, darts now and then (Tier III and up), and is pushed by gusts (Tier IV and up). */
function moveIcon(s0: SketchyBridgeState, dt: number, rng: RngState): SketchyBridgeState {
  const t = B.tiers[s0.tier];
  let s = s0;
  if (s.time >= s.retargetAt) {
    s = {
      ...s,
      target: nextTarget(s.iconY, rng),
      retargetAt: s.time + between(rng, B.retargetSec),
    };
    // A dart: a sudden jump.
    if (s.tier >= B.dartFrom && nextFloat(rng) < B.dartChance) {
      const jump = between(rng, B.dart) * (nextFloat(rng) < 0.5 ? -1 : 1);
      s = { ...s, iconY: s.iconY + jump };
    }
  }
  const d = s.target - s.iconY;
  const stepTo = Math.sign(d) * Math.min(Math.abs(d), s.sway * dt);
  let iconY = s.iconY + stepTo;
  // Wind (Tier IV and up): a flap, then a push one way.
  let gust = s.gust;
  let nextGustAt = s.nextGustAt;
  if (t.gusts && !gust && s.time >= nextGustAt) {
    gust = {
      pushAt: s.time + B.gust.flapSec,
      until: s.time + B.gust.flapSec + B.gust.pushSec,
      dir: nextFloat(rng) < 0.5 ? 1 : -1,
    };
  }
  if (gust && s.time >= gust.pushAt && s.time < gust.until) iconY += gust.dir * B.gust.speed * dt;
  if (gust && s.time >= gust.until) {
    gust = null;
    nextGustAt = s.time + between(rng, B.gust.everySec);
  }
  iconY = Math.max(0, Math.min(B.barH, iconY));
  return { ...s, iconY, gust, nextGustAt };
}

export function tick(s0: SketchyBridgeState, dt: number): SketchyBridgeState {
  if (s0.over) return s0;
  let s: SketchyBridgeState = { ...s0, time: s0.time + dt, turns: tickTurns(s0.turns, dt) };
  if (!playing(s.turns)) return s;
  const rng: RngState = [...s.rng];
  s = moveIcon(moveZone(s, dt), dt, rng);
  s = { ...s, rng };
  if (inZone(s)) {
    const walked = s.walked + dt;
    if (walked < s.crossSec) return { ...s, walked };
    // Across: the next hiker starts from the left, with the integrity left.
    const turns = endTurn(s.turns, true);
    return { ...s, turns, walked: 0, over: allDone(turns) };
  }
  const integrity = s.integrity - B.tiers[s.tier].drain * dt;
  if (integrity > 0) return { ...s, integrity };
  // It breaks: the hiker on it falls, and everyone behind fails too.
  return { ...s, integrity: 0, brokeOn: onBridge(s) ?? null, over: true };
}

/**
 * Hikers who crossed pass. If it broke, the hiker on it fails, hurt (the
 * stake; the Harness spares them), and everyone behind fails with [1] energy.
 */
export function result(s: SketchyBridgeState): MinigameResult {
  const order = s.turns.order;
  const passed = order.filter((id) => s.turns.done[id] === true);
  const costs: Record<string, Pay> = {};
  const fail: Pay = { energy: BALANCE.minigames.quick.failEnergy };
  for (const id of order) {
    if (passed.includes(id)) continue;
    costs[id] = id === s.brokeOn && !s.harness ? { conditions: [B.fallCondition] } : fail;
  }
  return passingResult(order, s.tier, passed, costs);
}
