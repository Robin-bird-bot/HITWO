import type { GameState, Hiker, Line, Section, TileId } from './types';

/** The line joining two tiles, if they are adjacent. */
export function lineBetween(section: Section, a: TileId, b: TileId): Line | undefined {
  return section.lines.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
}

/** Tiles connected to this one by a line. */
export function adjacentTileIds(section: Section, tileId: TileId): TileId[] {
  const out: TileId[] = [];
  for (const l of section.lines) {
    if (l.a === tileId) out.push(l.b);
    else if (l.b === tileId) out.push(l.a);
  }
  return out;
}

/** Active hikers standing on a tile. */
export function hikersOnTile(state: GameState, tileId: TileId): Hiker[] {
  return state.hikers.filter((h) => h.tileId === tileId && h.status === 'active');
}

/** Alone: no other active hiker on the same tile. */
export function isAlone(state: GameState, hiker: Hiker): boolean {
  return !state.hikers.some(
    (h) => h.id !== hiker.id && h.status === 'active' && h.tileId === hiker.tileId,
  );
}

/** A campsite is a built-in shelter; Ruins can build one on a tile. Placed shelters arrive with items (Phase 9). */
export function isSheltered(state: GameState, hiker: Hiker): boolean {
  const tile = state.section.tiles[hiker.tileId];
  return tile?.special === 'campsite' || (tile?.shelters?.length ?? 0) > 0;
}
