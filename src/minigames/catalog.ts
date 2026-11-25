/**
 * Every minigame, as data (Phase 10.8). Bearrels, the four puzzle games
 * (docs/design/11-minigames-puzzles.md) and Dodge
 * (docs/design/12-minigames-dodge.md) are playable; the rest are listed on
 * the testing tab as "coming soon". The UI pairs each playable one with its
 * game (src/ui/minigames/runners.tsx).
 */
import { BALANCE } from '../config/balance';
import { ART_STYLES } from './bearrels/styles';
import { ANIMAL_IDS, ANIMALS, attackChoices, isAnimal } from './dodge/animals';
import type {
  MinigameInfo,
  MinigameSetting,
  MinigameSettings,
  MinigameSettingValue,
  PickOption,
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

/** A number setting that can also be "Auto" (the tier's or default value). */
const autoRange = (
  id: string,
  label: string,
  min: number,
  max: number,
  autoValue: number,
  unit: string,
  step = 1,
  autoHint?: string,
): MinigameSetting => ({
  kind: 'autoRange',
  id,
  label,
  min,
  max,
  step,
  autoValue,
  hint: `Auto (${autoHint ?? `${autoValue}${unit}`}), or ${min} to ${max}${unit}`,
});

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
      ['darkWindy', 'Dark + windy'],
    ]),
    autoRange('rounds', 'Rounds', 1, 5, BALANCE.minigames.findObject.rounds, ''),
    autoRange(
      'secPerTarget',
      'Seconds per target',
      1,
      8,
      BALANCE.minigames.findObject.secPerTarget,
      ' s',
    ),
    autoRange(
      'extraSec',
      'Extra seconds per round',
      0,
      20,
      BALANCE.minigames.findObject.extraSecPerRound,
      ' s',
    ),
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
  settings: [
    TIER,
    HIKERS,
    override('fog', 'Fog', ON_OFF),
    {
      kind: 'pick',
      id: 'hide',
      label: 'Hide after a run-out',
      options: [
        { id: 'trail', label: 'Trail only' },
        { id: 'everything', label: 'Everything' },
      ],
      default: 'trail',
    },
  ],
};

const DG = BALANCE.minigames.dodge;

/** Dodge's attacks for the Attack picker: All, then each one the animal uses (greyed out until its tier). */
function dodgeAttacks(settings: MinigameSettings): PickOption[] {
  const animal = isAnimal(settings.animal) ? settings.animal : 'bees';
  const tier = settings.tier === 2 || settings.tier === 3 ? settings.tier : 1;
  const choices = attackChoices(animal, tier, settings.ideas !== 'off');
  return [
    { id: 'all', label: 'All' },
    ...choices.map((c) => ({
      id: c.id,
      label: `${c.name}${c.claudesIdea ? ' · Claude’s idea' : ''}${c.unlocked ? '' : ` · from Tier ${ROMAN_TIER[c.from]}`}`,
      disabled: !c.unlocked,
    })),
  ];
}

const ROMAN_TIER = ['', 'I', 'II', 'III'];

/** Every attack any animal uses, once (so a remembered Attack is kept while the Animal changes). */
const ALL_DODGE_ATTACKS = [
  ...new Map(
    ANIMAL_IDS.flatMap((a) => attackChoices(a, 3, true)).map((c) => [
      c.id,
      { id: c.id, label: c.name },
    ]),
  ).values(),
];

export const DODGE: MinigameInfo = {
  id: 'dodge',
  name: 'Dodge',
  baseGame: 'Dodging',
  description: 'Dodge the animal’s attacks. The active hiker switches every few seconds.',
  status: 'ready',
  lineUp: true,
  settings: [
    {
      kind: 'pick',
      id: 'animal',
      label: 'Animal',
      options: ANIMAL_IDS.map((id) => ({ id, label: ANIMALS[id].name })),
      default: 'bees',
      menu: true,
    },
    {
      kind: 'pick',
      id: 'attack',
      label: 'Attack',
      options: [{ id: 'all', label: 'All' }, ...ALL_DODGE_ATTACKS],
      default: 'all',
      menu: true,
      optionsFor: dodgeAttacks,
      hint: 'All, or practice one attack at the chosen tier',
    },
    {
      kind: 'pick',
      id: 'ideas',
      label: 'Include Claude’s ideas',
      options: [
        { id: 'on', label: 'On' },
        { id: 'off', label: 'Off' },
      ],
      default: 'on',
    },
    {
      kind: 'pick',
      id: 'hitboxes',
      label: 'Show hitboxes',
      options: [
        { id: 'off', label: 'Off' },
        { id: 'on', label: 'On' },
      ],
      default: 'off',
    },
    TIER,
    HIKERS,
    autoRange('lives', 'Lives per hiker', 1, 3, DG.lives, ''),
    autoRange(
      'length',
      'Length',
      10,
      60,
      DG.tiers[1].lengthSec,
      ' s',
      5,
      `the tier's: ${DG.tiers[1].lengthSec}, ${DG.tiers[2].lengthSec} or ${DG.tiers[3].lengthSec} s; Stampede +${DG.stampede.extraSec} s`,
    ),
    autoRange('switch', 'Switch every', 3, 10, DG.switchSec, ' s'),
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
  TRAILDLE,
  FIND_OBJECT,
  REMEMBER_PATH,
  FIND_PATH,
  DODGE,
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
  return Object.fromEntries(
    info.settings.map((s) => [s.id, s.kind === 'autoRange' ? 'auto' : s.default]),
  );
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
  if (s.kind === 'autoRange') {
    if (value === 'auto' || typeof value !== 'number' || !Number.isFinite(value)) return 'auto';
    const step = s.step ?? 1;
    const snapped = s.min + Math.round((value - s.min) / step) * step;
    return Math.min(s.max, Math.max(s.min, snapped));
  }
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
