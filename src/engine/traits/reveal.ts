/**
 * Traits that show the map ahead (Phase 10a): Scout shows the nodes of the
 * tiles around the hiker; Prepared and Tactical show a tile's nodes and card
 * at the start of each biome, for the rest of it (as Old Firewatch Tower does).
 */
import { revealCardOn, triggers } from '../challenges/reveal';
import { revealsAdjacent } from '../effects';
import { pushEvent } from '../log';
import { adjacentTileIds } from '../map';
import type { GameState, TileId } from '../types';

/** Shows a tile's nodes. Returns how many were hidden. */
function showNodes(state: GameState, tileId: TileId): number {
  let shown = 0;
  for (const node of state.section.tiles[tileId]?.nodes ?? []) {
    if (node.revealed) continue;
    node.revealed = true;
    shown += 1;
  }
  return shown;
}

/** Shows a tile's nodes and its card, for the rest of the biome (Prepared, Tactical). */
export function revealAhead(state: GameState, tileId: TileId, cause: string): void {
  showNodes(state, tileId);
  revealCardOn(state, tileId, cause);
}

/** Tiles worth showing ahead: ones nobody has reached that hold a card or a Wonder. */
export function tilesAhead(state: GameState): TileId[] {
  return Object.values(state.section.tiles)
    .filter((t) => !t.visited && (t.wonder || triggers(state, t.id)))
    .map((t) => t.id);
}

/** Every Scout shows the nodes of the tiles around them. Run after anything that moves hikers. */
export function scoutAround(state: GameState): void {
  for (const hiker of state.hikers) {
    if (hiker.status !== 'active' || !revealsAdjacent(state, hiker)) continue;
    let shown = 0;
    for (const id of adjacentTileIds(state.section, hiker.tileId)) shown += showNodes(state, id);
    if (shown > 0) {
      pushEvent(state, {
        kind: 'trait',
        hikerId: hiker.id,
        trait: 'Scout',
        text: `${hiker.name} sees the nodes on the tiles around them.`,
      });
    }
  }
}
