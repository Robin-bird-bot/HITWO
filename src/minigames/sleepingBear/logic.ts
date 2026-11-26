/**
 * Sleeping Bear (docs/design/14-minigames-trail-blocks.md, section 3): red
 * light, green light past a sleeping bear. Pure and seeded, stepped in
 * small steps.
 *
 * - One hiker at a time, in line order, walks from the post to the flag
 *   while the button (Space, the mouse or a finger) is held.
 * - The bear sleeps, stirs (the warning), wakes and looks around, then
 *   sleeps again. On Tiers II and III he sometimes stirs and goes back to
 *   sleep without waking (a fake-out).
 * - Moving while he's awake, after a short grace, gets the hiker caught:
 *   he roars, and after a moment the next hiker starts from the post.
 * - One shared clock: time per hiker × hikers. When it runs out, everyone
 *   not across fails.
 *
 * A passing challenge: hikers across move on; caught ones lose a resource
 * and gain Bleeding; ones out of time lose energy.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passingResult } from '../passing';
import type { MinigameResult, Pay, Tier } from '../types';

const SB = BALANCE.minigames.sleepingBear;

export type { Tier };
export type Bear = 'asleep' | 'stir' | 'awake' | 'roar';
export type HikerStatus = 'waiting' | 'sneaking' | 'across' | 'caught' | 'timeout';

export interface SleepingBearState {
  tier: Tier;
  /** Prepare's QUIET STEPS: his stir lasts this many times as long. */
  quiet: number;
  order: string[];
  /** Whose turn it is, and how far along the path they are. */
  current: number;
  pos: number;
  /** Whether the current hiker is moving this step (for the walk frames). */
  moving: boolean;
  bear: Bear;
  /** Seconds left in the bear's state, and (while stirring) whether it's a fake-out. */
  bearLeft: number;
  fake: boolean;
  /** Seconds since his eyes opened. */
  awakeFor: number;
  fakeOut: number;
  status: Record<string, HikerStatus>;
  clock: number;
  total: number;
  time: number;
  over: boolean;
  rng: RngState;
}

const between = (rng: RngState, [a, b]: readonly [number, number]) => a + nextFloat(rng) * (b - a);

export function newSleepingBear(
  options: {
    tier: Tier;
    fakeOuts?: 'auto' | 'on' | 'off';
    /** Prepare: the share lighter he sleeps (a longer stir), and seconds more on the clock. */
    quiet?: number;
    extraSec?: number;
  },
  order: readonly string[],
  seed: number,
): SleepingBearState {
  const rng = seedRng(seed);
  const t = SB.tiers[options.tier];
  const fakeOut =
    options.fakeOuts === 'off'
      ? 0
      : options.fakeOuts === 'on'
        ? t.fakeOut || SB.fakeOutOn
        : t.fakeOut;
  const total = t.secPerHiker * order.length + (options.extraSec ?? 0);
  return {
    tier: options.tier,
    quiet: 1 / (1 - Math.max(0, Math.min(0.6, options.quiet ?? 0))),
    order: [...order],
    current: 0,
    pos: 0,
    moving: false,
    bear: 'asleep',
    bearLeft: between(rng, t.asleep),
    fake: false,
    awakeFor: 0,
    fakeOut,
    status: Object.fromEntries(order.map((id, i) => [id, i === 0 ? 'sneaking' : 'waiting'])),
    clock: total,
    total,
    time: 0,
    over: order.length === 0,
    rng,
  };
}

/** The current hiker is done (across or caught): the next one starts from the post, or it's over. */
function nextHiker(s: SleepingBearState): SleepingBearState {
  const current = s.current + 1;
  const id = s.order[current];
  if (!id) return { ...s, current, pos: 0, moving: false, over: true };
  return { ...s, current, pos: 0, moving: false, status: { ...s.status, [id]: 'sneaking' } };
}

/** The bear moves on to his next state. */
function nextBear(s: SleepingBearState, rng: RngState): SleepingBearState {
  const t = SB.tiers[s.tier];
  switch (s.bear) {
    case 'asleep':
      return {
        ...s,
        bear: 'stir',
        bearLeft: t.stirSec * s.quiet,
        fake: nextFloat(rng) < s.fakeOut,
      };
    case 'stir':
      return s.fake
        ? { ...s, bear: 'asleep', bearLeft: between(rng, t.asleep), fake: false }
        : { ...s, bear: 'awake', bearLeft: between(rng, t.awake), awakeFor: 0 };
    case 'awake':
      return { ...s, bear: 'asleep', bearLeft: between(rng, t.asleep) };
    case 'roar': {
      // The roar is over: back to sleep, and the next hiker goes.
      const next = nextHiker(s);
      return { ...next, bear: 'asleep', bearLeft: between(rng, t.asleep) };
    }
  }
}

/**
 * The shared clock this step (Nov 25): it stops while he's awake and while
 * a caught hiker is sent off (you can't lose time standing still while he
 * looks around); while he stirs and the hiker keeps moving it goes up (a
 * risk: he might wake); otherwise it counts down by the step's time.
 */
function clockAfter(s0: SleepingBearState, s: SleepingBearState, dt: number): number {
  if (s0.bear === 'awake' || s0.bear === 'roar') return s0.clock;
  if (s0.bear === 'stir' && s.moving) return Math.min(s0.total, s0.clock + SB.stirEarnRate * dt);
  return s0.clock - dt;
}

/** Out of time: everyone not across fails. */
function outOfTime(s: SleepingBearState): SleepingBearState {
  const status = { ...s.status };
  for (const id of s.order) {
    if (status[id] === 'waiting' || status[id] === 'sneaking') status[id] = 'timeout';
  }
  return { ...s, clock: 0, status, moving: false, over: true };
}

/** Time passes; `holding` is whether the button is down (the current hiker walks). */
export function tick(s0: SleepingBearState, dt: number, holding: boolean): SleepingBearState {
  if (s0.over) return s0;
  const s = step(s0, dt, holding);
  const clock = clockAfter(s0, s, dt);
  if (clock <= 0 && !s.over) return outOfTime({ ...s, clock: 0 });
  return { ...s, clock: Math.max(0, clock) };
}

/** The bear and the hiker move on by one step (the clock is worked out after). */
function step(s0: SleepingBearState, dt: number, holding: boolean): SleepingBearState {
  const rng = [...s0.rng] as RngState;
  let s: SleepingBearState = { ...s0, rng, time: s0.time + dt };

  // The bear.
  s = { ...s, bearLeft: s.bearLeft - dt, awakeFor: s.bear === 'awake' ? s.awakeFor + dt : 0 };
  if (s.bearLeft <= 0) s = nextBear(s, rng);
  if (s.over || s.bear === 'roar') return { ...s, moving: false };

  // The hiker.
  const id = s.order[s.current];
  if (!id || s.status[id] !== 'sneaking') return { ...s, moving: false };
  if (!holding) return { ...s, moving: false };
  if (s.bear === 'awake' && s.awakeFor > SB.graceSec) {
    return {
      ...s,
      moving: false,
      status: { ...s.status, [id]: 'caught' },
      bear: 'roar',
      bearLeft: SB.roarSec,
    };
  }
  const pos = s.pos + SB.speed * dt;
  if (pos >= SB.path)
    return nextHiker({ ...s, pos: SB.path, status: { ...s.status, [id]: 'across' } });
  return { ...s, pos, moving: true };
}

/** A passing challenge: across moves on; caught pays a resource and Bleeding; out of time pays energy. */
export function result(s: SleepingBearState): MinigameResult {
  const costs: Record<string, Pay> = {};
  for (const id of s.order) {
    if (s.status[id] === 'caught')
      costs[id] = { resources: SB.caught.resources, conditions: [SB.caught.condition] };
    if (s.status[id] === 'timeout') costs[id] = { energy: SB.timeOutEnergy };
  }
  const across = s.order.filter((id) => s.status[id] === 'across');
  return passingResult(s.order, s.tier, across, costs);
}
