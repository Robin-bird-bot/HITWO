/** Helpers for writing items the way docs/design/03-items.md writes them. */
import { RESOURCES } from '../resources';
import type { ItemDef } from '../../engine/effects';
import { qualityScale, type QualityValues } from '../../engine/items/quality';
import { parseRecipe, type Recipe } from '../../engine/items/recipe';

/** (X a/b/c/d/e): a at Quality 1 up to e at Quality 5. */
export const q = (a: number, b: number, c: number, d: number, e: number): QualityValues =>
  qualityScale([a, b, c, d, e]);

const KNOWN = RESOURCES.map((r) => r.id);

/** "Stone 3, Clay 2, Metal 1, any 1", or "5 forest" for a resource pack. */
export const recipe = (text: string): Recipe => parseRecipe(text, KNOWN);

/** The art's file name from the item's name: "Piña Colada" → "pina-colada". */
export function artName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type ItemInput = Omit<ItemDef, 'art' | 'recipe'> & { art?: string | null; recipe?: string };

/** An item: its art defaults to its name, and its recipe is read from the doc's wording. */
export function item({ recipe: r, art, ...def }: ItemInput): ItemDef {
  return {
    ...def,
    art: art === undefined ? artName(def.name) : art,
    ...(r ? { recipe: recipe(r) } : {}),
  };
}
