/**
 * Dealing scavenge cards. Each card is made in four steps:
 * 1. the node it comes from, weighted by how many of that node the tile has
 *    and that node's Abundance (a node at 0 gives nothing);
 * 2. its rarity, from Luck;
 * 3. its type, among the types of that rarity that can happen here (stepping
 *    down a rarity when none can);
 * 4. what's inside.
 * Every card has a node, so taking it always drains a known meter.
 */
import { BALANCE } from '../../config/balance';
import { SCAVENGE_CARDS, findableItems, type ScavengeCardDef } from '../../content';
import { RESOURCES } from '../../content/resources';
import { int, pick, roll, shuffle, weightedPick } from '../rng';
import type { ItemType } from '../effects';
import type {
  NodeType,
  Rarity,
  RngState,
  ScavengeCard,
  ScavengeCardType,
  TileNode,
} from '../types';
import { rollRarity, stepDown } from './rarity';

export interface DealInput {
  /** The tile's node spots (a double node is two spots). */
  nodes: readonly TileNode[];
  abundance: Readonly<Record<NodeType, number>>;
  luck: number;
  count: number;
  /** Multipliers on how likely each node is (Finder, Hound). */
  nodeWeight?: Partial<Record<NodeType, number>>;
  /** Multipliers on how likely each card type is (Archaeologist…). */
  typeWeight?: Partial<Record<ScavengeCardType, number>>;
  /** Multipliers on card types for cards from one node (Hound's ×2 results). */
  nodeTypeWeight?: Partial<Record<NodeType, Partial<Record<ScavengeCardType, number>>>>;
  /** Debug only: deal these types first, in order, where they can happen. */
  forceTypes?: readonly ScavengeCardType[];
  /** The tier item finds come at: the biome's (Wyatt, Nov 7). */
  itemTier?: number;
}

interface Spot {
  node: NodeType;
  bounty: boolean;
  weight: number;
}

/** The resource node spots that can give a card, with how likely each is. */
export function scavengeSpots(
  input: Pick<DealInput, 'nodes' | 'abundance' | 'nodeWeight'>,
): Spot[] {
  const spots: Spot[] = [];
  for (const n of input.nodes) {
    if (n.type === 'caps') continue;
    const meter = Math.max(0, input.abundance[n.type]);
    const weight = (meter / BALANCE.abundance.max) * (input.nodeWeight?.[n.type] ?? 1);
    if (weight > 0) spots.push({ node: n.type, bounty: !!n.bounty, weight });
  }
  return spots;
}

/** Whether this tile can give any card at all. */
export function canDeal(input: Pick<DealInput, 'nodes' | 'abundance' | 'nodeWeight'>): boolean {
  return scavengeSpots(input).length > 0 || input.nodes.some((n) => n.type === 'caps');
}

export function dealCards(rng: RngState, input: DealInput): ScavengeCard[] {
  const cards: ScavengeCard[] = [];
  for (let i = 0; i < input.count; i++) cards.push(dealCard(rng, input, input.forceTypes?.[i]));
  return cards;
}

const resourcesOf = (node: NodeType) => RESOURCES.filter((r) => r.node === node).map((r) => r.id);
const ALL = RESOURCES.map((r) => r.id);

export function dealCard(rng: RngState, input: DealInput, forced?: ScavengeCardType): ScavengeCard {
  const spots = scavengeSpots(input);
  const hasCapNode = input.nodes.some((n) => n.type === 'caps');
  if (spots.length === 0) {
    // Only Cap nodes left: every card is acorn caps.
    if (!hasCapNode) throw new Error('dealCard(): nothing on this tile can give a card');
    return contents(rng, SCAVENGE_CARDS.caps, null, false, [], input.itemTier);
  }

  const spot = weightedPick(
    rng,
    spots.map((s) => ({ item: s, weight: s.weight })),
  );
  const otherNodes = [...new Set(spots.map((s) => s.node))].filter((n) => n !== spot.node);
  const possible = (def: ScavengeCardDef) =>
    (!def.needsTwoNodes || otherNodes.length > 0) &&
    (!def.itemType || findableItems(def.itemType).length > 0);

  const forcedDef = forced ? SCAVENGE_CARDS[forced] : undefined;
  if (forcedDef && possible(forcedDef)) {
    return contents(rng, forcedDef, spot.node, spot.bounty, otherNodes, input.itemTier);
  }

  let rarity: Rarity = rollRarity(rng, input.luck);
  for (;;) {
    const candidates = Object.values(SCAVENGE_CARDS).filter(
      (def) => def.rarity === rarity && possible(def),
    );
    if (candidates.length) {
      const def = weightedPick(
        rng,
        candidates.map((d) => ({
          item: d,
          weight:
            typeWeight(d, input, spot.bounty, hasCapNode) *
            (input.nodeTypeWeight?.[spot.node]?.[d.id] ?? 1),
        })),
      );
      return contents(rng, def, spot.node, spot.bounty, otherNodes, input.itemTier);
    }
    if (rarity === 'common') throw new Error('dealCard(): no Common card types');
    rarity = stepDown(rarity);
  }
}

function typeWeight(
  def: ScavengeCardDef,
  input: DealInput,
  fromBounty: boolean,
  hasCapNode: boolean,
): number {
  const S = BALANCE.scavenge;
  let w = S.typeWeights[def.id] ?? 1;
  if (def.id === 'caps' && hasCapNode) w *= S.capNodeCapsWeight;
  if (def.multiple && fromBounty) w *= S.bountyMultipleWeight;
  w *= input.typeWeight?.[def.id] ?? 1;
  return w;
}

function contents(
  rng: RngState,
  def: ScavengeCardDef,
  node: NodeType | null,
  bounty: boolean,
  otherNodes: readonly NodeType[],
  itemTier = 1,
): ScavengeCard {
  const card: ScavengeCard = {
    type: def.id,
    rarity: def.rarity,
    node,
    ...(bounty ? { bounty: true as const } : {}),
    flipped: false,
  };
  const own = node ? resourcesOf(node) : [];

  switch (def.id) {
    case 'resource':
    case 'wild':
      card.resources = [pick(rng, own)];
      break;
    case 'x2':
    case 'wildX2': {
      const r = pick(rng, own);
      card.resources = [r, r];
      break;
    }
    case 'x3': {
      const r = pick(rng, own);
      card.resources = [r, r, r];
      break;
    }
    case 'pair':
      card.resources = shuffle(rng, own).slice(0, 2);
      break;
    case 'trio':
      card.resources = shuffle(rng, own).slice(0, 3);
      break;
    case 'mixed': {
      // On a 3-node tile: 1 resource from each of 2 random nodes (Wyatt, Nov 4).
      const node2 = pick(rng, otherNodes);
      card.node2 = node2;
      card.resources = [pick(rng, own), pick(rng, resourcesOf(node2))];
      break;
    }
    case 'varietyWild':
      card.resources = [pick(rng, ALL)];
      break;
    case 'varietyPair':
      card.resources = [pick(rng, ALL), pick(rng, ALL)];
      break;
    case 'varietyBundle':
      card.resources = [pick(rng, ALL), pick(rng, ALL), pick(rng, ALL)];
      break;
    case 'choice':
      card.pick = { count: 1, from: node ?? 'all', each: 1 };
      break;
    case 'choiceX2':
      card.pick = { count: 1, from: node ?? 'all', each: 2 };
      break;
    case 'pickOfTheWild':
      card.pick = { count: 1, from: 'all', each: 1 };
      break;
    case 'pairOfTheWild':
      card.pick = { count: 2, from: 'all', each: 1 };
      break;
    case 'bundleOfTheWild':
      card.pick = { count: 3, from: 'all', each: 1 };
      break;
    case 'caps':
      card.caps = int(rng, BALANCE.scavenge.caps.min, BALANCE.scavenge.caps.max);
      break;
    default: {
      const type = def.itemType;
      if (!type) throw new Error(`dealCard(): ${def.id} has no contents`);
      // Each item comes at the biome's tier, with a small chance of one higher.
      const count = def.choiceItem ? BALANCE.scavenge.choiceItemOptions : 1;
      const items: string[] = [];
      for (let i = 0; i < count; i++) {
        const options = findableAt(type, foundTier(rng, itemTier)).filter(
          (o) => !items.includes(o.id),
        );
        if (options.length) items.push(pick(rng, options).id);
      }
      card.items = items;
    }
  }
  return card;
}

/** A found item's tier: the biome's, and now and then one higher (BALANCE.items.findHigher). */
export function foundTier(rng: RngState, tier: number): number {
  const top = BALANCE.items.maxFoundTier;
  return Math.min(top, roll(rng, BALANCE.items.findHigher) ? tier + 1 : tier);
}

/** Items of a type to find at a tier, or the nearest lower tier that has some. */
function findableAt(type: ItemType, tier: number) {
  for (let t = tier; t >= 1; t--) {
    const found = findableItems(type, t);
    if (found.length) return found;
  }
  return findableItems(type, 1);
}
