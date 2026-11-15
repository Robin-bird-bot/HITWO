/**
 * Finding item names in a line of text (the trail log, a shopkeeper's line),
 * so each can open its card (Nov 14 update, section 8). Names match whole
 * words, with their capitals, longest first ("Industrial Fertilizer" before
 * "Fertilizer").
 */
import { ITEMS } from '../../content';
import type { ItemId } from '../../engine';

export type TextPart = string | { itemId: ItemId; name: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let cached: { pattern: RegExp; byName: Map<string, ItemId> } | null = null;

function matcher() {
  if (cached) return cached;
  const byName = new Map<string, ItemId>();
  for (const def of Object.values(ITEMS)) {
    // Old stand-ins kept for saves (`notFound` and no art) still have names; the first wins.
    if (!byName.has(def.name)) byName.set(def.name, def.id);
  }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(escape);
  cached = {
    pattern: new RegExp(`(?<![\\p{L}\\d])(${names.join('|')})(?![\\p{L}\\d])`, 'gu'),
    byName,
  };
  return cached;
}

/** The text split into plain strings and item names. */
export function splitItemNames(text: string): TextPart[] {
  const { pattern, byName } = matcher();
  const parts: TextPart[] = [];
  let at = 0;
  for (const m of text.matchAll(pattern)) {
    const name = m[1] ?? '';
    const itemId = byName.get(name);
    if (!itemId || m.index === undefined) continue;
    if (m.index > at) parts.push(text.slice(at, m.index));
    parts.push({ itemId, name });
    at = m.index + name.length;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}
