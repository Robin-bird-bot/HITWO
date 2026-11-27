/**
 * Picking what a new tile holds (04-challenges.md and the Nov 5 update, 3d):
 * - The tier (15-challenge-tiers.md, Nov 25): each tile's challenge rolls
 *   its tier from its biome's table (Normal, or Nightmare's), fixed for that
 *   tile (from the run's seed, the section and the tile), then the tile's
 *   Harder/Easier changes and the difficulty's offset are added. Above
 *   Tier III it plays a Tier III card with its ranges scaled up.
 * - Roll the mix (70% challenge, 20% Trial, 10% opportunity).
 * - Keep cards whose nodes match the tile, whose tier matches, whose gates
 *   pass (snow, weather, afternoon, a Dog here), whose systems exist, and
 *   that this section hasn't used.
 * - Special spaces: Opportunity is always an opportunity; Challenge draws
 *   from the next tier's list (Tier III, with none above, scales ×1.5);
 *   Choice offers two challenges.
 */
import { BALANCE } from '../../config/balance';
import { difficultyOf } from '../../config/difficulty';
import { CHALLENGES, OPPORTUNITIES, TRIALS } from '../../content/challenges';
import { seedRng, weightedPick } from '../rng';
import type { GameState, Hiker, RngState, Tile } from '../types';
import type { CardDef, ChallengeKind, Gate, Tier } from './types';

export interface Picked {
  cardId: string;
  /** The tier of the card it plays (I to III). */
  tier: Tier;
  /** The tier it shows (I to V): above III, a Tier III card scaled up. */
  shownTier: number;
  /** Ranges are scaled by this (TIER_SCALE when a Tier III card plays one tier up). */
  scale: number;
  /** A Choice space: the other challenge the party could pick instead. */
  alternative?: string;
}

const MAX_TIER: Tier = 3;

/** Why a card can't be played at all yet, if anything (a system that isn't built). */
export function notPlayableYet(card: CardDef): string | undefined {
  if (card.kind === 'trial') {
    // Trials are switched off for now (Phase 10.6), Rocco's included.
    if (card.enabled === false) return 'Trials are switched off for now.';
    return card.goal.kind === 'off' ? card.goal.waitingOn : undefined;
  }
  return card.waitingOn;
}

export function gatePasses(gate: Gate, state: GameState, onTile: readonly Hiker[]): boolean {
  switch (gate) {
    case 'snow':
      return !!state.snowy;
    // Weather no longer picks challenges (Phase 10.6): Storm, Lightning and
    // Blazing Sun can come up in any weather. TODO(wyatt): or leave them out?
    case 'stormy':
    case 'sunny':
      return true;
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
  // Opportunities are written for Tier I and can appear at any tier; a
  // challenge from its "From" tier on (24-challenges-reset.md, section 4).
  if (card.kind === 'trial' ? card.tier !== tier : card.tier > tier) return false;
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
  // Repeats are fine for challenges now (Nov 26 evening); opportunities keep their rule.
  const fresh = kind === 'challenge' ? fits : fits.filter((c) => !state.usedCards.includes(c.id));
  const from = fresh.length ? fresh : fits;
  if (!from.length) return undefined;
  return weightedPick(
    rng,
    from.map((c) => ({ item: c.id, weight: BALANCE.challenges.weights[c.id] ?? 1 })),
  );
}

/** Another challenge of this tier for a tile, not one of `exclude` (Rule Changer's swap). */
export function pickChallengeAt(
  state: GameState,
  rng: RngState,
  tile: Tile,
  tier: Tier,
  exclude: readonly string[],
): string | undefined {
  return pickOne(rng, 'challenge', state, tile, [], tier, exclude);
}

/** The highest tier a challenge can have. */
export const TOP_TIER = 5;

/** A small, steady hash of a string (FNV-1a), to seed a tile's own roll. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Which biome of the run a section is (0, 1 or 2), for the tier tables. */
function biomeIndex(state: GameState): number {
  const at = BALANCE.run.biomes.indexOf(state.section.biome);
  return Math.max(0, Math.min(2, at >= 0 ? at : state.sectionIndex));
}

/**
 * A tile's rolled tier, from its biome's table (Nightmare's on Nightmare,
 * otherwise Normal's). It's fixed for the tile: the roll comes from the
 * run's seed, the section and the tile, so it never changes on a reload
 * and scouting tools see the same tier.
 */
export function rolledTier(state: GameState, tile: Pick<Tile, 'id'>): number {
  const T = BALANCE.challenges.tierTables;
  const table = (state.difficulty === 'nightmare' ? T.nightmare : T.normal)[biomeIndex(state)]!;
  const rng = seedRng(hash(`${state.seed}|${state.sectionIndex}|${tile.id}`));
  return weightedPick(
    rng,
    table.map(([tier, weight]) => ({ item: tier, weight })),
  );
}

/** The tier a tile's card plays at, before Challenge spaces. */
export function tileTier(state: GameState, tile: Tile): number {
  return rolledTier(state, tile) + (tile.tierBonus ?? 0) + difficultyOf(state).challengeTierOffset;
}

/**
 * Opportunities have one list, written for Tier I: their X ranges scale by
 * TIER_SCALE for each tier above I (Nov 6 update). TODO(wyatt): first guess.
 */
function opportunityScale(tier: number): number {
  return BALANCE.challenges.tierScale ** Math.max(0, tier - 1);
}

/** Splits a tier (I to V) into the card's tier (I to III) and a scale (above III). */
export function playable(tier0: number): { tier: Tier; scale: number; shownTier: number } {
  const tier = Math.max(1, Math.min(TOP_TIER, tier0));
  if (tier <= MAX_TIER) return { tier: tier as Tier, scale: 1, shownTier: tier };
  return {
    tier: MAX_TIER,
    scale: BALANCE.challenges.tierScale ** (tier - MAX_TIER),
    shownTier: tier,
  };
}

export function pickForTile(
  state: GameState,
  rng: RngState,
  tile: Tile,
  onTile: readonly Hiker[],
): Picked | undefined {
  const base = tileTier(state, tile);

  if (tile.special === 'opportunity') {
    const { tier, shownTier } = playable(base);
    const id = pickOne(rng, 'opportunity', state, tile, onTile, tier);
    return id ? { cardId: id, tier, shownTier, scale: opportunityScale(base) } : undefined;
  }

  if (tile.special === 'challenge') {
    // The next tier's list (Wyatt, Nov 5); above Tier III it scales.
    const { tier, scale, shownTier } = playable(base + 1);
    const id = pickOne(rng, 'challenge', state, tile, onTile, tier);
    return id ? { cardId: id, tier, shownTier, scale } : undefined;
  }

  const { tier, scale, shownTier } = playable(base);

  if (tile.special === 'choice') {
    const first = pickOne(rng, 'challenge', state, tile, onTile, tier);
    if (!first) return undefined;
    const second = pickOne(rng, 'challenge', state, tile, onTile, tier, [first]);
    return { cardId: first, tier, shownTier, scale, ...(second ? { alternative: second } : {}) };
  }

  // A plain tile (Phase 10.6): what the section placed there. An opportunity
  // tile only draws opportunities; a challenge tile falls back to an
  // opportunity only if no challenge fits its nodes.
  const kinds: ChallengeKind[] = tile.opportunity ? ['opportunity'] : ['challenge', 'opportunity'];
  for (const k of kinds) {
    const id = pickOne(rng, k, state, tile, onTile, tier);
    if (id)
      return {
        cardId: id,
        tier,
        shownTier,
        scale: k === 'opportunity' ? opportunityScale(base) : scale,
      };
  }
  return undefined;
}
