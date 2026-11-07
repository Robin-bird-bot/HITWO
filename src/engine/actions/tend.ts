/**
 * Tend: restore Abundance for a node on this tile (daytime only; uses the
 * hiker's phase; costs 1 Energy, Wyatt Nov 5).
 * docs/design/01-design-doc.md, "Days, phases and actions".
 */
import { BALANCE } from '../../config/balance';
import { changeAbundance } from '../abundance';
import { computeCost, computeGain } from '../effects';
import { pushEvent } from '../log';
import type { Action, GameState, Hiker, NodeType } from '../types';
import { findHiker, mustFindHiker, payCost, phaseActionReason, spendAction } from './common';

type TendAction = Extract<Action, { type: 'tend' }>;

const NAME: Record<NodeType, string> = {
  forest: 'Forest',
  river: 'River',
  wildlife: 'Wildlife',
  mountain: 'Mountain',
};

/** How much Tend restores for this hiker. */
export function tendAmount(state: GameState, hiker: Hiker): number {
  return computeGain(
    state,
    [hiker],
    {
      key: 'tend.abundance',
      actorId: hiker.id,
      subjectId: hiker.id,
      role: 'actor',
      phase: state.phase,
    },
    BALANCE.abundance.tend,
  );
}

/** The Energy Tend costs this hiker. */
export function tendCost(state: GameState, hiker: Hiker): number {
  return computeCost(
    state,
    [hiker],
    {
      key: 'tend.energy',
      actorId: hiker.id,
      subjectId: hiker.id,
      role: 'actor',
      phase: state.phase,
    },
    BALANCE.abundance.tendEnergy,
  );
}

/** The resource nodes on the hiker's tile, once each. */
export function tendableNodes(state: GameState, hiker: Hiker): NodeType[] {
  const tile = state.section.tiles[hiker.tileId];
  const kinds = (tile?.nodes ?? []).flatMap((n) => (n.type === 'caps' ? [] : [n.type]));
  return [...new Set(kinds)];
}

export function validateTend(state: GameState, action: TendAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = phaseActionReason(state, hiker, action);
  if (reason || !hiker) return reason;
  if (state.phase === 'night') return 'Tending is a daytime action.';
  const nodes = tendableNodes(state, hiker);
  if (nodes.length === 0) return 'There’s nothing to tend on this tile.';
  if (!nodes.includes(action.node)) return `There’s no ${NAME[action.node]} node on this tile.`;
  if (state.abundance[action.node] >= BALANCE.abundance.max) {
    return `${NAME[action.node]} Abundance is already full.`;
  }
  return undefined;
}

export function applyTend(state: GameState, action: TendAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const from = state.abundance[action.node];
  changeAbundance(state, action.node, tendAmount(state, hiker));
  spendAction(state, hiker);
  pushEvent(state, {
    kind: 'tend',
    hikerId: hiker.id,
    node: action.node,
    from,
    to: state.abundance[action.node],
  });
  payCost(state, hiker, { appetite: 0, energy: tendCost(state, hiker), morale: 0 }, 'Tend');
}
