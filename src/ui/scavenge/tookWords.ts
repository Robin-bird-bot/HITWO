/**
 * The small label that floats up from a hiker's pack after a scavenge
 * (Nov 14 update, in place of the result window): "+2 Wood · +1 Moss",
 * "+2 caps", an item's name, "Empty".
 */
import { ITEMS } from '../../content';
import type { ResourceId } from '../../engine';
import { resourceName } from './cardLook';

export interface Took {
  resources: readonly ResourceId[];
  caps?: number;
  items?: readonly string[];
  /** The card was Empty. */
  empty?: true;
  /** Butterfingers: it slipped away. */
  dropped?: true;
}

export function tookLabel(t: Took): string {
  if (t.dropped) return 'Slipped away';
  if (t.empty) return 'Empty';
  const parts: string[] = [];
  const counts = new Map<ResourceId, number>();
  for (const r of t.resources) counts.set(r, (counts.get(r) ?? 0) + 1);
  for (const [r, n] of counts) parts.push(`+${n} ${resourceName(r)}`);
  if (t.caps) parts.push(`+${t.caps} cap${t.caps === 1 ? '' : 's'}`);
  for (const id of t.items ?? []) parts.push(ITEMS[id]?.name ?? id);
  return parts.length ? parts.join(' · ') : 'No room';
}
