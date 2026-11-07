/** Plain words for what using an item will do (the stash menu's choices and confirm). */
import { BALANCE } from '../../config/balance';
import { CONDITIONS } from '../../content/conditions';
import type { Hiker, ItemUse } from '../../engine';

/** "3 → 2 injuries", "wakes up", "Bleeding cured", "Splinted for 3 days". */
export function whatItDoes(use: ItemUse, target: Hiker, conditionId?: string): string[] {
  const out: string[] = [];
  for (const id of use.cures ?? []) {
    if (target.conditions.some((c) => c.id === id)) out.push(`${CONDITIONS[id]?.name ?? id} cured`);
  }
  if (use.pickCondition && conditionId)
    out.push(`${CONDITIONS[conditionId]?.name ?? conditionId} cured`);
  const n = use.injuries ?? 0;
  if (n > 0 && target.injuries > 0) {
    const after = Math.max(0, target.injuries - n);
    out.push(`${target.injuries} → ${after} injur${after === 1 ? 'y' : 'ies'}`);
    if (target.status === 'passedOut' && after < BALANCE.injuries.passOutAt) out.push('wakes up');
  }
  if (use.gives) {
    const g = use.gives;
    const unit = g.unit === 'days' ? 'day' : 'phase';
    out.push(
      `${CONDITIONS[g.id]?.name ?? g.id} for ${g.duration} ${unit}${g.duration === 1 ? '' : 's'}`,
    );
  }
  return out;
}
