/**
 * Trail Blocks (docs/design/14-minigames-trail-blocks.md, section 2): one
 * first-person timing game in four versions. Pure and seeded, stepped in
 * small steps.
 *
 * - **Chop Tree:** a marker sweeps across a bar with green zones at both
 *   ends; the closer to the outer edge, the stronger the swing.
 * - **Mine Rockslide:** hold to fill a power bar (it rises to the top, then
 *   drops while you hold); let go in the green zone, which moves after
 *   every swing. The middle of the zone is strongest.
 * - **River Flood:** a marker sweeps across a bar with a few green spots;
 *   hitting a spot scoops water and the spot is gone. A new set comes once
 *   they all are. The middle of a spot is strongest.
 * - **Clearing Animals:** a circle shrinks toward a ring; click when its
 *   edge is in the ring. Just outside it is a weak hit; a circle that
 *   passes the ring is a miss.
 *
 * **Energy:** one bar of each hiker's chunk, spent in line order. A swing
 * costs a little, a miss more, a perfect swing gives a little back. When a
 * hiker's chunk is empty they're out (and lose real energy) and the next
 * hiker takes over; the work done stays. **The work** clears the way for the
 * whole party; if every chunk runs out first, nobody gets past.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passingResult } from '../passing';
import type { MinigameResult, Tier } from '../types';

const B = BALANCE.minigames.trailBlocks;

export type { Tier };
export type Version = 'chop' | 'rockslide' | 'river' | 'animals';
export type Quality = 'perfect' | 'good' | 'weak' | 'miss';

export const VERSIONS: readonly { id: Version; name: string; hud: string; work: string }[] = [
  { id: 'chop', name: 'Chop Tree', hud: 'Chop tree', work: 'Tree' },
  { id: 'rockslide', name: 'Mine Rockslide', hud: 'Rockslide', work: 'Rocks' },
  { id: 'river', name: 'River Flood', hud: 'River flood', work: 'Water' },
  { id: 'animals', name: 'Clearing Animals', hud: 'Clear animals', work: 'Animals' },
];

export interface TrailBlocksState {
  version: Version;
  tier: Tier;
  order: string[];
  /** Each hiker's energy left in the bar, in line order, and whose is being spent. */
  chunks: number[];
  active: number;
  ranOut: string[];
  work: number;
  total: number;
  /** Playing; a swing is playing out (input waits); cleared; everyone ran out. */
  phase: 'play' | 'swing' | 'cleared' | 'out';
  swingLeft: number;
  time: number;
  /** Chop and River: how long the marker has been sweeping. */
  sweep: number;
  /** Rockslide: how long the button has been held (the power rises, then drops), and the zone's middle. */
  held: number;
  zone: number;
  /** River: the spots (their middles, 0 to 1) and which are gone. */
  spots: { at: number; hit: boolean }[];
  /** Animals: how long the current circle has been shrinking. */
  circle: number;
  lastSwing?: { work: number; quality: Quality; at: number };
  swings: number;
  rng: RngState;
}

/** A back-and-forth sweep: 0 → 1 over one pass, then back. */
const tri = (x: number): number => {
  const m = ((x % 2) + 2) % 2;
  return m < 1 ? m : 2 - m;
};

const between = (rng: RngState, a: number, b: number) => a + nextFloat(rng) * (b - a);

function newSpots(rng: RngState, tier: Tier): { at: number; hit: boolean }[] {
  const n = B.river.spots[tier];
  const w = B.river.spot[tier];
  // One in each slice of the bar, never touching the ends.
  return Array.from({ length: n }, (_, k) => {
    const lo = Math.max(w / 2 + 0.02, k / n + w / 2);
    const hi = Math.min(1 - w / 2 - 0.02, (k + 1) / n - w / 2);
    return { at: between(rng, lo, Math.max(lo, hi)), hit: false };
  });
}

const newZone = (rng: RngState, tier: Tier) => {
  const w = B.rockslide.zone[tier];
  return between(rng, 0.2 + w / 2, 1 - w / 2);
};

export function newTrailBlocks(
  options: { version: Version; tier: Tier },
  order: readonly string[],
  seed: number,
): TrailBlocksState {
  const rng = seedRng(seed);
  const w = B.work[options.tier];
  return {
    version: options.version,
    tier: options.tier,
    order: [...order],
    chunks: order.map(() => B.chunk),
    active: 0,
    ranOut: [],
    work: 0,
    total: w.base + w.perHiker * order.length,
    phase: order.length ? 'play' : 'out',
    swingLeft: 0,
    time: 0,
    sweep: 0,
    held: 0,
    zone: newZone(rng, options.tier),
    spots: newSpots(rng, options.tier),
    circle: 0,
    swings: 0,
    rng,
  };
}

// ── The controls ───────────────────────────────────────────────────────────

/** Chop and River: where the marker is on the bar (0 to 1). */
export const markerAt = (s: TrailBlocksState): number =>
  tri(s.sweep / (s.version === 'river' ? B.river.passSec[s.tier] : B.chop.passSec[s.tier]));

/** Rockslide: how full the power bar is (0 to 1). */
export const powerAt = (s: TrailBlocksState): number => tri(s.held / B.rockslide.fillSec[s.tier]);

/** Animals: the shrinking circle's radius. */
export const circleRadius = (s: TrailBlocksState): number => {
  const A = B.animals;
  return Math.max(0, A.ring.r * A.startScale * (1 - s.circle / A.shrinkSec[s.tier]));
};

/** How a swing went: its quality and accuracy (0 to 1, 1 the best), for the control now. */
export function judge(s: TrailBlocksState): { quality: Quality; accuracy: number; spot?: number } {
  const perfect = (d: number, half: number) => d <= B.perfectShare * half;
  switch (s.version) {
    case 'chop': {
      const z = B.chop.zone[s.tier];
      const pos = markerAt(s);
      // Strongest at the outer edges.
      const a = pos <= z ? 1 - pos / z : pos >= 1 - z ? (pos - (1 - z)) / z : -1;
      if (a < 0) return { quality: 'miss', accuracy: 0 };
      return { quality: a >= 1 - B.perfectShare ? 'perfect' : 'good', accuracy: a };
    }
    case 'rockslide': {
      const half = B.rockslide.zone[s.tier] / 2;
      const d = Math.abs(powerAt(s) - s.zone);
      if (d > half) return { quality: 'miss', accuracy: 0 };
      return { quality: perfect(d, half) ? 'perfect' : 'good', accuracy: 1 - d / half };
    }
    case 'river': {
      const half = B.river.spot[s.tier] / 2;
      const pos = markerAt(s);
      let best = -1;
      let bestD = Infinity;
      s.spots.forEach((sp, k) => {
        const d = Math.abs(pos - sp.at);
        if (!sp.hit && d <= half && d < bestD) {
          best = k;
          bestD = d;
        }
      });
      if (best < 0) return { quality: 'miss', accuracy: 0 };
      return {
        quality: perfect(bestD, half) ? 'perfect' : 'good',
        accuracy: 1 - bestD / half,
        spot: best,
      };
    }
    case 'animals': {
      const half = B.animals.thickness[s.tier] / 2;
      const d = Math.abs(circleRadius(s) - B.animals.ring.r);
      if (d <= half)
        return { quality: perfect(d, half) ? 'perfect' : 'good', accuracy: 1 - d / half };
      if (d <= half + B.animals.weakReach) return { quality: 'weak', accuracy: 0 };
      return { quality: 'miss', accuracy: 0 };
    }
  }
}

/** The work a swing does. */
export function workFor(quality: Quality, accuracy: number): number {
  if (quality === 'perfect') return B.perfect;
  if (quality === 'weak') return B.animals.weakWork;
  if (quality === 'miss') return 0;
  return B.good[0] + (B.good[1] - B.good[0]) * Math.max(0, Math.min(1, accuracy));
}

// ── Swinging and spending ──────────────────────────────────────────────────

/** A swing lands: spend the energy, do the work, and move the control on. */
function land(
  s0: TrailBlocksState,
  quality: Quality,
  accuracy: number,
  spot?: number,
): TrailBlocksState {
  const rng = [...s0.rng] as RngState;
  const work = workFor(quality, accuracy);
  const cost = quality === 'miss' ? B.missCost : B.swingCost;
  const chunks = [...s0.chunks];
  const i = s0.active;
  chunks[i] = Math.max(0, chunks[i]! - cost);
  if (quality === 'perfect' && chunks[i]! > 0)
    chunks[i] = Math.min(B.chunk, chunks[i]! + B.perfectRefund);
  let active = i;
  const ranOut = [...s0.ranOut];
  if (chunks[i]! <= 0) {
    ranOut.push(s0.order[i]!);
    active = i + 1;
  }
  const done = Math.min(s0.total, s0.work + work);
  let s: TrailBlocksState = {
    ...s0,
    rng,
    chunks,
    active,
    ranOut,
    work: done,
    swings: s0.swings + 1,
    lastSwing: { work, quality, at: s0.time },
  };
  // The control moves on.
  if (s.version === 'rockslide') s = { ...s, held: 0, zone: newZone(rng, s.tier) };
  if (s.version === 'animals') s = { ...s, circle: 0 };
  if (s.version === 'river' && spot !== undefined) {
    const spots = s.spots.map((sp, k) => (k === spot ? { ...sp, hit: true } : sp));
    s = { ...s, spots: spots.every((sp) => sp.hit) ? newSpots(rng, s.tier) : spots };
  }
  if (done >= s.total) return { ...s, phase: 'cleared' };
  if (active >= s.order.length) return { ...s, phase: 'out' };
  return { ...s, phase: 'swing', swingLeft: B.swingSec };
}

/** A press: Chop, River and Animals swing now (the Rockslide swings on release). */
export function press(s: TrailBlocksState): TrailBlocksState {
  if (s.phase !== 'play' || s.version === 'rockslide') return s;
  const j = judge(s);
  return land(s, j.quality, j.accuracy, j.spot);
}

/** Letting go of the Rockslide's power bar: the swing. */
export function release(s: TrailBlocksState): TrailBlocksState {
  if (s.phase !== 'play' || s.version !== 'rockslide' || s.held <= 0) return s;
  const j = judge(s);
  return land(s, j.quality, j.accuracy);
}

/**
 * Time passes: the swing plays out, the marker sweeps, the power bar fills
 * while held, and the circle shrinks (one that passes the ring is a miss).
 */
export function tick(s0: TrailBlocksState, dt: number, holding: boolean): TrailBlocksState {
  if (s0.phase === 'cleared' || s0.phase === 'out') return s0;
  let s: TrailBlocksState = { ...s0, time: s0.time + dt, sweep: s0.sweep + dt };
  if (s.phase === 'swing') {
    const swingLeft = s.swingLeft - dt;
    s = swingLeft <= 0 ? { ...s, phase: 'play', swingLeft: 0 } : { ...s, swingLeft };
    return s;
  }
  if (s.version === 'rockslide' && holding) s = { ...s, held: s.held + dt };
  if (s.version === 'animals') {
    s = { ...s, circle: s.circle + dt };
    const A = B.animals;
    const inner = A.ring.r - A.thickness[s.tier] / 2 - A.weakReach;
    if (circleRadius(s) < inner) return land(s, 'miss', 0);
  }
  return s;
}

// ── What it shows ──────────────────────────────────────────────────────────

/** Whose chunk is being spent. */
export const activeHiker = (s: TrailBlocksState): string | undefined => s.order[s.active];

/** How far along the obstacle is drawn: stage 0 to 4. */
export const stage = (s: TrailBlocksState): number =>
  Math.min(4, Math.floor((s.work / s.total) * 5));

/** Animals: how many are still on the trail. */
export const animalsLeft = (s: TrailBlocksState): number =>
  Math.ceil(B.animals.crowd * (1 - s.work / s.total) - 1e-9);

/** River: where the top of the water is (scene y). */
export const waterTop = (s: TrailBlocksState): number => {
  const [full, clear] = B.river.waterTop;
  return full + (clear - full) * (s.work / s.total);
};

/**
 * The passing result: cleared, the whole party moves on and only hikers
 * who ran out pay; everyone out, nobody gets past.
 */
export function result(s: TrailBlocksState): MinigameResult {
  const costs = Object.fromEntries(s.ranOut.map((id) => [id, { energy: B.ranOutEnergy }]));
  return passingResult(s.order, s.tier, s.phase === 'cleared' ? s.order : [], costs);
}
