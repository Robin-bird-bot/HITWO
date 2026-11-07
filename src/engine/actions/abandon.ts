/**
 * Abandoning the hike by choice (01-design-doc.md: "The player can also
 * abandon a hiker at any time"). The hiker leaves the party for good, taking
 * everything they carry. The countdown running out does the same at camp
 * (src/engine/health.ts).
 */
import { abandonHike } from '../health';
import type { Action, GameState } from '../types';
import { findHiker, mustFindHiker } from './common';

type AbandonAction = Extract<Action, { type: 'abandon' }>;

export function validateAbandon(state: GameState, action: AbandonAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  if (!hiker) return 'That hiker isn’t in the party.';
  if (hiker.status === 'abandoned') return `${hiker.name} has already left the hike.`;
  if (hiker.status === 'checkedIn') return `${hiker.name} has checked in.`;
  return undefined;
}

export function applyAbandon(state: GameState, action: AbandonAction): void {
  abandonHike(state, mustFindHiker(state, action.hikerId), 'choice');
}
