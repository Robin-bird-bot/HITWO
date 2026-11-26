/**
 * Passing challenges (docs/design/14-minigames-trail-blocks.md, section 1):
 * challenges that stand between the party and a tile.
 *
 * - Hikers who pass move onto the tile.
 * - Hikers who fail go back to the tile they came from and pay the game's
 *   cost.
 * - If at least one hiker passes, the challenge is gone from the tile.
 * - If nobody passes, everyone goes back and loses at least [1] energy ([2]
 *   at Tier III), and the challenge stays on the tile, face up, until
 *   someone passes it.
 *
 * Challenges don't run from tiles yet, so this only describes what should
 * happen: the result carries it (`passing` and `pays`), and the results card
 * shows it. Test mode never changes the save.
 */
import { BALANCE } from '../config/balance';
import { RESOURCES } from '../content/resources';
import type { MinigameResult, Pay, Tier } from './types';

const P = BALANCE.minigames.passing;

export type { Tier };

const isEmpty = (p: Pay | undefined) =>
  !p || (!p.energy && !p.resources && !p.stolen?.length && !(p.conditions && p.conditions.length));

/**
 * The result of a passing challenge. `costs` is what each hiker who fails
 * pays (a passer can pay too: a Trail Block hiker who ran out still moves
 * on with the party).
 */
export function passingResult(
  order: readonly string[],
  tier: Tier,
  passed: readonly string[],
  costs: Readonly<Record<string, Pay>>,
): MinigameResult {
  const moveOn = order.filter((id) => passed.includes(id));
  const goBack = order.filter((id) => !passed.includes(id));
  const stays = moveOn.length === 0 && order.length > 0;
  const pays: Record<string, Pay> = {};
  for (const id of order) {
    const own = costs[id] ?? {};
    const pay: Pay = stays
      ? { ...own, energy: Math.max(own.energy ?? 0, P.nobodyEnergy[tier]) }
      : { ...own };
    if (!isEmpty(pay)) pays[id] = pay;
  }
  return {
    safe: moveOn,
    hit: goBack.map((hikerId) => ({ hikerId, round: 0 })),
    wording: 'passed-failed',
    pays,
    passing: { moveOn, goBack, stays },
  };
}

/** A cost in words: "−1 Energy · −1 resource · −1 Wood · Bleeding". */
export function payText(p: Pay | undefined): string {
  if (!p) return '';
  const parts: string[] = [];
  if (p.energy) parts.push(`−${p.energy} Energy`);
  if (p.resources) parts.push(`−${p.resources} resource${p.resources === 1 ? '' : 's'}`);
  for (const [name, n] of stolenCounts(p.stolen)) parts.push(`−${n} ${name}`);
  for (const c of p.conditions ?? []) parts.push(c.charAt(0).toUpperCase() + c.slice(1));
  return parts.join(' · ');
}

/** Stolen resources as [name, how many], in the order first taken: wood, wood, salt → Wood 2, Salt 1. */
export function stolenCounts(stolen: readonly string[] | undefined): [string, number][] {
  const counts = new Map<string, number>();
  for (const id of stolen ?? []) {
    const name = RESOURCES.find((r) => r.id === id)?.name ?? id;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts];
}
