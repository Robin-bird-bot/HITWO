/**
 * Birdsong (docs/design/23-minigames-final.md, section 5): Simon with
 * colored notes. A bird sings; each note crosses the screen colorless,
 * flashes into its color (and shape, and tone) at the middle line, then
 * fades out. Then the hiker taps the colors in the same order on a
 * notebook page. Pure and seeded.
 *
 * - **Colors:** [4–8] by tier, used in a fixed order (orange, blue, yellow,
 *   purple, red, teal, pink, white), each with its own shape.
 * - **Songs:** round 1 has [2] notes, and each round adds 1, up to the tier's
 *   longest song. At Tiers I and II the same song grows, like Simon; from
 *   Tier III every round is a whole new song.
 * - **Strikes:** a wrong note is a strike, and you finish the song anyway.
 *   Each hiker has [3] strikes for the whole game; at 3 their turn ends at
 *   once and they're out.
 * - **Turns:** hikers switch every song, in line order, skipping anyone
 *   out. The end: after the longest song, or when everyone's out. Hikers
 *   still in pass.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { quickResult } from '../quick/turns';
import type { MinigameResult, Tier } from '../types';

const BS = BALANCE.minigames.birdsong;

export type SongMode = 'grow' | 'new';

export interface BirdsongOptions {
  tier: Tier;
  /** Colors in play ("auto": the tier's), and songs ("auto": grow at I–II, new from III). */
  colors?: number | 'auto';
  songs?: 'auto' | SongMode;
  /** Prepare: +1 strike for some hikers, slower notes (the share), each song played twice (Field Notebook). */
  extraStrikes?: Readonly<Record<string, number>>;
  slower?: number;
  twice?: boolean;
}

export type BirdPhase = 'handoff' | 'listen' | 'answer' | 'after' | 'end';

export interface BirdsongState {
  tier: Tier;
  order: readonly string[];
  colors: number;
  mode: SongMode;
  /** This round's song (color indexes), and the longest it gets. */
  song: number[];
  longest: number;
  /** Rounds played so far (the song's length is round + [2] − 1). */
  round: number;
  /** Whose turn it is (an index into `order`). */
  at: number;
  phase: BirdPhase;
  phaseAt: number;
  /** How the notes cross: speed (units/s) and the gap between them (s); how many plays. */
  speed: number;
  gap: number;
  plays: number;
  /** The answer so far, and which of its notes were wrong. */
  answer: number[];
  wrong: number[];
  strikes: Record<string, number>;
  strikeMax: Record<string, number>;
  out: string[];
  time: number;
  over: boolean;
  rng: RngState;
}

const randomSong = (rng: RngState, colors: number, n: number) =>
  Array.from({ length: n }, () => Math.floor(nextFloat(rng) * colors));

export function newBirdsong(
  options: BirdsongOptions,
  order: readonly string[],
  seed: number,
): BirdsongState {
  const t = BS.tiers[options.tier];
  const rng = seedRng(seed);
  const colors = Math.max(
    2,
    Math.min(BS.palette.length, typeof options.colors === 'number' ? options.colors : t.colors),
  );
  const mode: SongMode =
    options.songs === 'grow' || options.songs === 'new'
      ? options.songs
      : options.tier >= BS.newFrom
        ? 'new'
        : 'grow';
  const slower = options.slower ?? 0;
  return {
    tier: options.tier,
    order,
    colors,
    mode,
    song: randomSong(rng, colors, BS.firstLength),
    longest: t.longest,
    round: 1,
    at: 0,
    phase: order.length ? 'handoff' : 'end',
    phaseAt: 0,
    speed: t.speed * (1 - slower),
    gap: t.gapSec * (1 + slower),
    plays: options.twice ? 2 : 1,
    answer: [],
    wrong: [],
    strikes: Object.fromEntries(order.map((id) => [id, 0])),
    strikeMax: Object.fromEntries(
      order.map((id) => [id, BS.strikes + (options.extraStrikes?.[id] ?? 0)]),
    ),
    out: [],
    time: 0,
    over: order.length === 0,
    rng,
  };
}

/** The hiker singing back now. */
export const singer = (s: BirdsongState): string | undefined => s.order[s.at];

/** How long one play of the song takes to cross the screen. */
export const playSec = (s: Pick<BirdsongState, 'song' | 'gap' | 'speed'>): number =>
  (s.song.length - 1) * s.gap + (BS.screenW + 2 * BS.noteMargin) / s.speed;

/** Listening takes every play, with a short pause between. */
export const listenSec = (s: BirdsongState): number =>
  s.plays * playSec(s) + (s.plays - 1) * BS.replayPauseSec;

/** Where each note is while listening (x on screen), whether it has its color yet, and whether it's on screen. */
export function notesNow(
  s: BirdsongState,
): { color: number; x: number; lit: boolean; seen: boolean }[] {
  if (s.phase !== 'listen') return [];
  const since = s.time - s.phaseAt;
  const each = playSec(s) + BS.replayPauseSec;
  const t = since % each;
  return s.song.map((color, k) => {
    const x = -BS.noteMargin + (t - k * s.gap) * s.speed;
    return {
      color,
      x,
      lit: x >= BS.screenW / 2,
      seen: x > -BS.noteMargin && x < BS.screenW + BS.noteMargin,
    };
  });
}

/** The next hiker still in, after `from` (wrapping round); undefined when everyone's out. */
function nextIn(s: BirdsongState, from: number): number | undefined {
  for (let k = 1; k <= s.order.length; k++) {
    const i = (from + k) % s.order.length;
    if (!s.out.includes(s.order[i]!)) return i;
  }
  return undefined;
}

/** The round is over: a longer song for the next hiker still in, or the end. */
function nextRound(s: BirdsongState): BirdsongState {
  const length = s.song.length + 1;
  const next = nextIn(s, s.at);
  if (length > s.longest || next === undefined)
    return { ...s, phase: 'end', phaseAt: s.time, over: true };
  const rng: RngState = [...s.rng];
  const song =
    s.mode === 'grow'
      ? [...s.song, Math.floor(nextFloat(rng) * s.colors)]
      : randomSong(rng, s.colors, length);
  return {
    ...s,
    rng,
    song,
    round: s.round + 1,
    at: next,
    phase: 'handoff',
    phaseAt: s.time,
    answer: [],
    wrong: [],
  };
}

/**
 * Tap a color while answering. A wrong one is a strike (the song goes on).
 * At the hiker's last strike their turn ends at once and they're out; at
 * the song's end, the round is over.
 */
export function pick(s: BirdsongState, color: number): BirdsongState {
  const who = singer(s);
  if (s.over || s.phase !== 'answer' || !who || color < 0 || color >= s.colors) return s;
  const k = s.answer.length;
  const right = s.song[k] === color;
  const answer = [...s.answer, color];
  const wrong = right ? s.wrong : [...s.wrong, k];
  const strikes = right ? s.strikes : { ...s.strikes, [who]: (s.strikes[who] ?? 0) + 1 };
  const out = (strikes[who] ?? 0) >= (s.strikeMax[who] ?? BS.strikes) ? [...s.out, who] : s.out;
  const next = { ...s, answer, wrong, strikes, out };
  if (out.length > s.out.length || answer.length >= s.song.length)
    return { ...next, phase: 'after', phaseAt: s.time };
  return next;
}

export function tick(s0: BirdsongState, dt: number): BirdsongState {
  if (s0.over) return s0;
  const s: BirdsongState = { ...s0, time: s0.time + dt };
  const since = s.time - s.phaseAt;
  switch (s.phase) {
    case 'handoff':
      return since >= BS.handoffSec ? { ...s, phase: 'listen', phaseAt: s.time } : s;
    case 'listen':
      return since >= listenSec(s) ? { ...s, phase: 'answer', phaseAt: s.time } : s;
    case 'after':
      return since >= BS.afterSec ? nextRound(s) : s;
    default:
      return s;
  }
}

/** Hikers still in at the end pass; the rest fail ([1] energy unless the challenge says otherwise). */
export const result = (s: BirdsongState): MinigameResult =>
  quickResult(s.order, (id) => !s.out.includes(id));
