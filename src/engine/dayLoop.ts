/**
 * The day loop: Morning → Afternoon → Night → camp step → the next Morning.
 * Each hiker gets one action per phase; ending a phase clears that.
 *
 * Camp step: first the night event (05-nights-and-weather.md), then a night
 * without sleep costs Energy and the end of the day costs Appetite, then
 * conditions tick. Clothing durability and passed-out countdowns join in
 * Phases 7 and 9.
 */
import { countSleep } from './counters';
import { countdownAtCamp } from './health';
import { wearAtCamp } from './items/wear';
import { tickBoosts } from './items/boosts';
import { sheltersAtCamp } from './items/shelters';
import { openNext } from './challenges/reveal';
import { runNightEvent } from './night/nightEvents';
import { checkTrials } from './challenges/trials';
import { BALANCE } from '../config/balance';
import { recoverOvernight } from './abundance';
import { tickConditions } from './conditions';
import { computeCost, fireHook, firePhaseEnd, firePhaseStart } from './effects';
import { pushEvent } from './log';
import { advanceWeather, weatherPhaseEnd, weatherPhaseStart } from './weather';
import { changeStat } from './stats';
import type { GameState, Hiker } from './types';

/** Active hikers who still have their action this phase. The UI warns before ending the phase. */
export function hikersWhoHaventActed(state: GameState): Hiker[] {
  return state.hikers.filter((h) => h.status === 'active' && !h.acted);
}

export function endPhase(state: GameState): void {
  // Trials are judged first: Jogger needs to know who acted this phase.
  checkTrials(state);
  for (const h of state.hikers) h.acted = false;
  // A Fire node burns whoever ends the phase on it; then conditions that act each phase
  // (Soaked, Allergies, Burning cooling off), then the tick.
  weatherPhaseEnd(state);
  for (const h of state.hikers) if (h.status === 'active') firePhaseEnd(state, h, state.phase);
  tickConditions(state, 'phases');
  // Items used "this phase" stop working.
  tickBoosts(state, 'phases');

  if (state.phase === 'morning') {
    state.phase = 'afternoon';
    pushEvent(state, { kind: 'phase', day: state.day, phase: state.phase });
    weatherPhaseStart(state);
    firePhaseStart(state);
  } else if (state.phase === 'afternoon') {
    state.phase = 'night';
    pushEvent(state, { kind: 'phase', day: state.day, phase: state.phase });
    weatherPhaseStart(state);
    firePhaseStart(state);
  } else {
    campStep(state);
    startNewDay(state);
  }
}

function takesCampDrains(h: Hiker): boolean {
  return (
    h.status === 'active' || (h.status === 'passedOut' && BALANCE.rules.passedOutHikersDrainAtCamp)
  );
}

function noSleepDrain(state: GameState, h: Hiker): void {
  if (h.slept || !takesCampDrains(h)) return;
  const cost = computeCost(
    state,
    [h],
    { key: 'night.noSleepEnergy', actorId: h.id, subjectId: h.id, role: 'actor', phase: 'night' },
    BALANCE.night.noSleepEnergy,
  );
  changeStat(state, h, 'energy', -cost, 'No sleep');
}

function endOfDayDrain(state: GameState, h: Hiker): void {
  if (!takesCampDrains(h)) return;
  const cost = computeCost(
    state,
    [h],
    { key: 'endOfDay.appetite', actorId: h.id, subjectId: h.id, role: 'actor', phase: 'night' },
    BALANCE.endOfDay.appetite,
  );
  changeStat(state, h, 'appetite', -cost, 'End of day');
}

function campStep(state: GameState): void {
  runNightEvent(state);
  // Bear Spray counts the night it guarded; Camping Lamps go out.
  tickBoosts(state, 'nights');
  for (const t of Object.values(state.section.tiles)) delete t.lampTonight;
  for (const h of state.hikers) {
    if (BALANCE.rules.noSleepDrainFirst) {
      noSleepDrain(state, h);
      endOfDayDrain(state, h);
    } else {
      endOfDayDrain(state, h);
      noSleepDrain(state, h);
    }
  }
  for (const h of state.hikers) if (h.status === 'active') fireHook(state, h, 'onEndOfDay');
  countSleep(state);
  recoverOvernight(state);
  tickConditions(state, 'days');
  // Worn clothes lose a day of durability, and shelters count a night.
  wearAtCamp(state);
  sheltersAtCamp(state);
  // Passed-out hikers left alone count down, last.
  countdownAtCamp(state);
}

/** Morning of a new day (after camp, or the station's free night). */
export function startNewDay(state: GameState): void {
  state.day += 1;
  state.phase = 'morning';
  for (const h of state.hikers) {
    h.slept = false;
    delete h.watching;
  }
  state.scavengedToday = [];
  pushEvent(state, { kind: 'phase', day: state.day, phase: state.phase });
  advanceWeather(state);
  for (const h of state.hikers) if (h.status === 'active') fireHook(state, h, 'onStartOfDay');
  weatherPhaseStart(state);
  firePhaseStart(state);
  // A hiker chased onto a new tile in the night: its challenge opens now.
  openNext(state);
}
