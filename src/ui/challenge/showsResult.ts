/**
 * When the challenge pop-up is followed by a "what happened" panel: after a
 * Risk roll, a Challenge space's rewards, a deal that was taken, or a failed
 * challenge whose penalty is left to chance (Freeagle: each Fish, Meat or
 * Mushroom has a 50% chance to be stolen), so the party sees what went.
 */
import { CARDS } from '../../content';
import type { Effect, GameEvent, GameState } from '../../engine';

export interface ResultToShow {
  cardId: string;
  /** The challenge's log event: its line and everything after it. */
  fromId: number;
}

type ChallengeEvent = Extract<GameEvent, { kind: 'challenge' }>;

/** Should this resolved card show what happened? Not a skipped opportunity: nothing did. */
export function showsResult(
  state: GameState,
  event: ChallengeEvent,
  challengeSpace: boolean,
): boolean {
  const card = CARDS[event.cardId];
  if (!card || card.kind === 'trial') return false;
  if (card.kind === 'opportunity') return event.results.some((r) => r.passed);
  const failed = event.results.some((r) => !r.passed);
  if (failed && card.penalty.some(isRandom)) return true;
  return !!card.risk || challengeSpace || !!state.debugRolls;
}

/** Penalty parts that pick at random, so what they take isn't known until they're rolled. */
const RANDOM_PICKS: ReadonlySet<Effect['op']> = new Set<Effect['op']>([
  'loseEachResource',
  'loseBagItems',
  'loseResources',
  'loseAllOf',
  'loseItem',
  'loseClothes',
  'spoilFood',
  'stealItems',
  'swapResources',
  'swapItemFar',
  'randomCondition',
  'nodesVanish',
  'nodesBecome',
]);

/** A penalty part left to chance: a roll for it, or a random pick of what it takes. */
export function isRandom(e: Effect): boolean {
  if (e.chance !== undefined || RANDOM_PICKS.has(e.op)) return true;
  if (e.op === 'loseFood') return e.mode === 'each';
  if (e.op === 'abundance') return e.repeatChance !== undefined;
  if (e.op === 'wearClothes') return e.which === 'one';
  return false;
}

/** The parts of a penalty that take things away (resources, items, food, clothes). */
const LOSSES: ReadonlySet<Effect['op']> = new Set<Effect['op']>([
  'loseEachResource',
  'loseBagItems',
  'loseResources',
  'loseAllOf',
  'loseItem',
  'loseClothes',
  'loseFood',
  'spoilFood',
  'stealItems',
]);

/**
 * The line to add when a failed card's chance came up empty: its losses
 * missed everyone ("Nothing was lost."), or nothing at all happened.
 */
export function nothingHappenedLine(
  state: GameState,
  result: ResultToShow,
  failed: boolean,
): string | null {
  const card = CARDS[result.cardId];
  if (!failed || !card || card.kind === 'trial') return null;
  const random = card.penalty.filter(isRandom);
  if (!random.length) return null;
  const after = state.log.filter((e) => e.id > result.fromId);
  const lost = after.some((e) => e.kind === 'lost' || e.kind === 'itemGone');
  if (random.some((e) => LOSSES.has(e.op))) return lost ? null : 'Nothing was lost.';
  return after.length ? null : 'Nothing happened this time.';
}
