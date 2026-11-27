/**
 * Rule Changer (26-fixes-and-wyatt-trees.md, section 5.2): a revealed
 * minigame challenge on a tile becomes another minigame challenge, one that
 * fits the tile's nodes and can play at its tier. The tile's placed card
 * changes and shows face up; the Trail Infoboard doesn't change.
 *
 * At its higher levels the player picks 1 of 2 (or 4). Those options come
 * from the run's seed, the moment and the tile, so the panel, the check and
 * the swap all see the same ones without using the run's random numbers.
 */
import { CARDS, CHALLENGES } from '../../content/challenges';
import { pushEvent } from '../log';
import { seedRng, shuffle } from '../rng';
import type { GameState, TileId } from '../types';
import { fitsTile, pickVersion, placedTier } from './pool';

/** A small, steady hash (FNV-1a), to seed the options. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Is a minigame challenge shown on this tile, waiting for someone to land? */
export function showsMinigame(state: Readonly<GameState>, tileId: TileId): boolean {
  const tile = state.section.tiles[tileId];
  const card = tile?.revealedCard;
  if (!tile || tile.visited || !card || card.hidden) return false;
  const def = CARDS[card.cardId];
  return def?.kind === 'challenge' && !!def.minigame;
}

/** Every minigame challenge this tile's could become, in list order. */
export function switchCandidates(state: Readonly<GameState>, tileId: TileId): string[] {
  if (!showsMinigame(state, tileId)) return [];
  const tile = state.section.tiles[tileId]!;
  const card = tile.revealedCard!;
  const tier = card.shownTier ?? placedTier(state as GameState, tile);
  return CHALLENGES.filter(
    (c) => !!c.minigame && c.id !== card.cardId && fitsTile(c, state as GameState, tile, tier),
  ).map((c) => c.id);
}

/** The `count` options offered for this tile right now (all of them if there are fewer). */
export function switchOptions(state: Readonly<GameState>, tileId: TileId, count: number): string[] {
  const all = switchCandidates(state, tileId);
  if (all.length <= count) return all;
  const rng = seedRng(hash(`${state.seed}|${state.day}|${state.phase}|${tileId}|switch`));
  return shuffle(rng, all).slice(0, count);
}

/**
 * Switches the tile's minigame challenge: to `to` when it's one of the
 * options, otherwise to a random one. Its tier stays; its version is picked
 * again for the new game.
 */
export function switchChallenge(
  state: GameState,
  tileId: TileId,
  to: string | undefined,
  cause: string,
): void {
  const all = switchCandidates(state, tileId);
  const next = to && all.includes(to) ? to : shuffle(state.rng, all)[0];
  const tile = state.section.tiles[tileId];
  const card = tile?.revealedCard;
  const def = next ? CARDS[next] : undefined;
  if (!tile || !card || !next || def?.kind !== 'challenge') return;
  const tier = card.shownTier ?? placedTier(state, tile);
  const version = pickVersion(def, state, tile, tier, state.rng);
  tile.revealedCard = {
    cardId: next,
    tier: card.tier,
    scale: card.scale,
    ...(card.shownTier ? { shownTier: card.shownTier } : {}),
    ...(card.alternative && card.alternative !== next ? { alternative: card.alternative } : {}),
    ...(version !== undefined ? { version } : {}),
  };
  pushEvent(state, { kind: 'revealedCard', tileId, cardId: next, cause });
}
