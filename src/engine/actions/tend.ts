/**
 * Tend: raise the biome's Abundance from a tile with a resource node (daytime
 * only; uses the hiker's phase). It costs 1 Appetite (Nov 14 update; it was
 * 1 Energy). docs/design/01-design-doc.md, "Days, phases and actions".
 * TODO(wyatt): Tend still needs a resource node on the tile, as before.
 */
import { BALANCE } from '../../config/balance';
import { changeAbundance } from '../abundance';
import { computeCost, computeGain, fireAction } from '../effects';
import { pushEvent } from '../log';
import type { Action, GameState, Hiker, NodeType } from '../types';
import { findHiker, mustFindHiker, payCost, phaseActionReason, spendAction } from './common';

type TendAction = Extract<Action, { type: 'tend' }>;

/** How much Tend raises Abundance for this hiker (the Thumbs and Maintenance add to it). */
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

/** The Energy Tend costs this hiker (29-core-loop.md, section 1). */
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

/** The resource nodes on the hiker's tile, once each (the Thumbs look at these). */
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
  if (tendableNodes(state, hiker).length === 0) return 'There’s nothing to tend on this tile.';
  if (state.abundance >= BALANCE.abundance.max) return 'Abundance is already full.';
  return undefined;
}

export function applyTend(state: GameState, action: TendAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const from = state.abundance;
  changeAbundance(state, tendAmount(state, hiker));
  spendAction(state, hiker);
  pushEvent(state, { kind: 'tend', hikerId: hiker.id, from, to: state.abundance });
  payCost(state, hiker, { appetite: 0, energy: tendCost(state, hiker), morale: 0 }, 'Tend');
  fireAction(state, hiker, { kind: 'tend', role: 'actor', tileId: hiker.tileId });
}
