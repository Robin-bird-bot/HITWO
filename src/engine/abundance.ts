/**
 * Abundance: one meter per node type, 0 to BALANCE.abundance.max
 * (docs/design/01-design-doc.md, "Abundance").
 */
import { BALANCE } from '../config/balance';
import { NODE_TYPES, type GameState, type NodeType } from './types';

/** Every meter at the start value, as at the start of each biome. */
export function freshAbundance(): Record<NodeType, number> {
  return Object.fromEntries(NODE_TYPES.map((n) => [n, BALANCE.abundance.start])) as Record<
    NodeType,
    number
  >;
}

/** Changes one meter, keeping it between 0 and the maximum. */
export function changeAbundance(state: GameState, node: NodeType, delta: number): void {
  const next = state.abundance[node] + delta;
  state.abundance[node] = Math.max(0, Math.min(BALANCE.abundance.max, next));
}

export function isLow(state: GameState, node: NodeType): boolean {
  return state.abundance[node] <= BALANCE.abundance.lowAt;
}
