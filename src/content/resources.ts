/**
 * The 16 resources, four per node (docs/design/01-design-doc.md, "Scavenging").
 * Bones, flint and salt have no art yet (docs/ASSETS.md, "Still missing").
 */
import type { NodeType, ResourceId } from '../engine/types';

export interface ResourceDef {
  id: ResourceId;
  name: string;
  node: NodeType;
  /** No icon yet; the UI shows the name's first letter. */
  missingArt?: true;
}

export const RESOURCES: readonly ResourceDef[] = [
  { id: 'wood', name: 'Wood', node: 'forest' },
  { id: 'moss', name: 'Moss', node: 'forest' },
  { id: 'mushroom', name: 'Mushroom', node: 'forest' },
  { id: 'grass', name: 'Grass', node: 'forest' },
  { id: 'fish', name: 'Fish', node: 'river' },
  { id: 'clay', name: 'Clay', node: 'river' },
  { id: 'shell', name: 'Shell', node: 'river' },
  { id: 'seaweed', name: 'Seaweed', node: 'river' },
  { id: 'meat', name: 'Meat', node: 'wildlife' },
  { id: 'fur', name: 'Fur', node: 'wildlife' },
  { id: 'oil', name: 'Oil', node: 'wildlife' },
  { id: 'bones', name: 'Bones', node: 'wildlife', missingArt: true },
  { id: 'stone', name: 'Stone', node: 'mountain' },
  { id: 'metal', name: 'Metal', node: 'mountain' },
  { id: 'flint', name: 'Flint', node: 'mountain', missingArt: true },
  { id: 'salt', name: 'Salt', node: 'mountain', missingArt: true },
];

export const RESOURCE_BY_ID: ReadonlyMap<ResourceId, ResourceDef> = new Map(
  RESOURCES.map((r) => [r.id, r]),
);
