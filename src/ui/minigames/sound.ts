/**
 * Sound hooks for minigames (Phase 10.8). No sound files yet: each call
 * marks where a sound will play (Phase 16 adds audio).
 */
export type MinigameSound = 'place' | 'ready' | 'bearUp' | 'tick' | 'pop' | 'hit' | 'miss';

const listeners = new Set<(sound: MinigameSound) => void>();

/** While a demo plays in the pop-up, nothing makes a sound (20-challenge-popup.md, section 2). */
let mutedBy = 0;

/** Mutes minigame sounds while something (the pop-up's demo) is up; returns a function that unmutes. */
export function muteSounds(): () => void {
  mutedBy += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    mutedBy -= 1;
  };
}

/** Plays a minigame sound (a hook for now: listeners only, for tests and later audio). */
export function playSound(sound: MinigameSound): void {
  if (mutedBy > 0) return;
  for (const l of listeners) l(sound);
}

/** Listen to minigame sounds (later: the audio player). Returns a function that stops listening. */
export function onSound(listener: (sound: MinigameSound) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
