/**
 * Every minigame, as data (Phase 10.8). Bearrels is playable; the others are
 * listed on the testing tab as "coming soon". Their games are added one at a
 * time. The UI pairs each playable one with its game (src/ui/minigames/runners.ts).
 */
import { BALANCE } from '../config/balance';
import type { MinigameInfo, MinigameSetting, MinigameSettings } from './types';

const B = BALANCE.minigames.bearrels;

export const BEARRELS: MinigameInfo = {
  id: 'bearrels',
  name: 'Bearrels',
  baseGame: 'Barrels',
  description:
    'Hide your hikers behind barrels. Each round the bear shoots, and anyone behind that barrel is out.',
  status: 'ready',
  settings: [
    {
      kind: 'range',
      id: 'barrels',
      label: 'Barrels',
      min: B.barrels.min,
      max: B.barrels.max,
      default: B.barrels.default,
      hint: `${B.barrels.min} to ${B.barrels.max}`,
    },
    {
      kind: 'range',
      id: 'rounds',
      label: 'Rounds',
      min: B.rounds.min,
      max: B.rounds.max,
      default: B.rounds.default,
      hint: `${B.rounds.min} to ${B.rounds.max}`,
    },
    {
      kind: 'choice',
      id: 'shots',
      label: 'Shots per round',
      options: [1, 2],
      default: B.shots.default,
      hint: 'Never the same barrel twice',
    },
    {
      kind: 'hikers',
      id: 'hikers',
      label: 'Hikers',
      min: B.hikers.min,
      max: B.hikers.max,
      default: B.hikers.default,
    },
  ],
};

const soon = (id: string, name: string, baseGame: string): MinigameInfo => ({
  id,
  name,
  baseGame,
  description: '',
  status: 'soon',
  settings: [],
});

export const MINIGAMES: readonly MinigameInfo[] = [
  BEARRELS,
  soon('antsAreMarching', 'Ants Are Marching', 'Snake'),
  soon('crackedBridge', 'Cracked Bridge', 'Platformer'),
  soon('flySwatter', 'Fly Swatter', 'Reaction'),
  soon('trailMemory', 'Trail Memory', 'Memory'),
];

export const MINIGAME_BY_ID: ReadonlyMap<string, MinigameInfo> = new Map(
  MINIGAMES.map((m) => [m.id, m]),
);

/** Each setting at its default. */
export function defaultSettings(info: MinigameInfo): MinigameSettings {
  return Object.fromEntries(info.settings.map((s) => [s.id, s.default]));
}

/**
 * Settings made valid: numbers clamped to their range or snapped to an
 * option, hikers limited to the allowed ones and the most allowed (a
 * remembered setting from an older version can't break the game).
 */
export function cleanSettings(
  info: MinigameInfo,
  given: Partial<Record<string, unknown>>,
  allowedHikers: readonly string[],
): MinigameSettings {
  const out: MinigameSettings = {};
  for (const s of info.settings) out[s.id] = cleanOne(s, given[s.id], allowedHikers);
  return out;
}

function cleanOne(
  s: MinigameSetting,
  value: unknown,
  allowedHikers: readonly string[],
): number | readonly string[] {
  if (s.kind === 'hikers') {
    const list = Array.isArray(value)
      ? value.filter((v): v is string => typeof v === 'string')
      : [];
    const kept = [...new Set(list)].filter((id) => allowedHikers.includes(id)).slice(0, s.max);
    return kept.length >= s.min ? kept : s.default.filter((id) => allowedHikers.includes(id));
  }
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : s.default;
  if (s.kind === 'choice') return s.options.includes(n) ? n : s.default;
  return Math.min(s.max, Math.max(s.min, n));
}
