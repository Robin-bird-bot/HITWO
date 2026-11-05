/**
 * Picking what a new tile holds (04-challenges.md and the Nov 5 update, 3d):
 * - Roll the mix (70% challenge, 20% Trial, 10% opportunity).
 * - Keep cards whose nodes match the tile, whose tier matches, whose gates
 *   pass (snow, weather, afternoon, a Dog here), whose systems exist, and
 *   that this section hasn't used.
 * - Special spaces: Opportunity is always an opportunity; Challenge draws
 *   from the next tier's list (Tier III, with none above, scales ×1.5);
 *   Choice offers two challenges.
 */
import { BALANCE } from '../../config/balance';
import { CHALLENGES, OPPORTUNITIES, TRIALS } from '../../content/challenges';
import { weightedPick } from '../rng';
import type { GameState, Hiker, RngState, Tile } from '../types';
import { notBuiltYet } from './rolls';
import type { CardDef, ChallengeKind, Gate, Tier } from './types';

export interface Picked {
  cardId: string;
  /** The tier it's played at. */
  tier: Tier;
  /** Ranges are scaled by this (TIER_SCALE when a Tier III card plays one tier up). */
  scale: number;
  /** A Choice space: the other challenge the party could pick instead. */
  alternative?: string;
}

const MAX_TIER: Tier = 3;

/** Why a card can't be played at all yet, if anything (a system that isn't built). */
export function notPlayableYet(card: CardDef): string | undefined {
  if (card.kind === 'trial') return card.goal.kind === 'off' ? card.goal.waitingOn : undefined;
  if (card.waitingOn) return card.waitingOn;
  if (card.risk) {
    const canSpend = card.risk.spend.some((s) => !('durability' in s));
    return canSpend ? undefined : 'phase 9 (clothing durability)';
  }
  if (card.cost.length === 0) return undefined;
  const payable = card.cost.some((option) => !option.some(notBuiltYet));
  return payable ? undefined : 'phase 9 (clothing durability or tool uses)';
}

export function gatePasses(gate: Gate, state: GameState, onTile: readonly Hiker[]): boolean {
  switch (gate) {
    case 'snow':
      return !!state.snowy;
    case 'stormy':
      return state.weather === 'stormy';
    case 'sunny':
      return state.weather === 'sunny';
    case 'afternoon':
      return state.phase === 'afternoon';
    case 'dogOnTile':
      return onTile.some((h) => h.family === 'dog');
  }
}

function nodesMatch(card: CardDef, tile: Tile): boolean {
  if (card.nodes === 'any') return true;
  return tile.nodes.some((n) => n.type !== 'caps' && card.nodes.includes(n.type));
}

/** Can this card appear on this tile right now (ignoring "used this section")? */
export function cardFits(
  card: CardDef,
  state: GameState,
  tile: Tile,
  onTile: readonly Hiker[],
  tier: Tier,
): boolean {
  if (notPlayableYet(card)) return false;
  // Opportunities are written for Tier I and can appear at any tier.
  if (card.kind === 'opportunity' ? card.tier > tier : card.tier !== tier) return false;
  if (!nodesMatch(card, tile)) return false;
  return (card.gates ?? []).every((g) => gatePasses(g, state, onTile));
}

function pool(kind: ChallengeKind): readonly CardDef[] {
  if (kind === 'trial') return TRIALS;
  if (kind === 'opportunity') return OPPORTUNITIES;
  return CHALLENGES;
}

/** Picks one card of a kind, preferring ones this section hasn't used. */
function pickOne(
  rng: RngState,
  kind: ChallengeKind,
  state: GameState,
  tile: Tile,
  onTile: readonly Hiker[],
  tier: Tier,
  exclude: readonly string[] = [],
): string | undefined {
  const fits = pool(kind).filter(
    (c) => cardFits(c, state, tile, onTile, tier) && !exclude.includes(c.id),
  );
  const fresh = fits.filter((c) => !state.usedCards.includes(c.id));
  const from = fresh.length ? fresh : fits;
  if (!from.length) return undefined;
  return weightedPick(
    rng,
    from.map((c) => ({ item: c.id, weight: BALANCE.challenges.weights[c.id] ?? 1 })),
  );
}

/** The tier a tile's card plays at, before Challenge spaces. */
export function tileTier(state: GameState, tile: Tile): number {
  return state.section.tier + (tile.tierBonus ?? 0);
}

/** Splits a tier above III into Tier III plus a scale. */
function playable(tier: number): { tier: Tier; scale: number } {
  if (tier <= MAX_TIER) return { tier: Math.max(1, tier) as Tier, scale: 1 };
  return { tier: MAX_TIER, scale: BALANCE.challenges.tierScale ** (tier - MAX_TIER) };
}

export function pickForTile(
  state: GameState,
  rng: RngState,
  tile: Tile,
  onTile: readonly Hiker[],
): Picked | undefined {
  const base = tileTier(state, tile);

  if (tile.special === 'opportunity') {
    const { tier, scale } = playable(base);
    const id = pickOne(rng, 'opportunity', state, tile, onTile, tier);
    return id ? { cardId: id, tier, scale } : undefined;
  }

  if (tile.special === 'challenge') {
    // The next tier's list (Wyatt, Nov 5); Tier III has none above, so it scales.
    const { tier, scale } = playable(base + 1);
    const id = pickOne(rng, 'challenge', state, tile, onTile, tier);
    return id ? { cardId: id, tier, scale } : undefined;
  }

  const { tier, scale } = playable(base);

  if (tile.special === 'choice') {
    const first = pickOne(rng, 'challenge', state, tile, onTile, tier);
    if (!first) return undefined;
    const second = pickOne(rng, 'challenge', state, tile, onTile, tier, [first]);
    return { cardId: first, tier, scale, ...(second ? { alternative: second } : {}) };
  }

  const { challenge, trial, opportunity } = BALANCE.challenges.mix;
  const trialsFull = (state.trials?.length ?? 0) >= BALANCE.challenges.maxTrials;
  const kind = weightedPick<ChallengeKind>(rng, [
    { item: 'challenge', weight: challenge },
    { item: 'trial', weight: trialsFull ? 0 : trial },
    { item: 'opportunity', weight: opportunity },
  ]);
  // If nothing of that kind fits here, fall back to a challenge, then an opportunity.
  for (const k of [kind, 'challenge', 'opportunity'] as ChallengeKind[]) {
    const id = pickOne(rng, k, state, tile, onTile, tier);
    if (id) return { cardId: id, tier, scale };
  }
  return undefined;
}
