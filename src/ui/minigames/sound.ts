/**
 * Minigame sounds (32-audio-system.md, section 6), on the game's audio
 * engine. While the pop-up's demo plays, nothing makes a sound
 * (20-challenge-popup.md, section 2): every minigame sound goes through here
 * so the demo can mute them all.
 *
 * - **Hooks:** `playSound('pop')` and the rest map to the shared `mg.` sounds;
 *   `tick` gets the seconds left (5 to 1) and `note` the Birdsong note (1 to 6).
 * - **A game's own sounds:** `mgSfx('saw.stroke')`, and `useMgLoop` for the
 *   loops that play while their thing is on screen (`fly.buzz`, `bear.snore` …).
 * - **Shared moments:** `useClockTicks` (the last five seconds of a clock,
 *   then time up) and `useTurnSound` (the next hiker's turn).
 */
import { useEffect, useRef } from 'react';
import { loop, sfx, type LoopHandle, type SfxOptions, type SoundHandle } from '../../audio/engine';

/** `note`: a Birdsong note (one per color). */
export type MinigameSound = 'place' | 'ready' | 'bearUp' | 'tick' | 'pop' | 'hit' | 'miss' | 'note';

export const MINIGAME_SOUNDS: readonly MinigameSound[] = [
  'place',
  'ready',
  'bearUp',
  'tick',
  'pop',
  'hit',
  'miss',
  'note',
];

const listeners = new Set<(sound: MinigameSound) => void>();

/** While a demo plays in the pop-up, nothing makes a sound. */
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

/** True while a demo has the sound off. */
export const soundsMuted = (): boolean => mutedBy > 0;

/**
 * The sound a hook plays: its id, and for `tick` the version for the seconds
 * left (5 seconds left is the first, 1 the fifth, each higher).
 */
export function hookSound(sound: MinigameSound, n?: number): { id: string; version?: number } {
  switch (sound) {
    case 'tick':
      return { id: 'mg.tick', version: Math.min(4, Math.max(0, 5 - Math.round(n ?? 5))) };
    case 'note':
      return { id: `mg.note${Math.min(6, Math.max(1, Math.round(n ?? 1)))}` };
    default:
      return { id: `mg.${sound}` };
  }
}

/** Plays a minigame hook: `tick` with the seconds left, `note` with the note (1 to 6). */
export function playSound(sound: MinigameSound, n?: number): void {
  if (mutedBy > 0) return;
  for (const l of listeners) l(sound);
  const { id, version } = hookSound(sound, n);
  sfx(id, version !== undefined ? { version } : {});
}

/** Listen to minigame hooks (tests). Returns a function that stops listening. */
export function onSound(listener: (sound: MinigameSound) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const SILENT: SoundHandle = { stop() {} };

/** A game's own sound (`saw.stroke`, `bike.bell` …), silent during the demo. */
export function mgSfx(id: string, options?: SfxOptions): SoundHandle {
  if (mutedBy > 0) return SILENT;
  return sfx(id, options);
}

/** A game's loop while `on` (and the game is on screen), fading in and out. */
export function useMgLoop(id: string, on: boolean, volume = 1): void {
  const handle = useRef<LoopHandle | null>(null);
  useEffect(() => {
    if (!on || mutedBy > 0) return;
    const h = loop(id, { fadeIn: 0.2, volume });
    handle.current = h;
    return () => {
      h.fadeOut(0.3);
      if (handle.current === h) handle.current = null;
    };
  }, [id, on, volume]);
  useEffect(() => {
    handle.current?.setVolume(volume, 0.2);
  }, [volume]);
}

/**
 * A clock's last seconds (32-audio-system.md, section 6): a tick for each of
 * the last 5 whole seconds, each higher, then `mg.timeUp` when it runs out.
 * `left` is seconds left (null: no clock).
 */
export function useClockTicks(left: number | null, running = true): void {
  const was = useRef<number | null>(null);
  useEffect(() => {
    const before = was.current;
    was.current = left;
    if (left === null || before === null || !running) return;
    const now = Math.ceil(left);
    if (now < Math.ceil(before) && now >= 1 && now <= 5) playSound('tick', now);
    if (left <= 0 && before > 0) mgSfx('mg.timeUp');
  }, [left, running]);
}

/** A sound to play: its id, or its id and how. */
export type FrameSound = string | readonly [string, SfxOptions];

/**
 * A game's own sounds from its state: `detect(before, after)` names the
 * sounds for what changed since the last frame (a bike appeared, a rock
 * landed). Runs on every change of `game`.
 */
export function useFrameSounds<T>(
  game: T,
  detect: (before: T, after: T) => readonly FrameSound[],
): void {
  const was = useRef(game);
  // Every render: `detect` is usually a new function each time, and a frame that
  // didn't change the game returns at once.
  useEffect(() => {
    const before = was.current;
    was.current = game;
    if (before === game) return;
    for (const s of detect(before, game)) {
      if (typeof s === 'string') mgSfx(s);
      else mgSfx(s[0], s[1]);
    }
  });
}

/** `mg.turn` when `key` (the hiker playing now) changes, not for the first. */
export function useTurnSound(key: string | number | null | undefined): void {
  const was = useRef(key);
  useEffect(() => {
    if (was.current !== key && key !== null && key !== undefined) mgSfx('mg.turn');
    was.current = key;
  }, [key]);
}

/** `mg.hikerPassed` or `mg.hikerFailed` as each hiker's part ends. */
export function useHikerResults(results: Readonly<Record<string, 'passed' | 'failed' | null>>) {
  const was = useRef(results);
  useEffect(() => {
    for (const [id, r] of Object.entries(results)) {
      if (r && was.current[id] !== r) mgSfx(r === 'passed' ? 'mg.hikerPassed' : 'mg.hikerFailed');
    }
    was.current = results;
  });
}
