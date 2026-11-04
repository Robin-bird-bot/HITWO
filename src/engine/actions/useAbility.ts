import { abilitiesFor, abilityPeriod, effectContext, queryContext } from '../effects';
import { pushEvent } from '../log';
import type { Action, GameState } from '../types';
import { findHiker, mustFindHiker, notActiveReason } from './common';

type UseAbilityAction = Extract<Action, { type: 'useAbility' }>;

const PERIOD_WORDS = { day: 'today', phase: 'this phase', biome: 'this section' } as const;

/** Using an ability is a free action: it doesn't use the hiker's phase. */
export function validateUseAbility(state: GameState, action: UseAbilityAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = notActiveReason(hiker);
  if (reason || !hiker) return reason;

  const found = abilitiesFor(state, hiker).find((a) => a.ability.id === action.abilityId);
  if (!found) return `${hiker.name} doesn’t have that ability.`;
  const { ability, usesLeft } = found;
  if (usesLeft <= 0) return `${ability.label} is used up ${PERIOD_WORDS[ability.limit.per]}.`;
  if (ability.choices && !ability.choices.some((c) => c.id === action.choice)) {
    return `Choose ${ability.choices.map((c) => c.label).join(' or ')}.`;
  }
  return ability.validate?.(queryContext(state, hiker), action.choice);
}

export function applyUseAbility(state: GameState, action: UseAbilityAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const found = abilitiesFor(state, hiker).find((a) => a.ability.id === action.abilityId);
  if (!found) throw new Error('applyUseAbility: no such ability');
  const { ability } = found;

  const period = abilityPeriod(state, ability.limit.per);
  const use = hiker.abilityUses[ability.id];
  hiker.abilityUses[ability.id] = {
    period,
    count: use && use.period === period ? use.count + 1 : 1,
  };
  pushEvent(state, {
    kind: 'ability',
    hikerId: hiker.id,
    abilityId: ability.id,
    ...(action.choice === undefined ? {} : { choice: action.choice }),
  });
  ability.apply(effectContext(state, hiker), action.choice);
}
