/**
 * The hikers at the packing machine (27-packing-screen.md, section 1).
 * Starting traits and kits still apply, so a dry run of the hike without
 * packing tells each hiker's START items (shown in their bag first, taking
 * up room), their bag slots, and how many more resources they can hold.
 */
import { bagSlots, createGame, resourceCount, resourceLimit, type HikerSetup } from '../engine';
import type { Seat } from './logic';

export function seatsFor(seed: number, hikers: readonly HikerSetup[]): Seat[] {
  const dry = createGame({ seed, hikers, startingResources: false });
  return dry.hikers.map((h) => ({
    id: h.id,
    name: h.name,
    color: h.color ?? '#C9C2B2',
    start: h.inventory.bag.map((i) => i.itemId),
    bagSlots: bagSlots(dry, h).total,
    resourceRoom: Math.max(0, resourceLimit(dry, h) - resourceCount(h)),
  }));
}
