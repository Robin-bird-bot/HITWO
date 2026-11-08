/** Words for the night event window and the trail log. */
import { ITEMS } from '../../content/items';
import type { GameEvent } from '../../engine';

type Safe = Extract<GameEvent, { kind: 'nightEvent' }>['safe'][number];

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/**
 * Who was safe, one line per watcher or shelter:
 * "Cody kept watch: Cody, Finnegan and Ash were safe.",
 * "Cody kept watch and was safe.", "Dot was safe in a shelter."
 */
export function safeLines(
  safe: readonly Safe[],
  name: (id: string) => string,
): { why: Safe['why']; text: string }[] {
  const groups = new Map<string, { why: Safe['why']; by?: string; item?: string; ids: string[] }>();
  for (const s of safe) {
    const key =
      s.why === 'watch' ? `watch:${s.by ?? ''}` : s.why === 'item' ? `item:${s.item}` : s.why;
    const group = groups.get(key) ?? {
      why: s.why,
      ...(s.by ? { by: s.by } : {}),
      ...(s.item ? { item: s.item } : {}),
      ids: [],
    };
    group.ids.push(s.hikerId);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ why, by, item, ids }) => {
    const names = listNames(ids.map(name));
    const were = ids.length === 1 ? 'was' : 'were';
    const itemName = (item && ITEMS[item]?.name) ?? 'an item';
    const text =
      why === 'shelter'
        ? `${names} ${were} safe in a shelter.`
        : why === 'lamp'
          ? `${names} ${were} safe by the Camping Lamp.`
          : why === 'item'
            ? `${names} ${were} safe thanks to the ${itemName}.`
            : ids.length === 1 && ids[0] === by
              ? `${names} kept watch and was safe.`
              : `${by ? name(by) : 'Someone'} kept watch: ${names} ${were} safe.`;
    return { why, text };
  });
}
