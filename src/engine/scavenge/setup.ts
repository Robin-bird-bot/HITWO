/**
 * What a scavenge on this tile looks like for this hiker before any card is
 * dealt: how many cards, what Luck, which odds are shifted, and the bonuses
 * the window lists. Also the cost and why a hiker can't scavenge.
 */
import { BALANCE } from '../../config/balance';
import { WEATHERS } from '../../content/weather';
import { computeCost, scavengeModifiers } from '../effects';
import { resourceCount, resourceLimit } from '../inventory';
import type {
  GameState,
  Hiker,
  NodeType,
  ResourceId,
  ScavengeBonus,
  ScavengeBonusOffer,
  ScavengeCardType,
} from '../types';
import { phaseIndex } from '../challenges/trials';
import { canDeal, scavengeSpots, type DealInput } from './deal';
import { clampLuck } from './rarity';
import { adjacentTileIds } from '../map';

export interface ScavengeSetup extends Omit<DealInput, 'forceTypes'> {
  bonuses: ScavengeBonus[];
  bonusOffers: ScavengeBonusOffer[];
  /** Butterfingers: the chance the card taken slips away. */
  dropChance: number;
  /** Extra cards the hiker can keep from this deal (a Sack). */
  keeps: number;
  /** Cards the hiker can reroll in this scavenge (Glasses). */
  rerolls: number;
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
  const resourceWeight: Partial<Record<ResourceId, number>> = {};
  const extraCards: { type: ScavengeCardType; node: NodeType }[] = [];
  let dropChance = 0;
  let keeps = 0;
  let rerolls = 0;
  let adjacent = false;
  for (const m of mods) {
    if (m.adjacentNodes) adjacent = true;
    dropChance = Math.max(dropChance, m.dropChance ?? 0);
    keeps += m.keep ?? 0;
    rerolls += m.rerolls ?? 0;
    for (const [k, v] of Object.entries(m.resourceWeight ?? {}) as [ResourceId, number][]) {
      resourceWeight[k] = (resourceWeight[k] ?? 1) * v;
    }
    // A card from a node that can't give one (frozen, burned, at 0) isn't added.
    extraCards.push(...(m.addCards ?? []));
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
  // Eagle Eye: the revealed nodes of the tiles next to this one too.
  const near = adjacent
    ? adjacentTileIds(state.section, hiker.tileId).flatMap(
        (id) => state.section.tiles[id]?.nodes.filter((n) => n.revealed) ?? [],
      )
    : [];
  const giving = [...(tile?.nodes ?? []), ...near];
  const canGive = new Set(scavengeSpots({ nodes: giving }).map((s) => s.node));
  return {
    nodes: giving,
    abundance: state.abundance,
    itemTier: state.section.tier,
    resourceWeight,
    extraCards: extraCards.filter((c) => canGive.has(c.node)),
    keeps,
    rerolls,
    luck: clampLuck(luck),
    count: Math.max(1, cards),
    nodeWeight,
    typeWeight,
    nodeTypeWeight,
    ...weatherSwapFor(state),
    bonuses,
    bonusOffers,
    dropChance,
  };
}

/** The weather's chance to turn a card into its node's resources (Phase 10.6). */
function weatherSwapFor(state: GameState): Pick<DealInput, 'weatherSwap'> {
  const weather = WEATHERS[state.weather?.today ?? 'clear'];
  if (!weather?.node) return {};
  return {
    weatherSwap: { weather: weather.id, node: weather.node, chance: BALANCE.weather.swapChance },
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
  if (!canDeal({ nodes: tile.nodes })) return 'There’s nothing to scavenge on this tile.';
  if (resourceCount(hiker) >= resourceLimit(state, hiker)) {
    return `${hiker.name}’s resources are full (${resourceLimit(state, hiker)}/${resourceLimit(state, hiker)}). Give some away or return them to nature first.`;
  }
  return undefined;
}
