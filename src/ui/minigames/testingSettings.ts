/**
 * The Minigame testing tab's settings, remembered on this device (Phase
 * 10.8). Only this one key is ever written: the tab never touches the saved
 * hike. A missing, broken or out-of-range value falls back to the defaults.
 */
import { MINIGAME_BY_ID, cleanSettings, defaultSettings } from '../../minigames/catalog';
import type { MinigameSettings } from '../../minigames/types';
import type { StorageLike } from '../../store/autosave';

export const TESTING_KEY = 'hike-in-the-woods/minigame-testing';

/** The hikers the testing tab offers: the playable ones, in the art's order. */
export const TEST_HIKERS: readonly string[] = [
  'finn',
  'ellie',
  'mom',
  'wyatt',
  'gdog',
  'grandpaWink',
];

type Stored = Partial<Record<string, Partial<Record<string, unknown>>>>;

function readAll(storage: StorageLike | undefined): Stored {
  try {
    const text = storage?.getItem(TESTING_KEY);
    const data: unknown = text ? JSON.parse(text) : {};
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Stored) : {};
  } catch {
    return {};
  }
}

/** A minigame's remembered settings, made valid. */
export function readTestingSettings(
  storage: StorageLike | undefined,
  minigameId: string,
): MinigameSettings {
  const info = MINIGAME_BY_ID.get(minigameId);
  if (!info) return {};
  const given = readAll(storage)[minigameId];
  return given ? cleanSettings(info, given, TEST_HIKERS) : defaultSettings(info);
}

/** Remembers a minigame's settings (and nothing else). */
export function writeTestingSettings(
  storage: StorageLike | undefined,
  minigameId: string,
  settings: MinigameSettings,
): void {
  try {
    const all = readAll(storage);
    storage?.setItem(TESTING_KEY, JSON.stringify({ ...all, [minigameId]: settings }));
  } catch {
    // Not remembered this time; the tab still works.
  }
}

export function browserStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
