/**
 * Trails' course (docs/design/19-minigames-signs-trails.md, section 2): the
 * trail's middle line from start to end, seeded, by type.
 *
 * - **Forest Path:** wide, gentle S-curves ([1.15×] as wide).
 * - **Switchbacks:** zigzags from side to side, a sharp corner every
 *   [150…100] units.
 * - **Ridgeline:** narrow ([0.75×]), mostly straight, with sudden short
 *   jogs to the side.
 * - **Riverbank:** winding, with the river along one side.
 *
 * **Fairness:** the trail never moves sideways faster than [75%] of the
 * hiker's top speed: every slope is capped at that speed ÷ the scroll speed.
 * Every course starts with a short straight stretch in the middle.
 *
 * Distances run along the trail (0 at the start); x is scene units.
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import type { Tier } from '../types';

const T = BALANCE.minigames.trails;

export type TrailType = 'forest' | 'switchbacks' | 'ridgeline' | 'riverbank';

export const TRAIL_TYPES: readonly { id: TrailType; name: string; ground: string }[] = [
  { id: 'forest', name: 'Forest Path', ground: 'tile-forest' },
  { id: 'switchbacks', name: 'Switchbacks', ground: 'tile-rock' },
  { id: 'ridgeline', name: 'Ridgeline', ground: 'tile-rock' },
  { id: 'riverbank', name: 'Riverbank', ground: 'tile-forest' },
];

export const isTrailType = (v: unknown): v is TrailType => TRAIL_TYPES.some((t) => t.id === v);

/** The middle line is kept every this many units along the trail. */
export const STEP = 2;

export interface Course {
  type: TrailType;
  length: number;
  width: number;
  /** The middle's x every STEP units, from the start. */
  xs: number[];
  /** Riverbank: which side the river runs on. */
  riverSide: -1 | 1 | null;
}

/** The steepest the middle line may slope (x per unit along the trail) at this scroll speed. */
export const maxSlope = (scroll: number): number => (T.fairShare * T.topSpeed) / scroll;

/** The trail's width for a tier and type. */
export function widthFor(tier: Tier, type: TrailType): number {
  const w = T.tiers[tier].width;
  return type === 'forest' ? w * T.forestWide : type === 'ridgeline' ? w * T.ridgeNarrow : w;
}

/** The middle at a distance (between the kept points). */
export function middleAt(c: Course, d: number): number {
  const i = Math.max(0, Math.min(c.xs.length - 1, d / STEP));
  const a = Math.floor(i);
  const b = Math.min(c.xs.length - 1, a + 1);
  return c.xs[a]! + (c.xs[b]! - c.xs[a]!) * (i - a);
}

/**
 * Walks the middle line toward a goal, never faster than the slope allows,
 * and never so close to the screen's edge that the trail runs off it.
 */
function follow(
  goal: (d: number) => number,
  length: number,
  slope: number,
  lo: number,
  hi: number,
): number[] {
  const xs: number[] = [];
  let x = 160;
  for (let d = 0; d <= length + STEP; d += STEP) {
    const want = Math.min(hi, Math.max(lo, goal(d)));
    const step = slope * STEP;
    x += Math.max(-step, Math.min(step, want - x));
    xs.push(x);
  }
  return xs;
}

export function makeCourse(rng: RngState, tier: Tier, type: TrailType, length: number): Course {
  const t = T.tiers[tier];
  const width = widthFor(tier, type);
  // A little under the cap, so the walk never has to clip.
  const slope = maxSlope(t.scroll) * 0.98;
  const river = type === 'riverbank' ? T.river.gap + T.river.width : 0;
  const lo = width / 2 + 8 + (type === 'riverbank' ? river : 0);
  const hi = 320 - width / 2 - 8 - (type === 'riverbank' ? river : 0);
  const straight = (d: number) => d < T.leadIn;
  let goal: (d: number) => number;

  if (type === 'switchbacks') {
    // Corners every `corner` units, side to side, as far apart as the slope allows.
    const span = Math.min(hi - lo, slope * t.corner * 0.95);
    const left = 160 - span / 2;
    // Each stretch ends at a corner on alternate sides (0 left, 1 right); the first starts in the middle.
    const firstSide = nextFloat(rng) < 0.5 ? 0 : 1;
    const sideAt = (k: number) => (firstSide + k) % 2;
    goal = (d) => {
      if (straight(d)) return 160;
      const k = Math.floor((d - T.leadIn) / t.corner);
      const f = ((d - T.leadIn) % t.corner) / t.corner;
      const from = k === 0 ? 0.5 : sideAt(k - 1);
      return left + span * (from + (sideAt(k) - from) * f);
    };
  } else if (type === 'ridgeline') {
    // Straight, then a sudden jog to one side every so often.
    const jogs: { at: number; to: number }[] = [];
    let x = 160;
    for (
      let d = T.leadIn + int(rng, T.jogEvery[0], T.jogEvery[1]);
      d < length;
      d += int(rng, T.jogEvery[0], T.jogEvery[1])
    ) {
      const size = t.jog[0] + nextFloat(rng) * (t.jog[1] - t.jog[0]);
      let dir = nextFloat(rng) < 0.5 ? -1 : 1;
      if (x + dir * size > hi || x + dir * size < lo) dir = -dir;
      x = Math.min(hi, Math.max(lo, x + dir * size));
      jogs.push({ at: d, to: x });
    }
    goal = (d) => {
      let x = 160;
      for (const j of jogs) if (d >= j.at) x = j.to;
      return x;
    };
  } else {
    // Forest Path and Riverbank: two waves, scaled so they never slope too much.
    const a1 = T.bend * (0.7 + 0.3 * nextFloat(rng));
    const a2 = T.bend * 0.35 * nextFloat(rng);
    const l1 = 260 + 160 * nextFloat(rng);
    const l2 = 120 + 80 * nextFloat(rng);
    const p1 = nextFloat(rng) * Math.PI * 2;
    const p2 = nextFloat(rng) * Math.PI * 2;
    const steepest = (a1 * 2 * Math.PI) / l1 + (a2 * 2 * Math.PI) / l2;
    const k = Math.min(1, slope / steepest);
    goal = (d) => {
      if (straight(d)) return 160;
      const u = d - T.leadIn;
      return (
        160 +
        k *
          (a1 * Math.sin((2 * Math.PI * u) / l1 + p1) + a2 * Math.sin((2 * Math.PI * u) / l2 + p2))
      );
    };
  }

  return {
    type,
    length,
    width,
    xs: follow(goal, length, slope, lo, hi),
    riverSide: type === 'riverbank' ? (nextFloat(rng) < 0.5 ? -1 : 1) : null,
  };
}
