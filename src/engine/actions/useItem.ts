/**
 * Using an item (a free action): an active hiker uses a bag item on themselves
 * or a hiker on their tile, passed out included. Phase 7 builds the medical
 * items (ItemDef.use); Phase 8 builds the rest.
 *
 * - Conditions go first (picked, or the item's own list), then injuries,
 *   then anything the item gives (the Splint's Splinted).
 * - Curing a passed-out hiker below 3 injuries wakes them.
 * - A use that would do nothing is refused, so the item isn't wasted.
 * - The item is used up. TODO(phase 8): uses and Quality.
 */
import { CONDITIONS } from '../../content/conditions';
import { ITEMS } from '../../content/items';
import { addCondition, hasCondition, removeCondition } from '../conditions';
import { pushEvent } from '../log';
import { cureInjuries } from '../stats';
import type { Action, ConditionInstance, GameState, Hiker } from '../types';
import { findHiker, mustFindHiker, notActiveReason } from './common';

type UseAction = Extract<Action, { type: 'useItem' }>;

/** A hiker's negative conditions: the ones Medicine or a Medkit can cure. */
export function negativeConditions(hiker: Hiker): ConditionInstance[] {
  return hiker.conditions.filter((c) => CONDITIONS[c.id]?.kind === 'negative');
}

export function validateUse(state: GameState, action: UseAction): string | undefined {
  const user = findHiker(state, action.hikerId);
  const reason = notActiveReason(user);
  if (reason || !user) return reason;
  const item = user.inventory.bag.find((i) => i.uid === action.itemUid);
  if (!item) return `${user.name} doesn’t have that.`;
  const def = ITEMS[item.itemId];
  const use = def?.use;
  if (!def || !use) return `${def?.name ?? 'That item'} can’t be used yet (Phase 8).`;

  const target = findHiker(state, action.targetId);
  if (!target || target.status === 'abandoned' || target.status === 'checkedIn') {
    return 'That hiker isn’t on the trail.';
  }
  if (target.tileId !== user.tileId) return `${target.name} isn’t on this tile.`;

  const bad = negativeConditions(target);
  if (action.conditionId !== undefined) {
    if (!use.pickCondition) return `${def.name} doesn’t cure a condition you pick.`;
    if (!bad.some((c) => c.id === action.conditionId)) {
      return `${target.name} doesn’t have that condition.`;
    }
  } else if (use.pickCondition && bad.length > 1) {
    return 'Pick which condition to cure.';
  }
  if (use.gives && hasCondition(target, use.gives.id)) {
    return `${target.name} already has a ${def.name}.`;
  }

  const helps =
    ((use.injuries ?? 0) > 0 && target.injuries > 0) ||
    (use.cures ?? []).some((id) => hasCondition(target, id)) ||
    (!!use.pickCondition && bad.length > 0);
  if (!helps) return `${def.name} wouldn’t help ${target.name} right now.`;
  return undefined;
}

export function applyUse(state: GameState, action: UseAction): void {
  const user = mustFindHiker(state, action.hikerId);
  const target = mustFindHiker(state, action.targetId);
  const index = user.inventory.bag.findIndex((i) => i.uid === action.itemUid);
  const [item] = user.inventory.bag.splice(index, 1);
  const def = item && ITEMS[item.itemId];
  const use = def?.use;
  if (!item || !def || !use) return;

  pushEvent(state, { kind: 'used', hikerId: user.id, targetId: target.id, itemId: item.itemId });
  for (const id of use.cures ?? []) {
    if (hasCondition(target, id)) removeCondition(state, target, id);
  }
  if (use.pickCondition) {
    const id = action.conditionId ?? negativeConditions(target)[0]?.id;
    if (id) removeCondition(state, target, id);
  }
  if (use.injuries) cureInjuries(state, target, use.injuries, def.name);
  if (use.gives) {
    addCondition(state, target, use.gives.id, use.gives.duration, use.gives.unit, def.name);
  }
}
