/**
 * Skill Trails actions (Phase 10.7): learning a step, and switching a toggle
 * trait. Both are free: they never use the hiker's action.
 */
import { holdsToggle, learnReason, learnStep, switchToggle } from '../trails';
import type { Action, GameState } from '../types';
import { findHiker, mustFindHiker } from './common';

type LearnAction = Extract<Action, { type: 'learnStep' }>;
type ToggleAction = Extract<Action, { type: 'toggleTrait' }>;

export function validateLearn(state: GameState, action: LearnAction): string | undefined {
  const h = findHiker(state, action.hikerId);
  if (!h) return 'That hiker isn’t in the party.';
  return learnReason(state, h, action.stepId);
}

export function applyLearn(state: GameState, action: LearnAction): void {
  learnStep(state, mustFindHiker(state, action.hikerId), action.stepId);
}

/** Any time it's the hiker's turn: they're hiking and nothing is open (the gates in applyAction). */
export function validateToggle(state: GameState, action: ToggleAction): string | undefined {
  const h = findHiker(state, action.hikerId);
  if (!h) return 'That hiker isn’t in the party.';
  if (h.status !== 'active') return `${h.name} can’t do that right now.`;
  if (!holdsToggle(h, action.traitId)) return `${h.name} doesn’t have that switch.`;
  return undefined;
}

export function applyToggle(state: GameState, action: ToggleAction): void {
  switchToggle(state, mustFindHiker(state, action.hikerId), action.traitId);
}
