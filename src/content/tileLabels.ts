/**
 * Tiles aren't named; at most they get a simple label from their nodes
 * (design doc, "The trail map"). Rules are checked in order and the first
 * match wins. Cap nodes don't count toward a label.
 *
 * TODO(wyatt): only Creek and River come from the design doc. The rest are
 * placeholders to replace with your list.
 */
import type { NodeKind, NodeType } from '../engine/types';

export interface TileLabelRule {
  label: string;
  /** Exactly this many of each listed node type. */
  nodes: Partial<Record<NodeType, number>>;
  /** Exactly this many resource nodes on the tile in total. */
  total: number;
  placeholder?: boolean;
}

export const TILE_LABELS: readonly TileLabelRule[] = [
  { label: 'River', nodes: { river: 2 }, total: 3 },
  { label: 'Creek', nodes: { river: 1, forest: 1 }, total: 2 },
  { label: 'Grove', nodes: { forest: 2 }, total: 2, placeholder: true },
  { label: 'Rapids', nodes: { river: 2 }, total: 2, placeholder: true },
  { label: 'Den', nodes: { wildlife: 2 }, total: 2, placeholder: true },
  { label: 'Crag', nodes: { mountain: 2 }, total: 2, placeholder: true },
  { label: 'Foothills', nodes: { mountain: 1, forest: 1 }, total: 2, placeholder: true },
  { label: 'Watering Hole', nodes: { river: 1, wildlife: 1 }, total: 2, placeholder: true },
];

/** The label for a tile's nodes, or null when no rule matches. */
export function tileLabel(nodes: readonly { type: NodeKind }[]): string | null {
  const counts: Partial<Record<NodeType, number>> = {};
  let total = 0;
  for (const { type } of nodes) {
    if (type === 'caps') continue;
    counts[type] = (counts[type] ?? 0) + 1;
    total += 1;
  }
  const rule = TILE_LABELS.find(
    (r) =>
      r.total === total &&
      Object.entries(r.nodes).every(([type, n]) => counts[type as NodeType] === n),
  );
  return rule?.label ?? null;
}
