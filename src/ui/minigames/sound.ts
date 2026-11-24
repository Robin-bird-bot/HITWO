/**
 * Sound hooks for minigames (Phase 10.8). No sound files yet: each call
 * marks where a sound will play (Phase 16 adds audio).
 */
export type MinigameSound = 'place' | 'ready' | 'bearUp' | 'tick' | 'pop' | 'hit' | 'miss';

const listeners = new Set<(sound: MinigameSound) => void>();

/** Plays a minigame sound (a hook for now: listeners only, for tests and later audio). */
export function playSound(sound: MinigameSound): void {
  for (const l of listeners) l(sound);
}

/** Listen to minigame sounds (later: the audio player). Returns a function that stops listening. */
export function onSound(listener: (sound: MinigameSound) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
