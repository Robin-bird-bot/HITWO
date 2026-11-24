import { abilitiesFor, abilityPeriod, effectContext, queryContext } from '../effects';
import { RESOURCE_BY_ID } from '../../content/resources';
import { pushEvent } from '../log';
import type { Action, GameState } from '../types';
import {
  findHiker,
  mustFindHiker,
  notActiveReason,
  phaseActionReason,
  spendAction,
} from './common';

type UseAbilityAction = Extract<Action, { type: 'useAbility' }>;

const PERIOD_WORDS = { day: 'today', phase: 'this phase', biome: 'this biome' } as const;

/** Using an ability is a free action: it doesn't use the hiker's phase. */
export function validateUseAbility(state: GameState, action: UseAbilityAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = notActiveReason(hiker);
  if (reason || !hiker) return reason;

  const found = abilitiesFor(state, hiker).find((a) => a.ability.id === action.abilityId);
  if (!found) return `${hiker.name} doesn’t have that ability.`;
  const { ability, usesLeft, choices } = found;
  // One that takes the action, like crafting (Fur Trade).
  if (ability.usesAction) {
    const busy = phaseActionReason(state, hiker, action);
    if (busy) return busy;
  }
  if (ability.scavengeReroll) return `${ability.label} is used from the scavenge window.`;
  if (usesLeft <= 0) return `${ability.label} is used up ${PERIOD_WORDS[ability.limit.per]}.`;
  // A resource pick rides after the choice: "choice|wood,fish" (Spare Parts).
  const [base, picked] = (action.choice ?? '').split('|');
  if (ability.resourcePick) {
    const ids = (picked ?? '').split(',').filter(Boolean);
    if (ids.length !== ability.resourcePick || !ids.every((id) => RESOURCE_BY_ID.has(id))) {
      return `Pick ${ability.resourcePick} resources.`;
    }
  }
  const chosen = ability.resourcePick ? base : action.choice;
  if (choices && !choices.some((c) => c.id === chosen)) {
    return choices.length
      ? `Choose ${choices.map((c) => c.label).join(' or ')}.`
      : `There’s nothing for ${ability.label} to do right now.`;
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
  if (ability.usesAction) spendAction(state, hiker);
  ability.apply(effectContext(state, hiker), action.choice);
}
