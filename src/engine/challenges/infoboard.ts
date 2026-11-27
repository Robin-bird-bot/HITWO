/**
 * The Trail Infoboard (docs/design/25-challenges-on-the-map.md, section 2):
 * a trailhead kiosk on the first tile of every biome, showing the biome's
 * challenge pool as posters. It only opens while a hiker stands on the
 * trailhead tile.
 *
 * - **Posters:** one per pool card. [2] are pinned face up at the start (or
 *   a third of the pool, rounded down, whichever is more); the rest are
 *   face down until pinned.
 * - **PIN ONE MORE** ([1] cap): a random face-down poster turns face up.
 * - **WHERE IS IT?** ([3] caps): pick a face-up poster; the nearest tile
 *   nobody has reached that holds its card is revealed (its card shows on
 *   the map, as an Old Firewatch Tower reveal does). A poster with no such
 *   tile left is ALL FOUND.
 * - Caps come from the party purse. Not enough caps changes nothing.
 * - Saved per biome (`section.infoboard`): a new biome starts a fresh board.
 */
import { BALANCE } from '../../config/balance';
import { pushEvent } from '../log';
import { adjacentTileIds } from '../map';
import { seedRng, shuffle } from '../rng';
import type { GameState, TileId } from '../types';
import { revealCardOn } from './reveal';

const IB = BALANCE.challenges.infoboard;

export type InfoboardAction = { type: 'infoboardPin' } | { type: 'infoboardFind'; cardId: string };

/** A small, steady hash (FNV-1a), to seed the board's first posters. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The board as it is: the posters face up (in pool order) and the tiles found. */
export function boardOf(state: GameState): { faceUp: string[]; found: TileId[] } {
  const pool = state.section.pool ?? [];
  if (state.section.infoboard) return state.section.infoboard;
  // A fresh board: [2] (or a third of the pool, rounded down) pinned up, picked by the run.
  const up = Math.min(pool.length, Math.max(IB.startUp, Math.floor(pool.length / 3)));
  const picked = shuffle(seedRng(hash(`${state.seed}|${state.sectionIndex}|board`)), pool).slice(
    0,
    up,
  );
  return { faceUp: pool.filter((id) => picked.includes(id)), found: [] };
}

/** Can the board be used now: a hiker on the map stands on the trailhead tile. */
export const atTrailhead = (state: GameState): boolean =>
  state.hikers.some(
    (h) =>
      h.tileId === state.section.trailheadId && (h.status === 'active' || h.status === 'passedOut'),
  );

/** Tiles nobody has reached that hold this card, still unrevealed. */
export function tilesLeft(state: GameState, cardId: string): TileId[] {
  return Object.values(state.section.tiles)
    .filter(
      (t) =>
        !t.visited &&
        t.revealedCard?.hidden &&
        (t.revealedCard.cardId === cardId || t.revealedCard.alternative === cardId),
    )
    .map((t) => t.id);
}

/** The nearest of these tiles to the trailhead, by steps along the trail. */
function nearest(state: GameState, ids: readonly TileId[]): TileId | undefined {
  const want = new Set(ids);
  const seen = new Set<TileId>([state.section.trailheadId]);
  let ring: TileId[] = [state.section.trailheadId];
  while (ring.length) {
    const hit = ring.filter((id) => want.has(id)).sort();
    if (hit.length) return hit[0];
    const next: TileId[] = [];
    for (const id of ring) {
      for (const n of adjacentTileIds(state.section, id)) {
        if (seen.has(n)) continue;
        seen.add(n);
        next.push(n);
      }
    }
    ring = next;
  }
  return [...ids].sort()[0];
}

export function validateInfoboard(state: GameState, action: InfoboardAction): string | undefined {
  if (!atTrailhead(state)) return 'The Trail Infoboard is on the trailhead tile.';
  const board = boardOf(state);
  const pool = state.section.pool ?? [];
  if (action.type === 'infoboardPin') {
    if (pool.every((id) => board.faceUp.includes(id))) return 'Every poster is up.';
    if (state.caps < IB.pinCaps) return 'Not enough caps.';
    return undefined;
  }
  if (!board.faceUp.includes(action.cardId)) return 'That poster isn’t up yet.';
  if (!tilesLeft(state, action.cardId).length) return 'All found.';
  if (state.caps < IB.findCaps) return 'Not enough caps.';
  return undefined;
}

/** PIN ONE MORE or WHERE IS IT?: pays from the purse, then pins a poster or reveals a tile. */
export function applyInfoboard(state: GameState, action: InfoboardAction): TileId | undefined {
  const board = { ...boardOf(state) };
  if (action.type === 'infoboardPin') {
    const down = (state.section.pool ?? []).filter((id) => !board.faceUp.includes(id));
    const picked = shuffle(state.rng, down)[0];
    if (!picked) return undefined;
    state.caps -= IB.pinCaps;
    board.faceUp = (state.section.pool ?? []).filter(
      (id) => board.faceUp.includes(id) || id === picked,
    );
    state.section.infoboard = board;
    pushEvent(state, { kind: 'infoboardPin', cardId: picked, caps: IB.pinCaps });
    return undefined;
  }
  const tileId = nearest(state, tilesLeft(state, action.cardId));
  if (!tileId) return undefined;
  state.caps -= IB.findCaps;
  revealCardOn(state, tileId, 'the Trail Infoboard');
  board.found = [...board.found, tileId];
  state.section.infoboard = board;
  return tileId;
}
