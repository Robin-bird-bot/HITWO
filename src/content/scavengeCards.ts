/**
 * Every scavenge card type as data (docs/design/01-design-doc.md, "Scavenge
 * cards", and docs/mockups/ScavTypes.dc.html). How likely each type is lives in
 * src/config/balance.ts; what it does lives here.
 */
import type { ItemType } from '../engine/effects';
import type { Rarity, ScavengeCardType } from '../engine/types';

export interface ScavengeCardDef {
  id: ScavengeCardType;
  rarity: Rarity;
  /** The card's name when it doesn't take the resource's (WILD, CHOICE, TRIO…). */
  name: string;
  /** One short line under the card. `{node}` becomes the node's name. */
  text: string;
  /** Which backdrop the face uses: the card's node, the any-node one, caps or items. */
  backdrop: 'node' | 'any' | 'caps' | 'items';
  /** The Game Quotes glyph on the face. */
  glyph?: string;
  /** The ×2 / ×3 badge. */
  mult?: 2 | 3;
  /**
   * Abundance the card's node loses when it's taken. Mixed cards take this
   * from each of their two nodes. TODO(wyatt): Wild ×2 and Choice ×2 drain 2
   * like ×2; Variety and "of the Wild" cards drain 1.
   */
  drain: number;
  /** Gives 2 or more resources (likelier from a Bounty node). */
  multiple?: true;
  /** Needs two different resource nodes on the tile. */
  needsTwoNodes?: true;
  /** Item finds and Choice items: the item type. */
  itemType?: ItemType;
  /** Choice items: pick 1 of several. */
  choiceItem?: true;
}

const CARDS: ScavengeCardDef[] = [
  {
    id: 'resource',
    rarity: 'common',
    name: 'Resource',
    text: 'One resource',
    backdrop: 'node',
    drain: 1,
  },
  {
    id: 'x2',
    rarity: 'uncommon',
    name: '×2',
    text: 'Two of the same',
    backdrop: 'node',
    mult: 2,
    drain: 2,
    multiple: true,
  },
  {
    id: 'x3',
    rarity: 'rare',
    name: '×3',
    text: 'Three of the same',
    backdrop: 'node',
    mult: 3,
    drain: 2,
    multiple: true,
  },
  {
    id: 'pair',
    rarity: 'uncommon',
    name: 'Pair',
    text: 'Two different, same node',
    backdrop: 'node',
    drain: 2,
    multiple: true,
  },
  {
    id: 'trio',
    rarity: 'rare',
    name: 'Trio',
    text: 'Three different, same node',
    backdrop: 'node',
    drain: 2,
    multiple: true,
  },
  {
    id: 'mixed',
    rarity: 'rare',
    name: 'Mixed',
    text: 'One from each of two nodes',
    backdrop: 'node',
    drain: 1,
    multiple: true,
    needsTwoNodes: true,
  },
  {
    id: 'wild',
    rarity: 'uncommon',
    name: 'Wild',
    text: 'A random {node} resource',
    backdrop: 'node',
    glyph: '?',
    drain: 1,
  },
  {
    id: 'wildX2',
    rarity: 'rare',
    name: 'Wild ×2',
    text: 'Two of a random {node} resource',
    backdrop: 'node',
    glyph: '?',
    mult: 2,
    drain: 2,
    multiple: true,
  },
  {
    id: 'varietyWild',
    rarity: 'uncommon',
    name: 'Variety Wild',
    text: 'A random resource from all 16',
    backdrop: 'any',
    glyph: '?',
    drain: 1,
  },
  {
    id: 'varietyPair',
    rarity: 'rare',
    name: 'Variety Pair',
    text: '2 random resources from all 16',
    backdrop: 'any',
    glyph: '??',
    drain: 1,
    multiple: true,
  },
  {
    id: 'varietyBundle',
    rarity: 'veryRare',
    name: 'Variety Bundle',
    text: '3 random resources from all 16',
    backdrop: 'any',
    glyph: '???',
    drain: 1,
    multiple: true,
  },
  {
    id: 'choice',
    rarity: 'rare',
    name: 'Choice',
    text: 'Pick any {node} resource',
    backdrop: 'node',
    glyph: '!',
    drain: 1,
  },
  {
    id: 'choiceX2',
    rarity: 'veryRare',
    name: 'Choice ×2',
    text: 'Pick a {node} resource, get two',
    backdrop: 'node',
    glyph: '!',
    mult: 2,
    drain: 2,
    multiple: true,
  },
  {
    id: 'pickOfTheWild',
    rarity: 'rare',
    name: 'Pick of the Wild',
    text: 'Pick 1 resource from all 16',
    backdrop: 'any',
    glyph: '!',
    drain: 1,
  },
  {
    id: 'pairOfTheWild',
    rarity: 'veryRare',
    name: 'Pair of the Wild',
    text: 'Pick 2 resources from all 16',
    backdrop: 'any',
    glyph: '!!',
    drain: 1,
    multiple: true,
  },
  {
    id: 'bundleOfTheWild',
    rarity: 'legendary',
    name: 'Bundle of the Wild',
    text: 'Pick 3 resources from all 16',
    backdrop: 'any',
    glyph: '!!!',
    drain: 1,
    multiple: true,
  },
  {
    id: 'caps',
    rarity: 'uncommon',
    name: 'Acorn caps',
    text: '1 to 3 caps, from any node',
    backdrop: 'caps',
    drain: 1,
  },
  {
    id: 'toolFind',
    rarity: 'rare',
    name: 'Tool find',
    text: 'A random tool card',
    backdrop: 'items',
    drain: 1,
    itemType: 'tool',
  },
  {
    id: 'foodFind',
    rarity: 'rare',
    name: 'Food find',
    text: 'A random food card',
    backdrop: 'items',
    drain: 1,
    itemType: 'food',
  },
  {
    id: 'clothesFind',
    rarity: 'veryRare',
    name: 'Clothes find',
    text: 'A random clothes card',
    backdrop: 'items',
    drain: 1,
    itemType: 'clothes',
  },
  {
    id: 'shelterFind',
    rarity: 'legendary',
    name: 'Shelter find',
    text: 'A random shelter card',
    backdrop: 'items',
    drain: 1,
    itemType: 'shelter',
  },
  {
    id: 'trinketFind',
    rarity: 'legendary',
    name: 'Trinket find',
    text: 'A random trinket card',
    backdrop: 'items',
    drain: 1,
    itemType: 'trinket',
  },
  {
    id: 'choiceTool',
    rarity: 'veryRare',
    name: 'Choice tool',
    text: 'Pick 1 of 5 random tool cards',
    backdrop: 'items',
    drain: 1,
    itemType: 'tool',
    choiceItem: true,
  },
  {
    id: 'choiceFood',
    rarity: 'veryRare',
    name: 'Choice food',
    text: 'Pick 1 of 5 random food cards',
    backdrop: 'items',
    drain: 1,
    itemType: 'food',
    choiceItem: true,
  },
  {
    id: 'choiceClothes',
    rarity: 'legendary',
    name: 'Choice clothes',
    text: 'Pick 1 of 5 random clothes cards',
    backdrop: 'items',
    drain: 1,
    itemType: 'clothes',
    choiceItem: true,
  },
  {
    id: 'choiceShelter',
    rarity: 'mythic',
    name: 'Choice shelter',
    text: 'Pick 1 of 5 random shelter cards',
    backdrop: 'items',
    drain: 1,
    itemType: 'shelter',
    choiceItem: true,
  },
  {
    id: 'choiceTrinket',
    rarity: 'mythic',
    name: 'Choice trinket',
    text: 'Pick 1 of 5 random trinket cards',
    backdrop: 'items',
    drain: 1,
    itemType: 'trinket',
    choiceItem: true,
  },
];

export const SCAVENGE_CARDS: Readonly<Record<ScavengeCardType, ScavengeCardDef>> =
  Object.fromEntries(CARDS.map((c) => [c.id, c])) as Record<ScavengeCardType, ScavengeCardDef>;

/** Card types in gallery order. */
export const SCAVENGE_CARD_ORDER: readonly ScavengeCardType[] = CARDS.map((c) => c.id);
