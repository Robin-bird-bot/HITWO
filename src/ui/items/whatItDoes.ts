/** Plain words for what using an item will do (the stash menu's choices and confirm). */
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content';
import { CONDITIONS } from '../../content/conditions';
import { RESOURCES } from '../../content/resources';
import {
  clothesOf,
  itemText,
  qualityOf,
  statMax,
  targetOfUse,
  valueAt,
  type GameState,
  type Hiker,
  type ItemInstance,
  type NodeType,
  type StatName,
} from '../../engine';
import { NODE_NAME } from '../map/looks';

const STAT_NAME: Record<StatName, string> = {
  appetite: 'Appetite',
  energy: 'Energy',
  morale: 'Morale',
};

/**
 * "3 → 2 injuries", "wakes up", "Bleeding cured", "On Crutches for 3 days",
 * "+2 Morale", "Energy 4 → 10". A tool that works for a while (a Shovel)
 * says what its card says.
 */
export function whatItDoes(
  state: GameState,
  item: ItemInstance,
  target: Hiker,
  { conditionId, choice }: { conditionId?: string; choice?: string } = {},
): string[] {
  const def = ITEMS[item.itemId];
  const use = def?.use;
  if (!def || !use) return [];
  const quality = qualityOf(item);
  const v = (key: string) => valueAt(def.values?.[key], quality);
  const out: string[] = [];
  const everyone = targetOfUse(use) === 'tile';

  for (const id of use.cures ?? []) {
    if (target.conditions.some((c) => c.id === id)) out.push(`${CONDITIONS[id]?.name ?? id} cured`);
  }
  if (use.pickCondition && conditionId) {
    out.push(`${CONDITIONS[conditionId]?.name ?? conditionId} cured`);
  }
  if (use.allNegative) out.push('every negative condition cured');
  const n = use.injuries ?? 0;
  if (n > 0 && everyone) out.push(`${n} injury healed each`);
  else if (n > 0 && target.injuries > 0) {
    const after = Math.max(0, target.injuries - n);
    out.push(`${target.injuries} → ${after} injur${after === 1 ? 'y' : 'ies'}`);
    if (target.status === 'passedOut' && after < BALANCE.injuries.passOutAt) out.push('wakes up');
  }
  if (use.gives) {
    const g = use.gives;
    const days = valueAt(g.duration, quality);
    const unit = g.unit === 'days' ? 'day' : 'phase';
    out.push(`${CONDITIONS[g.id]?.name ?? g.id} for ${days} ${unit}${days === 1 ? '' : 's'}`);
  }
  if (use.morale) out.push(`+${v(use.morale)} Morale${everyone ? ' each' : ''}`);
  if (use.fillStat && choice) {
    const stat = choice as StatName;
    out.push(`${STAT_NAME[stat]} ${target.stats[stat]} → ${statMax(state, target, stat)}`);
  }
  if (use.averageStats) out.push('Appetite, Energy and Morale evened out');
  if (use.repair) {
    const add = v(use.repair.value);
    if (use.repair.which === 'one') {
      const c = clothesOf(target).find((i) => i.uid === choice);
      if (c) out.push(`${ITEMS[c.itemId]?.name ?? 'Clothes'} +${add} durability`);
    } else {
      out.push(`every worn clothing item +${add} durability`);
    }
  }
  if (use.abundance) {
    const add = v(use.abundance.value);
    out.push(
      use.abundance.which === 'all'
        ? `every node here +${add} Abundance`
        : `a random node here +${add} Abundance`,
    );
  }
  if (use.addNode && choice) out.push(`a ${NODE_NAME[choice as NodeType]} node added here`);
  if (use.resources) {
    const node = use.resources.node;
    out.push(`${v(use.resources.value)} random ${node ? `${NODE_NAME[node]} ` : ''}resources`);
  }
  if (use.lampTonight) out.push('keeps watch here and next door tonight');
  if (use.boost) {
    if (use.boost.chooseResource && choice) {
      const name = RESOURCES.find((r) => r.id === choice)?.name ?? choice;
      out.push(`${name} ×${v('mult')} as likely when scavenging this phase`);
    } else {
      out.push(itemText(def, quality).replace(/\.$/, ''));
    }
  }
  return out;
}

/** "2 uses left after this", or "The Shovel is used up." */
export function usesAfter(item: ItemInstance, name: string): string {
  const left = (item.usesLeft ?? 1) - 1;
  if (left > 0) return `${left} use${left === 1 ? '' : 's'} left after this.`;
  return `The ${name} ${name.endsWith('s') ? 'are' : 'is'} used up.`;
}
