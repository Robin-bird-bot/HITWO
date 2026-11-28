/**
 * The sound manifest (32-audio-system.md, section 1):
 * `public/assets/audio/manifest.json` lists every sound id with its files,
 * bus and status. `files` are base names (add `.ogg` or `.mp3`); several
 * files are versions of one sound. An id with no files (`status: "need"`)
 * waits for Wyatt's recording and plays nothing; `status: "code"` is the
 * packing machines' synth, which stays in code.
 */

/** The volume groups. Settings' Sound effects slider sets `ui`, `sfx` and `minigame`. */
export type Bus = 'ui' | 'sfx' | 'minigame' | 'ambience' | 'music';
export const BUSES: readonly Bus[] = ['ui', 'sfx', 'minigame', 'ambience', 'music'];

export type SoundStatus = 'made' | 'placeholder' | 'need' | 'code';
const STATUSES: readonly SoundStatus[] = ['made', 'placeholder', 'need', 'code'];

export interface SoundEntry {
  /** Base names of the versions (no extension). Empty while a sound waits for its file. */
  readonly files: readonly string[];
  readonly bus: Bus;
  readonly status: SoundStatus;
  /** Plays as a loop (ambience beds and layers, minigame loops). */
  readonly loop?: boolean;
  /** Plays at this level instead of 1.0. */
  readonly volume?: number;
}

export interface Manifest {
  readonly version: number;
  /** Where the files are, under the site's base path (`assets/audio/sfx/`). */
  readonly base: string;
  readonly sounds: Readonly<Record<string, SoundEntry>>;
}

export type AudioFormat = 'ogg' | 'mp3';

/** `.ogg`, or `.mp3` where the browser can't play Ogg Vorbis (older Safari). */
export function pickFormat(canPlayType: (type: string) => string): AudioFormat {
  return canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reads the manifest's JSON, keeping only well-formed entries. Null when it isn't a manifest. */
export function parseManifest(raw: unknown): Manifest | null {
  if (!isRecord(raw) || !isRecord(raw.sounds) || typeof raw.base !== 'string') return null;
  const sounds: Record<string, SoundEntry> = {};
  for (const [id, value] of Object.entries(raw.sounds)) {
    if (!isRecord(value)) continue;
    const { files, bus, status, loop, volume } = value;
    if (!Array.isArray(files) || !files.every((f) => typeof f === 'string')) continue;
    if (!BUSES.includes(bus as Bus) || !STATUSES.includes(status as SoundStatus)) continue;
    sounds[id] = {
      files: files as string[],
      bus: bus as Bus,
      status: status as SoundStatus,
      ...(loop === true ? { loop: true } : {}),
      ...(typeof volume === 'number' && Number.isFinite(volume) ? { volume } : {}),
    };
  }
  return { version: typeof raw.version === 'number' ? raw.version : 0, base: raw.base, sounds };
}

/** A version's URL under the site's base path (`/HITWO/`). */
export function fileUrl(
  manifest: Manifest,
  file: string,
  format: AudioFormat,
  siteBase: string,
): string {
  return `${siteBase}${manifest.base}${file}.${format}`;
}

/** Every id whose name starts with one of these (`'ui.'`, `'card.'` …). */
export function idsStartingWith(manifest: Manifest, prefixes: readonly string[]): string[] {
  return Object.keys(manifest.sounds).filter((id) => prefixes.some((p) => id.startsWith(p)));
}
