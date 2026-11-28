/**
 * The rules for which sounds play (32-audio-system.md, section 2), kept apart
 * from Web Audio so they can be tested:
 *
 * - **Versions:** pick one at random, never the same one twice in a row.
 * - **Jitter:** a small random change of pitch and volume on sounds with
 *   versions and on footsteps, but not on a sound that sets its own rate (the
 *   XP ticks and the bench clacks climb in pitch on purpose).
 * - **Limits:** a few of the same sound at once, a cap on all sounds, and no
 *   sound starting twice within a few milliseconds. Over a limit, the oldest
 *   stops.
 */
import { BALANCE } from '../config/balance';

const A = BALANCE.audio;

/** A version to play: random, never `last` again while there's another. */
export function pickVersion(count: number, last: number | undefined, random: () => number): number {
  if (count <= 1) return 0;
  if (last === undefined || last < 0 || last >= count) return Math.floor(random() * count);
  // Pick among the others, then step over the last one.
  const pick = Math.floor(random() * (count - 1));
  return pick >= last ? pick + 1 : pick;
}

/** Footsteps: every `foot.` id. */
export const isFootstep = (id: string): boolean => id.startsWith('foot.');

/** Ticks and brushing, which repeat fast and may overlap more. */
const TICKS = ['mg.tick', 'xp.gain', 'hike.tally', 'compass.ratchet', 'rope.drag', 'scav.brush.'];
export const isTick = (id: string): boolean => TICKS.some((t) => id.startsWith(t));

/** How many of this sound may play at once. */
export function perSoundLimit(id: string): number {
  if (isFootstep(id)) return A.limits.footsteps;
  if (isTick(id)) return A.limits.ticks;
  return A.limits.perSound;
}

/** The pitch (playback rate) and volume (a gain) a sound plays at. */
export function jitterFor(
  id: string,
  versions: number,
  rate: number | undefined,
  random: () => number,
): { rate: number; gain: number } {
  if (rate !== undefined) return { rate, gain: 1 };
  if (versions <= 1 && !isFootstep(id)) return { rate: 1, gain: 1 };
  const pitch = 1 + (random() * 2 - 1) * A.jitter.pitch;
  const db = (random() * 2 - 1) * A.jitter.volumeDb;
  return { rate: pitch, gain: Math.pow(10, db / 20) };
}

/** A sound that's playing (or loading to play). */
export interface Voice {
  readonly id: string;
  /** When it started, in milliseconds. */
  readonly started: number;
  stop(): void;
}

export type Admission = { play: false } | { play: true; stop: Voice[] };

/**
 * Whether a new sound may start now, and which playing ones stop first to
 * make room: the oldest of the same sound, then the oldest of all.
 * `lastStart` is when this id last started.
 */
export function admit(
  active: readonly Voice[],
  id: string,
  now: number,
  lastStart: number | undefined,
): Admission {
  if (lastStart !== undefined && now - lastStart < A.limits.retriggerMs) return { play: false };
  const byAge = [...active].sort((a, b) => a.started - b.started);
  const stop: Voice[] = [];
  const same = byAge.filter((v) => v.id === id);
  const limit = perSoundLimit(id);
  while (same.length >= limit) {
    const oldest = same.shift();
    if (oldest) stop.push(oldest);
  }
  const rest = byAge.filter((v) => !stop.includes(v));
  while (rest.length >= A.limits.total) {
    const oldest = rest.shift();
    if (oldest) stop.push(oldest);
  }
  return { play: true, stop };
}
