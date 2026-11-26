/**
 * How each hiker looks in a minigame (docs/design/10-minigames.md, "Hikers"):
 * their own color, the same one that rings their portrait, so they're easy
 * to spot on the green screen. A hiker in a run uses their party color;
 * otherwise their own color (palette.ts).
 */
import { BALANCE } from '../config/balance';
import { RESOURCES } from '../content/resources';
import { ROSTER_BY_ID } from '../content/roster';
import { ITEMS } from '../content/items';
import { valueAt } from '../engine/items/quality';
import { int, pick, seedRng } from '../engine/rng';
import type { Pack, PackItem } from './prepare';
import type { MinigameHiker } from './types';
import { HIKER_COLORS } from './palette';

const COLORS: Readonly<Record<string, string>> = HIKER_COLORS;
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

/**
 * Every item a Prepare row takes (docs/design/20-challenge-popup.md,
 * section 7), for the testing tab's packs. Woodcutting Axe and Pickaxe are
 * in the design but not in the game's items yet.
 */
export const PREPARE_ITEMS: readonly string[] = [
  'bearSpray',
  'thinkingCap',
  'glasses',
  'supplyMap',
  'treasureMap',
  'campingLamp',
  'camera',
  'oldPhoto',
  'hikingStick',
  'instructionManual',
  'textbook',
  'binoculars',
  'woodcuttingAxe',
  'pickaxe',
  'shovel',
  'sack',
  'harness',
];

export type TestPacks = 'madeUp' | 'empty' | 'lots';

/** An item for a test pack: tools carry their uses (Quality 3), the rest don't track any. */
function testItem(itemId: string, uid: string): PackItem {
  const uses = ITEMS[itemId]?.uses;
  if (uses === undefined) return { uid, itemId };
  return { uid, itemId, usesLeft: typeof uses === 'number' ? uses : valueAt(uses, 3) };
}

/**
 * The testing tab's Packs (20-challenge-popup.md, section 1): Made-up (a few
 * random resources and items, from the seed and the hiker), Empty, or Lots
 * ([6] of every resource and one of every Prepare item). Placeholder: test
 * hikers carry nothing of their own.
 */
export function testPacks(kind: TestPacks, seed: number, hikerId: string): Pack {
  const known = PREPARE_ITEMS.filter((id) => ITEMS[id]);
  if (kind === 'empty') return { resources: {}, items: [] };
  if (kind === 'lots') {
    const n = BALANCE.minigames.prepare.packs.lots;
    return {
      resources: Object.fromEntries(RESOURCES.map((r) => [r.id, n])),
      items: known.map((id, k) => testItem(id, `${hikerId}-${k}`)),
    };
  }
  let h = (seed ^ 0x5bd1e995) >>> 0;
  for (const c of hikerId) h = (Math.imul(h ^ c.charCodeAt(0), 16777619) + 1) >>> 0;
  const rng = seedRng(h);
  const P = BALANCE.minigames.prepare.packs.madeUp;
  const resources: Record<string, number> = {};
  for (let k = int(rng, P.kinds[0], P.kinds[1]); k > 0; k--) {
    const id = pick(rng, RESOURCES).id;
    resources[id] = (resources[id] ?? 0) + int(rng, 1, 3);
  }
  const items = Array.from({ length: int(rng, P.items[0], P.items[1]) }, (_, k) =>
    testItem(pick(rng, known), `${hikerId}-${k}`),
  );
  return { resources, items };
}
