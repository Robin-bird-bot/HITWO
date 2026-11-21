/**
 * Traits that change each morning (Nov 20 update): Quirky and Zany become a
 * random Utility trait for the day, Nosework picks a node, and Moody gives a
 * random condition for the day. Rolled with the seeded RNG at the start of
 * each day (and the first), and kept on the slot so a reload keeps them.
 */
import { CONDITIONS } from '../../content/conditions';
import { TRAITS } from '../../content/traits';
import { dailyPicks } from '../../content/traits/daily';
import { addCondition } from '../conditions';
import { pushEvent } from '../log';
import { NODE_WORD } from '../../content/traits/build';
import { pick } from '../rng';
import type { GameState, Hiker, NodeType } from '../types';

/** What a daily trait's pick is called: the trait, the node, or the condition. */
export function dailyPickName(pickId: string): string {
  return (
    TRAITS[pickId]?.name ?? CONDITIONS[pickId]?.name ?? NODE_WORD[pickId as NodeType] ?? pickId
  );
}

/** Today's pick for every daily trait that doesn't have one yet (set from the debug panel, say). */
export function rollDailyTraits(state: GameState): void {
  for (const hiker of state.hikers) {
    if (hiker.status !== 'active') continue;
    for (const slot of hiker.slots) {
      const def = slot.traitId ? TRAITS[slot.traitId] : undefined;
      if (!def?.daily || slot.daily?.day === state.day) continue;
      const picks = dailyPicks(def);
      if (!picks.length) continue;
      setDaily(state, hiker, slot, pick(state.rng, picks));
    }
  }
}

/** Sets what a daily trait is today; Moody's condition starts now. */
export function setDaily(
  state: GameState,
  hiker: Hiker,
  slot: Hiker['slots'][number],
  pickId: string,
): void {
  const def = slot.traitId ? TRAITS[slot.traitId] : undefined;
  if (!def?.daily) return;
  slot.daily = { day: state.day, pick: pickId };
  if (def.daily === 'condition') {
    addCondition(state, hiker, pickId, 1, 'days', def.name);
    return;
  }
  pushEvent(state, {
    kind: 'trait',
    hikerId: hiker.id,
    trait: def.name,
    text: `${hiker.name}’s ${def.name} is ${dailyPickName(pickId)} today.`,
  });
}
