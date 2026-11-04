import { BALANCE } from '../config/balance';
import type { GameEventBody, GameState } from './types';

/** Adds an event to the trail log, keeping only the most recent ones. */
export function pushEvent(state: GameState, body: GameEventBody): void {
  state.log.push({ ...body, id: state.nextEventId, day: state.day, phase: state.phase });
  state.nextEventId += 1;
  const excess = state.log.length - BALANCE.log.maxEvents;
  if (excess > 0) state.log.splice(0, excess);
}
