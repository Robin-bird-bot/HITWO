/**
 * The map's geometry for everything drawn on it (tiles, tokens, lines,
 * badges): Classic's grid, or the Illustrated map's moved tiles and winding
 * paths. Without a provider, the grid.
 */
import { createContext, useContext } from 'react';
import type { Section, Tile } from '../../../engine';
import { lastRowOf, tileCenter, type Point } from '../mapLayout';
import type { MapGeometry } from './geometry';

export const MapGeometryContext = createContext<MapGeometry | undefined>(undefined);

export interface Placer {
  center(tile: Tile): Point;
  scale(tileId: string): number;
  path(lineId: string, a: Tile, b: Tile): readonly Point[];
}

/** Where things go: from the geometry, or the grid. */
export function placer(section: Section, geo: MapGeometry | undefined): Placer {
  const lastRow = lastRowOf(section);
  const center = (t: Tile) => geo?.centers[t.id] ?? tileCenter(t, lastRow);
  return {
    center,
    scale: (id) => geo?.scales[id] ?? 1,
    path: (id, a, b) => geo?.paths[id] ?? [center(a), center(b)],
  };
}

export function usePlacer(section: Section): Placer {
  return placer(section, useContext(MapGeometryContext));
}
