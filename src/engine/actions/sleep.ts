import { noteSleep } from '../challenges/trials';
import { BALANCE } from '../../config/balance';
import { computeGain, fireHook } from '../effects';
import { pushEvent } from '../log';
import { changeStat } from '../stats';
import type { Action, GameState, Hiker } from '../types';
import { findHiker, mustFindHiker, phaseActionReason } from './common';

type SleepAction = Extract<Action, { type: 'sleep' }>;

/** A campsite is a built-in shelter. Placed shelters arrive with items (Phase 9). */
export function isSheltered(state: GameState, hiker: Hiker): boolean {
  const tile = state.section.tiles[hiker.tileId];
  return tile?.special === 'campsite' || (tile?.shelters?.length ?? 0) > 0;
}

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
  hiker.acted = true;
  hiker.slept = true;
  pushEvent(state, { kind: 'sleep', hikerId: hiker.id });
  changeStat(state, hiker, 'energy', gain, 'Sleep');
  fireHook(state, hiker, 'onSleep');
  noteSleep(state, hiker);
}
