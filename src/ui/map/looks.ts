/**
 * How map things look: lines and their cost badges, special spaces, side
 * features, tile states and node badges. Shared by the game map and the
 * debug map. Colors come from docs/mockups/Main.dc.html and Kit.dc.html.
 */
import { ASSETS } from '../../config/assets';
import type {
  LineKind,
  NodeKind,
  Section,
  SideFeature,
  SpecialSpace,
  Tile,
  TileId,
} from '../../engine';
import { adjacentTileIds } from '../../engine';
import type { IconName } from '../icons/paths';

export interface LineLook {
  /** SVG stroke layers drawn in order. */
  strokes: { color: string; width: number; dash?: string; opacity?: number }[];
  /** The cost badge at the line's middle. Stats count down, so badges show −1. */
  badge?: { icon: IconName; text: string; bg: string; fg: string };
  tooltip: string;
}

export const LINE_LOOK: Record<LineKind, LineLook> = {
  normal: {
    strokes: [{ color: '#F7F1E4', width: 3, dash: '1 10', opacity: 0.85 }],
    tooltip: 'Normal path: −1 Appetite to cross',
  },
  paved: {
    strokes: [
      { color: '#ECE5D6', width: 10 },
      { color: '#8D877A', width: 1.5, dash: '6 6' },
    ],
    badge: { icon: 'road', text: 'FREE', bg: '#ECE5D6', fg: '#1D2220' },
    tooltip: 'Paved: free to cross, no Appetite',
  },
  steep: {
    strokes: [{ color: '#E9B44C', width: 4, dash: '6 7' }],
    badge: { icon: 'zap', text: '-1', bg: '#E9B44C', fg: '#1D2220' },
    tooltip: 'Steep: −1 extra Energy to cross',
  },
  muddy: {
    strokes: [{ color: '#9A7650', width: 5, dash: '3 7' }],
    badge: { icon: 'utensils', text: '-1', bg: '#9A7650', fg: '#F7F1E4' },
    tooltip: 'Muddy: −1 extra Appetite to cross',
  },
  rough: {
    strokes: [{ color: '#CDA6EE', width: 3, dash: '2 8', opacity: 0.9 }],
    badge: { icon: 'heart', text: '-1', bg: '#CDA6EE', fg: '#1D2220' },
    tooltip: 'Rough: −1 extra Morale to cross',
  },
};

/** A line both of whose tiles have been visited is drawn solid. */
export const VISITED_LINE = { color: '#F7F1E4', width: 4 };

export interface SpecialLook {
  name: string;
  icon: IconName;
  bg: string;
  fg: string;
}

export const SPECIAL_LOOK: Record<SpecialSpace, SpecialLook> = {
  opportunity: { name: 'Opportunity', icon: 'star', bg: '#4F8A63', fg: '#F7F1E4' },
  challenge: { name: 'Challenge', icon: 'alert', bg: '#C8553D', fg: '#F7F1E4' },
  choice: { name: 'Choice', icon: 'split', bg: '#4E6A80', fg: '#F7F1E4' },
  trailSign: { name: 'Trail Sign', icon: 'sign', bg: '#8A6A3E', fg: '#F7F1E4' },
  geoCache: { name: 'Geo-cache', icon: 'package', bg: '#E9B44C', fg: '#1D2220' },
  campsite: { name: 'Campsite', icon: 'tent', bg: '#2F4A42', fg: '#F7F1E4' },
  overlook: { name: 'Overlook', icon: 'eye', bg: '#3E7FA8', fg: '#F7F1E4' },
  narrowPath: { name: 'Narrow Path', icon: 'users', bg: '#1D2220', fg: '#F7F1E4' },
  mystery: { name: 'Mystery', icon: 'help', bg: '#7A5AA6', fg: '#F7F1E4' },
};

export const FEATURE_LOOK: Record<SideFeature, { name: string; icon: IconName }> = {
  merchant: { name: 'Merchant', icon: 'bag' },
  trader: { name: 'Traveling Trader', icon: 'backpack' },
};

export const NODE_IMAGE: Record<Exclude<NodeKind, 'caps'>, string> = ASSETS.nodes;
export const NODE_NAME: Record<NodeKind, string> = {
  forest: 'Forest',
  river: 'River',
  wildlife: 'Wildlife',
  mountain: 'Mountain',
  caps: 'Cap',
};

/** Tile looks from Kit.dc.html. */
export type TileLookName = 'visited' | 'current' | 'revealed' | 'fog';

export const TILE_LOOK: Record<
  TileLookName,
  { fill: string; edge: string; hiddenBg: string; text: string }
> = {
  visited: { fill: '#E4D8BF', edge: '#F7F1E4', hiddenBg: '#5F7A70', text: '#2C3A35' },
  current: { fill: '#FFF8EA', edge: '#E2683C', hiddenBg: '#5F7A70', text: '#2C3A35' },
  revealed: { fill: '#C3D5C5', edge: '#F7F1E4', hiddenBg: '#5F7A70', text: '#2C3A35' },
  fog: {
    fill: 'rgba(40,60,53,0.82)',
    edge: 'rgba(247,241,228,0.35)',
    hiddenBg: 'rgba(241,234,219,0.2)',
    text: '#D8D1C2',
  },
};

/**
 * Which look a tile gets: the selected hiker's tile is "current"; visited
 * tiles are "visited"; tiles next to a visited one, or with a node shown, are
 * "revealed"; the rest are in fog.
 */
export function tileLook(section: Section, tile: Tile, currentTileId: TileId | null): TileLookName {
  if (tile.id === currentTileId) return 'current';
  if (tile.visited) return 'visited';
  if (tile.nodes.some((n) => n.revealed)) return 'revealed';
  const nearVisited = adjacentTileIds(section, tile.id).some((id) => section.tiles[id]?.visited);
  return nearVisited ? 'revealed' : 'fog';
}
