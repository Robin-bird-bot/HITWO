/**
 * Trails' course (docs/design/19-minigames-signs-trails.md, section 2): the
 * trail's middle line from start to end, seeded, by type.
 *
 * - **Forest Path:** wide, gentle S-curves ([1.15×] as wide).
 * - **Switchbacks:** zigzags from side to side, a sharp corner every
 *   [150…100] units.
 * - **Ridgeline (revised Nov 26):** a knife-edge ridge, [0.6×] as wide,
 *   with a sheer drop on both sides; knife edges that pinch it to [0.6×];
 *   sudden [40–70]-unit jogs under a looser slope cap ([90%] of top speed);
 *   and scree patches (the gusts are in logic.ts).
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
  { id: 'ridgeline', name: 'Ridgeline', ground: 'tile-drop' },
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
  /** Ridgeline: knife edges (where it pinches) and scree patches, by distance. */
  knives: { from: number; to: number }[];
  scree: { from: number; to: number }[];
}

/** Ridgeline's hazards that can be switched off in the testing tab. */
export interface RidgeHazards {
  knives?: boolean;
  scree?: boolean;
}

const RG = T.ridge;

/**
 * The steepest the middle line may slope (x per unit along the trail) at
 * this scroll speed: [75%] of the hiker's top speed sideways, or [90%] on
 * Ridgeline (Nov 26).
 */
export const maxSlope = (scroll: number, type?: TrailType): number =>
  ((type === 'ridgeline' ? RG.fairShare : T.fairShare) * T.topSpeed) / scroll;

/** The trail's width for a tier and type. */
export function widthFor(tier: Tier, type: TrailType): number {
  const w = T.tiers[tier].width;
  return type === 'forest' ? w * T.forestWide : type === 'ridgeline' ? w * T.ridgeNarrow : w;
}

/** Whether a distance is inside one of these stretches. */
export const inStretch = (list: readonly { from: number; to: number }[], d: number): boolean =>
  list.some((k) => d >= k.from && d <= k.to);

/** How far the hiker is into a knife edge's pinch (0 to 1, eased over its first and last [12] units). */
function pinch(c: Course, d: number): number {
  for (const k of c.knives) {
    if (d < k.from || d > k.to) continue;
    return Math.min(1, (d - k.from) / 12, (k.to - d) / 12);
  }
  return 0;
}

/** The trail's width at a distance: narrower through a knife edge. */
export const widthAt = (c: Course, d: number): number =>
  c.width * (1 - (1 - RG.knifeShare) * pinch(c, d));

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

export function makeCourse(
  rng: RngState,
  tier: Tier,
  type: TrailType,
  length: number,
  hazards: RidgeHazards & { section?: number } = {},
): Course {
  const t = T.tiers[tier];
  const width = widthFor(tier, type);
  // A little under the cap, so the walk never has to clip.
  const slope = maxSlope(t.scroll, type) * 0.98;
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
      const size = RG.jog[0] + nextFloat(rng) * (RG.jog[1] - RG.jog[0]);
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

  const xs = follow(goal, length, slope, lo, hi);
  const riverSide = type === 'riverbank' ? (nextFloat(rng) < 0.5 ? -1 : 1) : null;
  const knives: Course['knives'] = [];
  const scree: Course['scree'] = [];
  if (type === 'ridgeline') {
    // Knife edges every so often.
    if (hazards.knives !== false) {
      for (let d = T.leadIn + int(rng, RG.knifeEvery[0], RG.knifeEvery[1]); d < length - 40;) {
        const len = int(rng, RG.knifeLength[0], RG.knifeLength[1]);
        knives.push({ from: d, to: Math.min(length, d + len) });
        d += len + int(rng, RG.knifeEvery[0], RG.knifeEvery[1]);
      }
    }
    // Scree: the tier's patches in each section, kept apart from each other.
    const per = RG.tiers[tier].scree;
    const section = hazards.section ?? length;
    if (hazards.scree !== false && per[1] > 0) {
      for (let s0 = 0; s0 < length; s0 += section) {
        const n = int(rng, per[0], per[1]);
        for (let k = 0; k < n; k++) {
          for (let tries = 0; tries < 20; tries++) {
            const len = int(rng, RG.screeLength[0], RG.screeLength[1]);
            const from = s0 + T.leadIn / 2 + nextFloat(rng) * Math.max(1, section - len - T.leadIn);
            const to = Math.min(length, from + len);
            if (scree.some((p) => from < p.to + 30 && to > p.from - 30)) continue;
            scree.push({ from, to });
            break;
          }
        }
      }
      scree.sort((a, b) => a.from - b.from);
    }
  }
  return { type, length, width, xs, riverSide, knives, scree };
}
