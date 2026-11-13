/**
 * Recipes (docs/design/03-items.md, "Crafting"), written the way the doc
 * writes them: "Stone 3, Clay 2, Metal 1, any 1". A part is exact resources,
 * any resource from some nodes (a resource pack's "5 Forest resources"), or
 * any resource at all.
 */
import type { NodeType, ResourceId } from '../types';

export interface RecipePart {
  n: number;
  /** One of these exact resources (a key part can be "Metal or Wood"). */
  ids?: readonly ResourceId[];
  /** Any resource from these nodes, any mix. */
  nodes?: readonly NodeType[];
  /** Any resource. */
  any?: true;
}

export type Recipe = readonly RecipePart[];

const NODES: readonly NodeType[] = ['forest', 'river', 'wildlife', 'mountain'];

/**
 * Reads "Stone 3, Clay 2, any 1" or "5 forest". Unknown words throw, so a
 * typo in the content fails the tests instead of making an uncraftable item.
 */
export function parseRecipe(text: string, known: readonly ResourceId[]): Recipe {
  return text.split(',').map((raw) => {
    const part = raw.trim().toLowerCase();
    const m = /^(?:(\d+)\s+)?([a-z' -]+?)(?:\s+(\d+))?$/.exec(part);
    const n = Number(m?.[1] ?? m?.[3]);
    const word = (m?.[2] ?? '').trim();
    if (!m || !Number.isFinite(n) || n <= 0)
      throw new Error(`Bad recipe part "${raw}" in "${text}"`);
    if (word === 'any') return { n, any: true };
    if ((NODES as readonly string[]).includes(word)) return { n, nodes: [word as NodeType] };
    const id = word.replace(/\s+/g, '');
    if (!known.includes(id)) throw new Error(`Unknown resource "${word}" in "${text}"`);
    return { n, ids: [id] };
  });
}

/** How many resources a recipe takes in all. */
export const recipeSize = (r: Recipe) => r.reduce((sum, p) => sum + p.n, 0);
