/**
 * Opening a challenge (01-design-doc.md, "Triggering"): the first hiker to
 * land on a tile triggers its card, once, however they got there. Only the
 * hikers on the tile then are affected.
 *
 * - Picking and rolling happen here, so a reload mid-challenge shows the same
 *   card with the same numbers.
 * - A tile landed on while another challenge is open (a hiker swept onto it)
 *   waits in a queue and opens next.
 */
import { BALANCE } from '../../config/balance';
import { CARDS } from '../../content/challenges';
import { pushEvent } from '../log';
import type { GameState, HikerId, OpenChallenge, TileId } from '../types';
import { pickForTile, type Picked } from './pick';
import { rollCard } from './rolls';
import type { CardDef } from './types';

/** Hikers on a tile who can be affected (not abandoned). */
function hikersHere(state: GameState, tileId: TileId, only?: readonly HikerId[]) {
  return state.hikers.filter(
    (h) =>
      h.tileId === tileId &&
      h.status !== 'abandoned' &&
      (only === undefined || only.includes(h.id)),
  );
}

/**
 * Cards the pop-up can show so far. TODO(phase 5 step 3): Risk challenges,
 * opportunities and Choice spaces. TODO(phase 5 step 4): Trials.
 */
function canOpenYet(card: CardDef, picked: Picked): boolean {
  return card.kind === 'challenge' && !card.risk && !picked.alternative;
}

/** Does landing on this tile trigger a card? Not the trailhead, the checkpoint or a visited tile. */
export function triggers(state: GameState, tileId: TileId): boolean {
  const tile = state.section.tiles[tileId];
  if (!tile || tile.kind !== 'normal') return false;
  return !(tile.special && BALANCE.challenges.noCardOn.includes(tile.special));
}

/**
 * Called when hikers land on a tile nobody had landed on. Picks and rolls its
 * card and opens it, or queues the tile if a challenge is already open.
 */
export function revealTile(state: GameState, tileId: TileId, hikerIds: readonly HikerId[]): void {
  if (state.noChallenges || !triggers(state, tileId)) return;
  if (state.challenge) {
    state.challengeQueue = [...(state.challengeQueue ?? []), { tileId, hikerIds: [...hikerIds] }];
    return;
  }
  const tile = state.section.tiles[tileId];
  const here = hikersHere(state, tileId, hikerIds);
  if (!tile || !here.length) return;

  const picked = pickForTile(state, state.rng, tile, here);
  const card = picked && CARDS[picked.cardId];
  if (!picked || !card || !canOpenYet(card, picked)) return;
  openCard(
    state,
    card,
    tileId,
    here.map((h) => h.id),
    picked,
  );
}

/** Opens a card on a tile: rolls its numbers and marks it used in this section. */
export function openCard(
  state: GameState,
  card: CardDef,
  tileId: TileId,
  hikerIds: readonly HikerId[],
  picked: Pick<Picked, 'tier' | 'scale' | 'alternative'>,
): void {
  const here = hikersHere(state, tileId, hikerIds);
  const tile = state.section.tiles[tileId];
  const open: OpenChallenge = {
    cardId: card.id,
    tileId,
    tier: picked.tier,
    scale: picked.scale,
    hikerIds: here.map((h) => h.id),
    rolls: rollCard(state.rng, card, here, picked.scale),
    ...(tile?.special === 'challenge' ? { special: 'challenge' as const } : {}),
    ...(picked.alternative ? { alternative: picked.alternative } : {}),
  };
  state.challenge = open;
  if (!state.usedCards.includes(card.id)) state.usedCards.push(card.id);
  pushEvent(state, { kind: 'challengeOpened', cardId: card.id, tileId });
}

/** After a challenge is resolved: open the next queued tile, if any. */
export function openNext(state: GameState): void {
  while (!state.challenge && state.challengeQueue?.length) {
    const [next, ...rest] = state.challengeQueue;
    if (rest.length) state.challengeQueue = rest;
    else delete state.challengeQueue;
    if (next) revealTile(state, next.tileId, next.hikerIds);
  }
}
