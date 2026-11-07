/**
 * What a scavenge on this tile looks like for this hiker before any card is
 * dealt: how many cards, what Luck, which odds are shifted, and the bonuses
 * the window lists. Also the cost and why a hiker can't scavenge.
 */
import { BALANCE } from '../../config/balance';
import { computeCost, scavengeModifiers } from '../effects';
import { resourceCount } from '../inventory';
import type {
  GameState,
  Hiker,
  NodeType,
  ScavengeBonus,
  ScavengeBonusOffer,
  ScavengeCardType,
} from '../types';
import { phaseIndex } from '../challenges/trials';
import { canDeal, type DealInput } from './deal';
import { clampLuck } from './rarity';
import { nodeGives } from '../weather';

const NODE_LABEL: Record<NodeType, string> = {
  forest: 'Forest',
  river: 'River',
  wildlife: 'Wildlife',
  mountain: 'Mountain',
};

export interface ScavengeSetup extends Omit<DealInput, 'forceTypes'> {
  bonuses: ScavengeBonus[];
  bonusOffers: ScavengeBonusOffer[];
  /** Butterfingers: the chance the card taken slips away. */
  dropChance: number;
}

export function scavengeSetup(state: GameState, hiker: Hiker): ScavengeSetup {
  const tile = state.section.tiles[hiker.tileId];
  const mods = scavengeModifiers(state, hiker, { tileId: hiker.tileId, phase: state.phase });

  let cards = BALANCE.scavenge.cards;
  let luck = 0;
  const nodeWeight: Partial<Record<NodeType, number>> = {};
  const typeWeight: Partial<Record<ScavengeCardType, number>> = {};
  const nodeTypeWeight: Partial<Record<NodeType, Partial<Record<ScavengeCardType, number>>>> = {};
  const bonusOffers: ScavengeBonusOffer[] = [];
  let dropChance = 0;
  for (const m of mods) {
    dropChance = Math.max(dropChance, m.dropChance ?? 0);
    for (const [node, weights] of Object.entries(m.nodeTypeWeight ?? {}) as [
      NodeType,
      Partial<Record<ScavengeCardType, number>>,
    ][]) {
      const into = (nodeTypeWeight[node] ??= {});
      for (const [k, v] of Object.entries(weights) as [ScavengeCardType, number][]) {
        into[k] = (into[k] ?? 1) * v;
      }
    }
    if (m.bonus && m.bonus.count > 0) bonusOffers.push({ source: m.source, ...m.bonus });
    cards += m.cards ?? 0;
    luck += m.luck ?? 0;
    for (const [k, v] of Object.entries(m.nodeWeight ?? {}) as [NodeType, number][]) {
      nodeWeight[k] = (nodeWeight[k] ?? 1) * v;
    }
    for (const [k, v] of Object.entries(m.typeWeight ?? {}) as [ScavengeCardType, number][]) {
      typeWeight[k] = (typeWeight[k] ?? 1) * v;
    }
  }

  // Low Abundance: a warning for each low node here, and when every node is low, fewer
  // cards and less Luck.
  const bonuses: ScavengeBonus[] = mods.map(({ source, label, tone }) => ({ source, label, tone }));
  // A Luck bonus left on this tile (Hungry Animals), until it runs out.
  const tileLuck = tile?.luckBonus;
  if (tileLuck && tileLuck.until >= phaseIndex(state)) {
    luck += tileLuck.amount;
    bonuses.push({
      source: tileLuck.cause,
      label: `+${tileLuck.amount} Luck scavenging here until morning`,
      tone: 'luck',
    });
  }
  // Frozen and Fire nodes give nothing; a Fire node gives Luck to the others (Phase 6 weather).
  const giving = (tile?.nodes ?? []).filter(nodeGives);
  const fires = (tile?.nodes ?? []).filter((n) => n.weather?.state === 'fire').length;
  if (fires > 0) {
    const fireLuck = fires * BALANCE.weather.fireLuck;
    luck += fireLuck;
    bonuses.push({ source: 'Fire', label: `Fire nearby: +${fireLuck} Luck`, tone: 'luck' });
  }
  const kinds = [...new Set(giving.flatMap((n) => (n.type === 'caps' ? [] : [n.type])))];
  const low = kinds.filter((n) => state.abundance[n] <= BALANCE.abundance.lowAt);
  for (const n of low) {
    bonuses.push({
      source: 'Abundance',
      label: `${NODE_LABEL[n]} Abundance is low: fewer ${NODE_LABEL[n]} cards`,
      tone: 'warning',
    });
  }
  if (kinds.length > 0 && low.length === kinds.length) {
    const { cards: fewer, luck: less } = BALANCE.abundance.lowTile;
    cards += fewer;
    luck += less;
    bonuses.push({
      source: 'Abundance',
      label: `Everything here is running low: ${Math.abs(fewer)} fewer card, −${Math.abs(less)} Luck`,
      tone: 'warning',
    });
  }

  return {
    nodes: giving,
    abundance: state.abundance,
    luck: clampLuck(luck),
    count: Math.max(1, cards),
    nodeWeight,
    typeWeight,
    nodeTypeWeight,
    bonuses,
    bonusOffers,
    dropChance,
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
  if (tile?.wonder) return 'Nobody can scavenge at a Wonder: it has no nodes.';
  if (!tile || tile.nodes.length === 0) return 'There’s nothing to scavenge on this tile.';
  if (!canDeal({ nodes: tile.nodes.filter(nodeGives), abundance: state.abundance })) {
    return tile.nodes.some((n) => !nodeGives(n))
      ? 'Nothing to find here: the weather has frozen or burned the nodes.'
      : 'Nothing left to find here. Tend it or move on.';
  }
  if (resourceCount(hiker) >= BALANCE.inventory.resourceLimit) {
    return `${hiker.name}’s resources are full (${BALANCE.inventory.resourceLimit}/${BALANCE.inventory.resourceLimit}). Give some away or return them to nature first.`;
  }
  return undefined;
}
