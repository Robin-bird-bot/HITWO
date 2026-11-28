/**
 * The music (32-audio-system.md, section 5): which piece and version play
 * where, and how a change is made. Pure, so the timing can be tested; the
 * player (`musicPlayer.ts`) does what these say with Web Audio.
 *
 * - A piece has `bpm`, `beatsPerBar`, `bars` and named versions (`day`,
 *   `night`, `rain`, `snow` for a biome; `trailmate` and `cabinet` for
 *   packing). All of a piece's versions start together and loop on the same
 *   length; a change inside a piece only changes their volumes ([8 s] at
 *   dusk and dawn, [4 s] for weather).
 * - A new piece starts on the current one's next bar line and crossfades
 *   over [2 s].
 * - A piece with no files plays nothing: until Wyatt's songs arrive, the
 *   manifest is empty and the game is quiet.
 */
import { BALANCE } from '../config/balance';
import type { BiomeId, WeatherId } from '../engine';
import { MINIGAMES } from '../minigames/catalog';
import type { MinigameCategory } from '../minigames/types';

const M = BALANCE.audio.music;

export interface Piece {
  bpm: number;
  beatsPerBar: number;
  bars: number;
  /** Version name → file (a base name: `.ogg` or `.mp3` is added, like the sounds). */
  versions: Readonly<Record<string, string>>;
}

export interface MusicManifest {
  pieces: Readonly<Record<string, Piece>>;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const positive = (v: unknown): v is number => typeof v === 'number' && v > 0;

/** Reads `public/assets/audio/music/manifest.json`, leaving out any piece that's incomplete. */
export function parseMusicManifest(raw: unknown): MusicManifest {
  const pieces: Record<string, Piece> = {};
  const list = isRecord(raw) && isRecord(raw.pieces) ? raw.pieces : {};
  for (const [id, p] of Object.entries(list)) {
    if (!isRecord(p) || !positive(p.bpm) || !positive(p.beatsPerBar) || !positive(p.bars)) continue;
    if (!isRecord(p.versions)) continue;
    const versions = Object.fromEntries(
      Object.entries(p.versions).filter((e): e is [string, string] => typeof e[1] === 'string'),
    );
    if (!Object.keys(versions).length) continue;
    pieces[id] = { bpm: p.bpm, beatsPerBar: p.beatsPerBar, bars: p.bars, versions };
  }
  return { pieces };
}

/** A bar's length, and the loop's (s). */
export const barSeconds = (p: Piece): number => (p.beatsPerBar * 60) / p.bpm;
export const loopSeconds = (p: Piece): number => p.bars * barSeconds(p);

/** The first bar line at or after `now`, for a piece that started at `startedAt` (s). */
export function nextBarLine(p: Piece, startedAt: number, now: number): number {
  if (now <= startedAt) return startedAt;
  const bar = barSeconds(p);
  const bars = Math.ceil((now - startedAt) / bar - 1e-9);
  return startedAt + bars * bar;
}

export type MusicPlace =
  | 'none'
  | 'title'
  | 'select'
  | 'packing'
  | 'loading'
  | 'trail'
  | 'station'
  | 'wonder'
  | 'briefing'
  | 'minigame'
  | 'nightEvent'
  | 'summit'
  | 'over';

export interface MusicScene {
  place: MusicPlace;
  biome?: BiomeId;
  night?: boolean;
  weather?: WeatherId;
  /** Packing: the machine's look. */
  look?: 'trailmate' | 'cabinet';
  /** A minigame: which one, and whether it's a Dodge boss. */
  game?: string;
  boss?: boolean;
  /** A night event's group. */
  group?: 'nuisance' | 'danger' | 'eerie';
}

const BIOME_PIECE: Record<BiomeId, string> = {
  meadow: 'meadow',
  temperateRainforest: 'rainforest',
  alpine: 'alpine',
};

const NIGHT_PIECE = { nuisance: 'nightNuisance', danger: 'nightDanger', eerie: 'nightEerie' };

/**
 * Each minigame group's piece (34-music.md: Quick Draw for quick reaction
 * games, Thinking Cap for calm ones, Run For It for movement and Dodge).
 * TODO(wyatt): the groups follow the testing tab's categories for now.
 */
const GROUP_PIECE: Record<MinigameCategory, string> = {
  move: 'runForIt',
  reaction: 'quickDraw',
  rhythm: 'quickDraw',
  luck: 'quickDraw',
  puzzle: 'thinkingCap',
  memory: 'thinkingCap',
  search: 'thinkingCap',
};

/** Games with a piece of their own (each falls back to its group's). */
const OWN_PIECE: Readonly<Record<string, string>> = {
  spookyGhost: 'lightsOut',
  raccoonShuffle: 'shellGame',
  fallenBranch: 'shanty',
};

/** Games with no music (Birdsong is listening). */
const SILENT_GAMES: readonly string[] = ['birdsong'];

/** The pieces a minigame could play, best first. */
export function minigamePieces(game: string, boss = false): string[] {
  if (SILENT_GAMES.includes(game)) return [];
  const category = MINIGAMES.find((m) => m.id === game)?.category;
  return [
    ...(OWN_PIECE[game] ? [OWN_PIECE[game]] : []),
    ...(boss && game === 'dodge' ? ['bigTrouble'] : []),
    ...(category ? [GROUP_PIECE[category]] : []),
  ];
}

/** The pieces a scene could play, best first. */
export function piecesFor(scene: MusicScene): string[] {
  switch (scene.place) {
    case 'none':
      return [];
    case 'trail':
      return scene.biome ? [BIOME_PIECE[scene.biome]] : [];
    case 'packing':
      return ['packing'];
    case 'minigame':
      return scene.game ? minigamePieces(scene.game, scene.boss) : [];
    case 'nightEvent':
      return scene.group ? [NIGHT_PIECE[scene.group]] : [];
    default:
      return [scene.place];
  }
}

/** The versions a scene wants, best first. */
function versionsFor(scene: MusicScene): string[] {
  if (scene.place === 'packing') return [scene.look ?? 'trailmate', 'trailmate', 'cabinet'];
  const out: string[] = [];
  if (scene.weather === 'rain') out.push('rain');
  if (scene.weather === 'snow') out.push('snow');
  out.push(scene.night ? 'night' : 'day', 'day');
  return out;
}

export interface MusicChoice {
  piece: string;
  version: string;
}

/** What plays for a scene: the first of its pieces that has files, and its best version. */
export function chooseMusic(scene: MusicScene, manifest: MusicManifest): MusicChoice | null {
  for (const id of piecesFor(scene)) {
    const piece = manifest.pieces[id];
    if (!piece) continue;
    const names = Object.keys(piece.versions);
    const version = versionsFor(scene).find((v) => v in piece.versions) ?? names[0];
    if (version) return { piece: id, version };
  }
  return null;
}

/** How long a change of version takes: dusk and dawn are slow; weather is quicker. */
export function versionFade(from: string, to: string): number {
  const weather = (v: string) => v === 'rain' || v === 'snow';
  return weather(from) || weather(to) ? M.fade.weather : M.fade.dayNight;
}

/** Each version's volume: the one playing at 1, the rest silent. */
export function volumesFor(piece: Piece, version: string): Record<string, number> {
  return Object.fromEntries(Object.keys(piece.versions).map((v) => [v, v === version ? 1 : 0]));
}

/** What's playing now. */
export interface NowPlaying {
  piece: string;
  version: string;
  /** When its versions started (s, the audio clock). */
  startedAt: number;
}

export type MusicPlan =
  | { kind: 'keep' }
  | { kind: 'versions'; volumes: Record<string, number>; fade: number }
  | {
      kind: 'start';
      piece: string;
      version: string;
      /** When the new piece's versions all start (s). */
      at: number;
      volumes: Record<string, number>;
      fade: number;
    }
  | { kind: 'stop'; at: number; fade: number };

/**
 * What to do to go from what's playing to what's wanted: nothing, change
 * the versions' volumes, start a piece (on the next bar line if one is
 * playing), or stop.
 */
export function planMusic(
  playing: NowPlaying | null,
  want: MusicChoice | null,
  manifest: MusicManifest,
  now: number,
): MusicPlan {
  const current = playing && manifest.pieces[playing.piece];
  if (!want) {
    if (!playing || !current) return { kind: 'keep' };
    return { kind: 'stop', at: nextBarLine(current, playing.startedAt, now), fade: M.fade.piece };
  }
  const piece = manifest.pieces[want.piece];
  if (!piece) return { kind: 'keep' };
  if (playing && playing.piece === want.piece) {
    if (playing.version === want.version) return { kind: 'keep' };
    return {
      kind: 'versions',
      volumes: volumesFor(piece, want.version),
      fade: versionFade(playing.version, want.version),
    };
  }
  return {
    kind: 'start',
    piece: want.piece,
    version: want.version,
    at: playing && current ? nextBarLine(current, playing.startedAt, now) : now,
    volumes: volumesFor(piece, want.version),
    fade: playing ? M.fade.piece : 0,
  };
}

/** The weather's touch on whatever is playing: a filter sweep in wind, a wobble in heat. */
export function weatherEffects(weather: WeatherId | undefined): {
  sweep: boolean;
  wobble: boolean;
} {
  return { sweep: weather === 'wind', wobble: weather === 'heatwave' };
}

/** The playback rate for a minigame clock with this many seconds left (or none). */
export const hurryRate = (secondsLeft: number | null): number =>
  secondsLeft !== null && secondsLeft > 0 && secondsLeft <= M.hurry.lastSec ? M.hurry.rate : 1;

/** Decibels as a gain. */
export const dbToGain = (db: number): number => Math.pow(10, db / 20);
