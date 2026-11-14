/**
 * Words for recipes and payments, shared by the Craft window and the station's
 * Workbench.
 */
import { RESOURCES } from '../../content/resources';
import type { GameState, PaidSlot, Recipe, RecipePart, ResourceId } from '../../engine';
import { NODE_NAME } from '../map/looks';

export const resName = (id: ResourceId) => RESOURCES.find((r) => r.id === id)?.name ?? id;

/** "Metal or Wood 2, Mountain or Forest 3", "Metal 2, Wood 2, any 2". */
export function recipeWords(recipe: Recipe): string {
  return recipe
    .map((p) =>
      p.ids
        ? `${p.ids.map(resName).join(' or ')} ${p.n}`
        : p.any
          ? `any ${p.n}`
          : `${(p.nodes ?? []).map((n) => NODE_NAME[n]).join(' or ')} ${p.n}`,
    )
    .join(', ');
}

/** "2 METAL OR WOOD", "3 MOUNTAIN · FOREST", "2 ANY". */
export function partLabel(part: RecipePart): string {
  if (part.ids) return `${part.n} ${part.ids.map(resName).join(' or ')}`.toUpperCase();
  if (part.any) return `${part.n} ANY`;
  return `${part.n} ${(part.nodes ?? []).map((n) => NODE_NAME[n]).join(' · ')}`.toUpperCase();
}

/** "Ash pays 2 Wood, 1 Moss · Birch adds 2 Stone". */
export function payWords(state: GameState, slots: readonly (PaidSlot | null)[]): string {
  const by = new Map<string, Map<ResourceId, number>>();
  for (const s of slots) {
    if (!s) continue;
    const mine = by.get(s.from) ?? new Map<ResourceId, number>();
    mine.set(s.resource, (mine.get(s.resource) ?? 0) + 1);
    by.set(s.from, mine);
  }
  return [...by.entries()]
    .map(([id, res], i) => {
      const who = state.hikers.find((h) => h.id === id)?.name ?? 'Someone';
      const what = [...res.entries()].map(([r, n]) => `${n} ${resName(r)}`).join(', ');
      return `${who} ${i === 0 ? 'pays' : 'adds'} ${what}`;
    })
    .join(' · ');
}
