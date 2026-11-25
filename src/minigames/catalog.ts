/**
 * Every minigame, as data (Phase 10.8). Bearrels and the four puzzle games
 * (docs/design/11-minigames-puzzles.md) are playable; the rest are listed on
 * the testing tab as "coming soon". The UI pairs each playable one with its
 * game (src/ui/minigames/runners.tsx).
 */
import { BALANCE } from '../config/balance';
import { ART_STYLES } from './bearrels/styles';
import type {
  MinigameInfo,
  MinigameSetting,
  MinigameSettings,
  MinigameSettingValue,
} from './types';

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
      kind: 'style',
      id: 'style',
      label: 'Art style',
      options: ART_STYLES,
      default: ART_STYLES[0].id,
    },
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

/** Tier I, II or III: the puzzle games' main setting. */
const TIER: MinigameSetting = {
  kind: 'choice',
  id: 'tier',
  label: 'Tier',
  options: [1, 2, 3],
  labels: ['I', 'II', 'III'],
  default: 1,
  hint: 'Harder each tier',
};

const HIKERS: MinigameSetting = {
  kind: 'hikers',
  id: 'hikers',
  label: 'Hikers',
  min: B.hikers.min,
  max: B.hikers.max,
  default: B.hikers.default,
};

/** An override: "Auto" uses the tier's value. */
const override = (
  id: string,
  label: string,
  options: readonly [string, string][],
): MinigameSetting => ({
  kind: 'pick',
  id,
  label,
  options: [
    { id: 'auto', label: 'Auto' },
    ...options.map(([oid, olabel]) => ({ id: oid, label: olabel })),
  ],
  default: 'auto',
});

const ON_OFF: readonly [string, string][] = [
  ['on', 'On'],
  ['off', 'Off'],
];

export const TRAILDLE: MinigameInfo = {
  id: 'traildle',
  name: 'Traildle',
  baseGame: 'Puzzle',
  description: 'Guess the hidden codes on the trail signs. Two hikers guess at once.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    override(
      'signs',
      'Signs',
      [3, 4, 5, 6, 7, 8].map((n) => [String(n), String(n)]),
    ),
    override('timer', 'Timer', ON_OFF),
  ],
};

export const FIND_OBJECT: MinigameInfo = {
  id: 'findObject',
  name: 'Find the Object',
  baseGame: 'Reaction',
  description: 'Find the snacks on the list before time runs out.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    override('mode', 'Mode', [
      ['still', 'Still'],
      ['windy', 'Windy'],
      ['dark', 'Dark'],
    ]),
  ],
};

export const REMEMBER_PATH: MinigameInfo = {
  id: 'rememberPath',
  name: 'Remember the Path',
  baseGame: 'Memory',
  description: 'Watch the ranger walk the trail, then walk it from memory.',
  status: 'ready',
  lineUp: true,
  settings: [TIER, HIKERS],
};

export const FIND_PATH: MinigameInfo = {
  id: 'findPath',
  name: 'Find the Path',
  baseGame: 'Minefield',
  description: 'Take turns finding the hidden trail through the forest.',
  status: 'ready',
  lineUp: true,
  settings: [TIER, HIKERS, override('fog', 'Fog', ON_OFF)],
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
  TRAILDLE,
  FIND_OBJECT,
  REMEMBER_PATH,
  FIND_PATH,
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
): MinigameSettingValue {
  if (s.kind === 'style' || s.kind === 'pick') {
    return typeof value === 'string' && s.options.some((o) => o.id === value) ? value : s.default;
  }
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
