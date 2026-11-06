/**
 * When the challenge pop-up is followed by a "what happened" panel: after a
 * Risk roll, a Challenge space's rewards, or a deal that was taken.
 */
import { CARDS } from '../../content';
import type { GameEvent, GameState } from '../../engine';

export interface ResultToShow {
  cardId: string;
  /** The challenge's log event: its line and everything after it. */
  fromId: number;
}

type ChallengeEvent = Extract<GameEvent, { kind: 'challenge' }>;

/** Should this resolved card show what happened? Not a skipped opportunity: nothing did. */
export function showsResult(
  state: GameState,
  event: ChallengeEvent,
  challengeSpace: boolean,
): boolean {
  const card = CARDS[event.cardId];
  if (!card || card.kind === 'trial') return false;
  if (card.kind === 'opportunity') return event.results.some((r) => r.passed);
  return !!card.risk || challengeSpace || !!state.debugRolls;
}
