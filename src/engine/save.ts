/**
 * Saves are versioned (CLAUDE.md rule 7). Bump SAVE_VERSION whenever the shape
 * of GameState changes, and add a migration from the old version. Loading
 * never throws: a save that can't be read comes back as { ok: false }.
 */
import { freshAbundance } from './abundance';
import { NODE_TYPES, PHASES, type GameState } from './types';

export const SAVE_VERSION = 3;

export type LoadFailure = 'empty' | 'corrupt' | 'tooNew' | 'unsupported';
export type LoadResult = { ok: true; state: GameState } | { ok: false; reason: LoadFailure };

type SaveData = Record<string, unknown>;

/** Upgrades a save from version N (the key) to N + 1. */
const MIGRATIONS: Record<number, (save: SaveData) => SaveData> = {
  // Phase 4: Abundance meters (at the start value) and today's scavenges.
  1: (save) => ({ ...save, abundance: freshAbundance(), scavengedToday: [] }),
  // Phase 5: which challenges this section has used.
  2: (save) => ({ ...save, usedCards: [] }),
};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(text: string | null | undefined): LoadResult {
  if (!text) return { ok: false, reason: 'empty' };

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (!isRecord(data) || typeof data.saveVersion !== 'number')
    return { ok: false, reason: 'corrupt' };

  let save: SaveData = data;
  let version = data.saveVersion;
  if (version > SAVE_VERSION) return { ok: false, reason: 'tooNew' };
  while (version < SAVE_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) return { ok: false, reason: 'unsupported' };
    try {
      save = migrate(save);
    } catch {
      return { ok: false, reason: 'corrupt' };
    }
    version += 1;
    save.saveVersion = version;
  }

  if (!looksLikeGameState(save)) return { ok: false, reason: 'corrupt' };
  return { ok: true, state: save };
}

function isRecord(v: unknown): v is SaveData {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === 'string';

function looksLikeHiker(v: unknown): boolean {
  if (!isRecord(v) || !isString(v.id) || !isString(v.tileId) || !isString(v.status)) return false;
  const stats = v.stats;
  return (
    isRecord(stats) &&
    isNumber(stats.energy) &&
    isNumber(stats.appetite) &&
    isNumber(stats.morale) &&
    isNumber(v.injuries) &&
    Array.isArray(v.slots) &&
    isRecord(v.abilityUses)
  );
}

/** A light shape check: enough to refuse a broken save instead of crashing later. */
function looksLikeGameState(v: SaveData): v is SaveData & GameState {
  const section = v.section;
  return (
    isNumber(v.seed) &&
    Array.isArray(v.rng) &&
    v.rng.length === 4 &&
    v.rng.every(isNumber) &&
    isNumber(v.day) &&
    PHASES.includes(v.phase as GameState['phase']) &&
    isRecord(section) &&
    isRecord(section.tiles) &&
    Array.isArray(section.lines) &&
    isString(section.trailheadId) &&
    Array.isArray(v.hikers) &&
    v.hikers.every(looksLikeHiker) &&
    isNumber(v.caps) &&
    isRecord(v.abundance) &&
    NODE_TYPES.every((n) => isNumber((v.abundance as SaveData)[n])) &&
    Array.isArray(v.scavengedToday) &&
    Array.isArray(v.usedCards) &&
    (v.scavenge === undefined || isRecord(v.scavenge)) &&
    isNumber(v.nextEventId) &&
    Array.isArray(v.log)
  );
}
