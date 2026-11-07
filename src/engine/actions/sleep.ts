import { noteSleep } from '../challenges/trials';
import { BALANCE } from '../../config/balance';
import { computeGain, fireHook } from '../effects';
import { pushEvent } from '../log';
import { changeStat } from '../stats';
import type { Action, GameState } from '../types';
import { isSheltered } from '../map';
import { findHiker, mustFindHiker, phaseActionReason, spendAction } from './common';

type SleepAction = Extract<Action, { type: 'sleep' }>;

export { isSheltered } from '../map';

export function validateSleep(state: GameState, action: SleepAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = phaseActionReason(state, hiker, action);
  if (reason) return reason;
  if (state.phase !== 'night') return 'Hikers sleep at night.';
  return undefined;
}

export function applySleep(state: GameState, action: SleepAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const base = isSheltered(state, hiker) ? BALANCE.sleep.shelteredEnergy : BALANCE.sleep.energy;
  const gain = computeGain(
    state,
    [hiker],
    {
      key: 'sleep.energy',
      actorId: hiker.id,
      subjectId: hiker.id,
      role: 'actor',
      phase: state.phase,
    },
    base,
  );
  spendAction(state, hiker);
  hiker.slept = true;
  pushEvent(state, { kind: 'sleep', hikerId: hiker.id });
  changeStat(state, hiker, 'energy', gain, 'Sleep');
  fireHook(state, hiker, 'onSleep');
  noteSleep(state, hiker);
}
