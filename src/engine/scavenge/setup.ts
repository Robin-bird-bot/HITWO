/**
 * What a scavenge on this tile looks like for this hiker before any card is
 * dealt: how many cards, what Luck, which odds are shifted, and the bonuses
 * the window lists. Also the cost and why a hiker can't scavenge.
 */
import { BALANCE } from '../../config/balance';
import { computeCost, scavengeModifiers } from '../effects';
import { resourceCount } from '../inventory';
import type { GameState, Hiker, NodeType, ScavengeBonus, ScavengeCardType } from '../types';
import { canDeal, type DealInput } from './deal';
import { clampLuck } from './rarity';

export interface ScavengeSetup extends Omit<DealInput, 'forceTypes'> {
  bonuses: ScavengeBonus[];
}

export function scavengeSetup(state: GameState, hiker: Hiker): ScavengeSetup {
  const tile = state.section.tiles[hiker.tileId];
  const mods = scavengeModifiers(state, hiker, { tileId: hiker.tileId, phase: state.phase });

  let cards = BALANCE.scavenge.cards;
  let luck = 0;
  const nodeWeight: Partial<Record<NodeType, number>> = {};
  const typeWeight: Partial<Record<ScavengeCardType, number>> = {};
  for (const m of mods) {
    cards += m.cards ?? 0;
    luck += m.luck ?? 0;
    for (const [k, v] of Object.entries(m.nodeWeight ?? {}) as [NodeType, number][]) {
      nodeWeight[k] = (nodeWeight[k] ?? 1) * v;
    }
    for (const [k, v] of Object.entries(m.typeWeight ?? {}) as [ScavengeCardType, number][]) {
      typeWeight[k] = (typeWeight[k] ?? 1) * v;
    }
  }

  return {
    nodes: tile?.nodes ?? [],
    abundance: state.abundance,
    luck: clampLuck(luck),
    count: Math.max(1, cards),
    nodeWeight,
    typeWeight,
    bonuses: mods.map(({ source, label, tone }) => ({ source, label, tone })),
  };
}

/** The Appetite a scavenge costs (paid when the card is taken). */
export function scavengeCost(state: GameState, hiker: Hiker): number {
  const base =
    BALANCE.scavenge.appetite + (state.phase === 'night' ? BALANCE.night.scavengeExtraAppetite : 0);
  return computeCost(
    state,
    [hiker],
    {
      key: 'scavenge.appetite',
      actorId: hiker.id,
      subjectId: hiker.id,
      role: 'actor',
      phase: state.phase,
    },
    base,
  );
}

/** Why this tile or this hiker's pack stops a scavenge, if anything. */
export function scavengeTileReason(state: GameState, hiker: Hiker): string | undefined {
  const tile = state.section.tiles[hiker.tileId];
  if (!tile || tile.nodes.length === 0) return 'There’s nothing to scavenge on this tile.';
  if (!canDeal({ nodes: tile.nodes, abundance: state.abundance })) {
    return 'Nothing left to find here. Tend it or move on.';
  }
  if (resourceCount(hiker) >= BALANCE.inventory.resourceLimit) {
    return `${hiker.name}’s resources are full (${BALANCE.inventory.resourceLimit}/${BALANCE.inventory.resourceLimit}). Give some away or return them to nature first.`;
  }
  return undefined;
}
