/**
 * How a scavenge card looks and reads: its name, its line of text, its
 * backdrop and rays, and its back (docs/mockups/ScavTypes.dc.html and
 * docs/ASSETS.md, "Scavenge card layers").
 */
import { ITEMS, SCAVENGE_CARDS } from '../../content';
import { RESOURCES } from '../../content/resources';
import { ASSETS } from '../../config/assets';
import type { ItemType } from '../../engine';
import type { NodeType, Rarity, ResourceId, ScavengeCard } from '../../engine';
import { NODE_NAME } from '../map/looks';

export const RARITY_LOOK: Record<Rarity, { name: string; color: string; pips: number }> = {
  common: { name: 'Common', color: '#C9C2B2', pips: 1 },
  uncommon: { name: 'Uncommon', color: '#7FC29B', pips: 2 },
  rare: { name: 'Rare', color: '#E9B44C', pips: 3 },
  veryRare: { name: 'Very rare', color: '#CDA6EE', pips: 4 },
  legendary: { name: 'Legendary', color: '#F0875A', pips: 5 },
  mythic: { name: 'Mythic', color: '#7FD3E6', pips: 6 },
};

/** The type colors, dark to light (docs/ASSETS.md, "Item card layers"). */
export const ITEM_TYPE_COLORS: Record<ItemType, string[]> = {
  tool: ['#ed642b', '#f08c35', '#f0ab35', '#ecf035'],
  clothes: ['#5e3023', '#895637', '#c18553', '#e6b389'],
  food: ['#3a7752', '#45a86c', '#c7da7b', '#dced9a'],
  shelter: ['#83c4ed', '#545c8e'],
  trinket: ['#e2a9f1', '#d675ef', '#9a3f64', '#cd1f66'],
};

export const resourceName = (id: ResourceId) => RESOURCES.find((r) => r.id === id)?.name ?? id;
const upper = (s: string) => s.toUpperCase();

/** The card's name: the resource for what-you-see cards, the type for the rest. */
export function cardTitle(card: ScavengeCard): string {
  const def = SCAVENGE_CARDS[card.type];
  const r = card.resources ?? [];
  const first = r[0] ? resourceName(r[0]) : '';
  switch (card.type) {
    case 'resource':
      return upper(first);
    case 'x2':
    case 'x3':
      return `${upper(first)} ×${r.length}`;
    case 'pair':
    case 'mixed':
      return r.map((id) => upper(resourceName(id))).join(' + ');
    default:
      return upper(def.name);
  }
}

/** A name for what a card gave: "FISH ×2", "WOOD + MOSS". */
export function resourcesTitle(resources: readonly ResourceId[]): string {
  const counts = new Map<ResourceId, number>();
  for (const id of resources) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts]
    .map(([id, n]) => `${upper(resourceName(id))}${n > 1 ? ` ×${n}` : ''}`)
    .join(' + ');
}

/** One short line under the card. */
export function cardText(card: ScavengeCard): string {
  const def = SCAVENGE_CARDS[card.type];
  return def.text.replace('{node}', card.node ? NODE_NAME[card.node] : 'any');
}

/** The resource icons shown on the face (none for Wild, Choice, caps or item cards). */
export function faceIcons(card: ScavengeCard): string[] {
  const def = SCAVENGE_CARDS[card.type];
  if (def.glyph || def.backdrop === 'caps' || def.backdrop === 'items') return [];
  const r = card.resources ?? [];
  // ×2 and ×3 show one icon with a badge.
  const shown = def.mult ? r.slice(0, 1) : r;
  return shown.map((id) => ASSETS.resources[id] ?? '').filter(Boolean);
}

type BackdropKey = NodeType | 'any' | 'caps' | 'items';

/** Which backdrop and rays the face uses, and how strong the rays are. */
export function faceLayers(card: ScavengeCard): {
  bg: string;
  bg2?: string;
  rays: string;
  rayOpacity: number;
} {
  const def = SCAVENGE_CARDS[card.type];
  const key: BackdropKey = def.backdrop === 'node' ? (card.node ?? 'any') : def.backdrop;
  return {
    bg: ASSETS.scavenge.backdrops[key],
    ...(card.type === 'mixed' && card.node2 ? { bg2: ASSETS.scavenge.backdrops[card.node2] } : {}),
    rays: ASSETS.scavenge.rays[key],
    rayOpacity: RAY_OPACITY[key],
  };
}

const RAY_OPACITY: Record<BackdropKey, number> = {
  forest: 0.35,
  river: 0.35,
  wildlife: 0.35,
  mountain: 0.35,
  caps: 0.32,
  any: 0.22,
  items: 0.22,
};

/** What the back shows: the card's node, or the caps or item back. */
export function backKind(card: ScavengeCard): NodeType | 'caps' | 'items' {
  const def = SCAVENGE_CARDS[card.type];
  if (def.backdrop === 'caps') return 'caps';
  if (def.backdrop === 'items') return 'items';
  return card.node ?? 'caps';
}

export function backLayers(card: ScavengeCard): {
  bg: string;
  rays: string;
  rayOpacity: number;
  icon: string;
  fullIcon: boolean;
} {
  const kind = backKind(card);
  if (kind === 'caps' || kind === 'items') {
    return {
      bg: ASSETS.scavenge.backdrops[kind],
      rays: ASSETS.scavenge.rays[kind],
      rayOpacity: RAY_OPACITY[kind],
      icon: ASSETS.scavenge.backs[kind],
      fullIcon: true,
    };
  }
  return {
    bg: ASSETS.scavenge.backdrops[kind],
    rays: ASSETS.scavenge.rays[kind],
    rayOpacity: RAY_OPACITY[kind],
    icon: ASSETS.nodes[kind],
    fullIcon: false,
  };
}

/** The back's name, for screen readers and the gallery. */
export function backName(card: ScavengeCard): string {
  const kind = backKind(card);
  if (kind === 'caps') return 'Caps';
  if (kind === 'items') return 'Item';
  return NODE_NAME[kind];
}

/** The item type on an item card's face. */
export function cardItemType(card: ScavengeCard): ItemType | null {
  return SCAVENGE_CARDS[card.type].itemType ?? null;
}

export function itemName(id: string): string {
  return ITEMS[id]?.name ?? id;
}
