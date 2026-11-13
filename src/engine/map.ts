import { ITEMS } from '../content/items';
import type { GameState, Hiker, Line, NodeType, Section, TileId } from './types';

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

/**
 * Under a shelter: a campsite (built in), a shelter placed on the tile (a
 * hiker's, or Ruins'), or an RV on a tile next to it.
 */
export function isSheltered(state: GameState, hiker: Hiker): boolean {
  const tile = state.section.tiles[hiker.tileId];
  if (tile?.special === 'campsite' || (tile?.shelters?.length ?? 0) > 0) return true;
  return adjacentTileIds(state.section, hiker.tileId).some((id) =>
    (state.section.tiles[id]?.shelters ?? []).some(
      (s) => ITEMS[s.itemId]?.shelterReach === 'shelters',
    ),
  );
}

/** The kinds of node on a tile (caps nodes aside), each once. */
export function tileNodeTypes(state: GameState, tileId: TileId): NodeType[] {
  const tile = state.section.tiles[tileId];
  return [...new Set((tile?.nodes ?? []).flatMap((n) => (n.type === 'caps' ? [] : [n.type])))];
}

/**
 * Every tile touching this one on the hex grid, with or without a line
 * (Trampoline, Minesweeper, Radar Scanner): the same row 2 columns over, and
 * the rows above and below 1 column over.
 */
export function besideTileIds(section: Section, tileId: TileId): TileId[] {
  const t = section.tiles[tileId];
  if (!t) return [];
  const spots: [number, number][] = [
    [0, -2],
    [0, 2],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  return Object.values(section.tiles)
    .filter((o) => spots.some(([dr, dc]) => o.row === t.row + dr && o.col === t.col + dc))
    .map((o) => o.id);
}
