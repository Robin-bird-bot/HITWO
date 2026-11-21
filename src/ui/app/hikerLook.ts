/**
 * A hiker's party color by id, for places that only have the id (faces in
 * the challenge and craft windows, night event rows). Read from the current
 * game; colors don't change during a run.
 */
import { hikerColor } from '../../content/characters';
import { gameStore } from './gameStore';

export function colorOfHiker(hikerId: string): string {
  const hiker = gameStore.getState()?.hikers.find((h) => h.id === hikerId);
  return hikerColor(hiker ?? { id: hikerId });
}
