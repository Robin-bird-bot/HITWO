/**
 * How each hiker looks in a minigame (docs/design/10-minigames.md, "Hikers"):
 * their own color, the same one that rings their portrait, so they're easy
 * to spot on the green screen. A hiker in a run uses their party color;
 * otherwise their color from Bearrels' layout.json.
 */
import { BALANCE } from '../config/balance';
import { RESOURCES } from '../content/resources';
import { ROSTER_BY_ID } from '../content/roster';
import { int, pick, seedRng } from '../engine/rng';
import type { MinigameHiker } from './types';
import LAYOUT from '../../public/assets/minigames/bearrels/layout.json';

const COLORS: Readonly<Record<string, string>> = LAYOUT.colors.hikers;
/** Roster ids that the art names differently. */
const ART_ID: Readonly<Record<string, string>> = { grandpaWink: 'wink' };

/** A hiker as a minigame draws them. `color`: their party color in a run, when there is one. */
export function minigameHiker(id: string, color?: string): MinigameHiker {
  const roster = ROSTER_BY_ID.get(id);
  const art = ART_ID[id] ?? id;
  return {
    id,
    name: roster?.name.replace(/^Grandpa /, '') ?? id,
    color: color ?? COLORS[art] ?? '#C9C2B2',
    art,
  };
}

/** The art ids that have minigame sprites. */
export const HIKER_ART: readonly string[] = Object.keys(COLORS);

/**
 * A made-up pack for the testing tab (placeholder: test hikers carry
 * nothing): [2–6] random resources, from the seed and the hiker, so a replay
 * gives the same pack. Raccoon Shuffle's raccoons steal from it.
 */
export function testPack(seed: number, hikerId: string): Partial<Record<string, number>> {
  let h = seed >>> 0;
  for (const c of hikerId) h = (Math.imul(h ^ c.charCodeAt(0), 16777619) + 1) >>> 0;
  const rng = seedRng(h);
  const [lo, hi] = BALANCE.minigames.raccoonShuffle.testPack;
  const pack: Partial<Record<string, number>> = {};
  for (let k = int(rng, lo, hi); k > 0; k--) {
    const id = pick(rng, RESOURCES).id;
    pack[id] = (pack[id] ?? 0) + 1;
  }
  return pack;
}
