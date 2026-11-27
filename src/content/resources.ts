/**
 * The 16 resources, four per node (docs/design/01-design-doc.md, "Scavenging").
 */
import type { NodeType, ResourceId } from '../engine/types';

export interface ResourceDef {
  id: ResourceId;
  name: string;
  node: NodeType;
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
  { id: 'bones', name: 'Bones', node: 'wildlife' },
  { id: 'stone', name: 'Stone', node: 'mountain' },
  { id: 'metal', name: 'Metal', node: 'mountain' },
  { id: 'flint', name: 'Flint', node: 'mountain' },
  { id: 'salt', name: 'Salt', node: 'mountain' },
];

export const RESOURCE_BY_ID: ReadonlyMap<ResourceId, ResourceDef> = new Map(
  RESOURCES.map((r) => [r.id, r]),
);

/**
 * Resource categories (docs/design/24-challenges-reset.md, section 1): five
 * groups that pay for challenge costs and Prepare. A resource in two groups
 * (Wood, Metal) can pay for either, but one resource only pays one cost.
 */
export type CategoryId = 'food' | 'building' | 'fiber' | 'fire' | 'trinkets';

export interface CategoryDef {
  id: CategoryId;
  name: string;
  resources: readonly ResourceId[];
}

export const CATEGORIES: readonly CategoryDef[] = [
  { id: 'food', name: 'Food', resources: ['meat', 'fish', 'mushroom', 'salt'] },
  { id: 'building', name: 'Building', resources: ['wood', 'stone', 'metal', 'clay'] },
  { id: 'fiber', name: 'Fiber', resources: ['grass', 'moss', 'fur', 'seaweed'] },
  { id: 'fire', name: 'Fire', resources: ['wood', 'oil', 'flint'] },
  { id: 'trinkets', name: 'Trinkets', resources: ['shell', 'bones', 'metal'] },
];

export const CATEGORY_BY_ID: ReadonlyMap<CategoryId, CategoryDef> = new Map(
  CATEGORIES.map((c) => [c.id, c]),
);

/** The categories a resource is in (Wood: Building and Fire). */
export const categoriesOf = (id: ResourceId): CategoryId[] =>
  CATEGORIES.filter((c) => c.resources.includes(id)).map((c) => c.id);
