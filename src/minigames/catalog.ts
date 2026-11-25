/**
 * Every minigame, as data (Phase 10.8). Bearrels, the puzzle games
 * (docs/design/11-minigames-puzzles.md and 13-minigames-puzzles-2.md) and
 * Dodge (docs/design/12-minigames-dodge.md) are playable; the rest are listed
 * on the testing tab as "coming soon". Each has a category, which the
 * testing tab groups them by. The UI pairs each playable one with its game
 * (src/ui/minigames/runners.tsx).
 */
import { BALANCE } from '../config/balance';
import { ART_STYLES } from './bearrels/styles';
import { ANIMAL_IDS, ANIMALS, attackChoices, isAnimal, rankFor } from './dodge/animals';
import { VERSIONS as TRAIL_BLOCK_VERSIONS } from './trailBlocks/logic';
import {
  CATEGORIES,
  isTier,
  TIER_LABELS,
  TIERS,
  type MinigameInfo,
  type MinigameSetting,
  type MinigameSettings,
  type MinigameSettingValue,
  type PickOption,
  type Tier,
} from './types';

const B = BALANCE.minigames.bearrels;
const FO = BALANCE.minigames.findObject;

export const BEARRELS: MinigameInfo = {
  id: 'bearrels',
  name: 'Bearrels',
  baseGame: 'Barrels',
  category: 'luck',
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

/** Tier I to V (15-challenge-tiers.md): every game's main setting. IV and V are harder versions of III. */
const TIER: MinigameSetting = {
  kind: 'choice',
  id: 'tier',
  label: 'Tier',
  options: [...TIERS],
  labels: TIERS.map((t) => TIER_LABELS[t]),
  default: 1,
  hint: 'Harder each tier. IV and V are harder versions of III',
};

/** "the tier's: 20, 25, 30, 30 or 35" (a value for each tier, for a setting's hint). */
const byTier = (f: (t: Tier) => string | number) =>
  `the tier's: ${TIERS.slice(0, -1).map(f).join(', ')} or ${f(5)}`;

const HIKERS: MinigameSetting = {
  kind: 'hikers',
  id: 'hikers',
  label: 'Hikers',
  min: B.hikers.min,
  max: B.hikers.max,
  default: B.hikers.default,
};

/** A number setting that can also be "Auto" (the tier's or default value), and "Off" when `off`. */
const autoRange = (
  id: string,
  label: string,
  min: number,
  max: number,
  autoValue: number,
  unit: string,
  step = 1,
  autoHint?: string,
  off = false,
): MinigameSetting => ({
  kind: 'autoRange',
  id,
  label,
  min,
  max,
  step,
  autoValue,
  hint: `Auto (${autoHint ?? `${autoValue}${unit}`}), ${off ? 'Off, ' : ''}or ${min} to ${max}${unit}`,
  ...(off ? { off: true } : {}),
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
  category: 'puzzle',
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
  category: 'search',
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
    autoRange('rounds', 'Rounds', 1, 5, FO.rounds, ''),
    autoRange(
      'secPerTarget',
      'Seconds per target',
      1,
      8,
      FO.secPerTarget,
      ' s',
      1,
      `${byTier((t) => FO.tiers[t].secPerTarget)} s`,
    ),
    autoRange(
      'extraSec',
      'Extra seconds per round',
      0,
      20,
      FO.extraSecPerRound,
      ' s',
      1,
      `${byTier((t) => FO.tiers[t].extraSecPerRound)} s`,
    ),
  ],
};

export const REMEMBER_PATH: MinigameInfo = {
  id: 'rememberPath',
  name: 'Remember the Path',
  baseGame: 'Memory',
  category: 'memory',
  description: 'Watch the ranger walk the trail, then walk it from memory.',
  status: 'ready',
  lineUp: true,
  settings: [TIER, HIKERS],
};

export const FIND_PATH: MinigameInfo = {
  id: 'findPath',
  name: 'Find the Path',
  baseGame: 'Minefield',
  category: 'puzzle',
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

/** The Level setting's value: Auto, Easy, or a numbered level. */
export function dodgeLevelPick(settings: MinigameSettings): 'auto' | 'easy' | 1 | 2 | 3 {
  const v = settings.level;
  return v === 'easy' ? 'easy' : v === '1' ? 1 : v === '2' ? 2 : v === '3' ? 3 : 'auto';
}

/**
 * Dodge's attacks for the Attack picker: All, then each one the animal uses
 * (greyed out, with where it plays, when it doesn't play at the level the
 * tier and the Level setting give).
 */
function dodgeAttacks(settings: MinigameSettings): PickOption[] {
  const animal = isAnimal(settings.animal) ? settings.animal : 'bees';
  const tier = isTier(settings.tier) ? settings.tier : 1;
  const rank = rankFor(animal, tier, dodgeLevelPick(settings));
  const choices = attackChoices(animal, rank, settings.ideas !== 'off');
  return [
    { id: 'all', label: 'All' },
    ...choices.map((c) => ({
      id: c.id,
      label: `${c.name}${c.claudesIdea ? ' · Claude’s idea' : ''}${c.unlocked ? '' : ` · ${c.where}`}`,
      disabled: !c.unlocked,
    })),
  ];
}

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
  category: 'move',
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
      hint: 'All, or practice one attack at the chosen level',
    },
    {
      kind: 'pick',
      id: 'overlaps',
      label: 'Overlaps',
      options: [
        { id: 'auto', label: 'Auto' },
        { id: 'off', label: 'Off' },
        { id: 'on', label: 'On' },
      ],
      default: 'auto',
      hint: 'Auto: on at Tier V only. With one attack picked, attacks never overlap',
    },
    {
      kind: 'pick',
      id: 'level',
      label: 'Level',
      options: [
        { id: 'auto', label: 'Auto' },
        { id: 'easy', label: 'Easy' },
        { id: '1', label: '1' },
        { id: '2', label: '2' },
        { id: '3', label: '3' },
      ],
      default: 'auto',
      hint: 'Auto uses the tier’s. Easy is for Bees and Squirrel Army (the others play 1)',
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
    {
      kind: 'pick',
      id: 'portrait',
      label: 'Portrait style',
      options: [
        { id: 'solid', label: 'Solid' },
        { id: 'solidRed', label: 'Solid + red' },
      ],
      default: 'solid',
      hint: 'P switches it while playing',
    },
    {
      kind: 'pick',
      id: 'motion',
      label: 'Portrait motion',
      options: [
        { id: 'on', label: 'On' },
        { id: 'off', label: 'Off' },
      ],
      default: 'on',
      hint: 'The blink and the bob',
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
      `${byTier((t) => DG.tiers[t].lengthSec)} s; Stampede +${DG.stampede.extraSec} s; Woods Monster ${DG.monster.lengthSec} s`,
    ),
    autoRange('switch', 'Switch every', 3, 10, DG.switchSec, ' s'),
  ],
};

// ── The third batch (docs/design/13-minigames-puzzles-2.md) ────────────────

const TM = BALANCE.minigames.trailMap;
const ME = BALANCE.minigames.memory;
const PP = BALANCE.minigames.picturePuzzle;
const TI = BALANCE.minigames.thinIce;

/** Picture Puzzle's photos, by name, for the Picture setting. */
const PICTURE_NAMES: Readonly<Record<(typeof PP.pictures)[number], string>> = {
  'lake-island': 'Lake island',
  'mountain-lake': 'Mountain lake',
  'green-valley': 'Green valley',
  'foggy-forest': 'Foggy forest',
  'canyon-trail': 'Canyon trail',
  'rocky-butte': 'Rocky butte',
};

export const TRAIL_MAP: MinigameInfo = {
  id: 'trailMap',
  name: 'Trail Map',
  baseGame: 'Puzzle',
  category: 'puzzle',
  description: 'Turn the trail tiles to connect every trailhead and sign to the exit at once.',
  status: 'ready',
  settings: [
    TIER,
    HIKERS,
    autoRange(
      'grid',
      'Grid',
      4,
      7,
      TM.tiers[1].size,
      '',
      1,
      byTier((t) => TM.tiers[t].size),
    ),
    autoRange(
      'time',
      'Time',
      20,
      180,
      TM.tiers[1].timeSec,
      ' s',
      5,
      `${byTier((t) => TM.tiers[t].timeSec)} s, +${TM.extraSecPerHiker} s per extra hiker`,
      true,
    ),
    autoRange(
      'signs',
      'Signs',
      0,
      3,
      TM.tiers[1].signs,
      '',
      1,
      byTier((t) => TM.tiers[t].signs),
    ),
  ],
};

export const MEMORY: MinigameInfo = {
  id: 'memory',
  name: 'Memory Puzzle',
  baseGame: 'Memory',
  category: 'memory',
  description: 'Flip cards to match the snacks. Each hiker’s sets are in their color.',
  status: 'ready',
  settings: [
    TIER,
    HIKERS,
    override('match', 'Match', [
      ['pairs', 'Pairs'],
      ['threes', 'Threes'],
    ]),
    autoRange(
      'preview',
      'Preview',
      0.5,
      5,
      ME.tiers[1].previewSec,
      ' s',
      0.5,
      `${byTier((t) => ME.tiers[t].previewSec)} s`,
    ),
    override('swaps', 'Swaps', ON_OFF),
    autoRange(
      'time',
      'Time',
      20,
      180,
      ME.tiers[1].timeSec,
      ' s',
      5,
      `${byTier((t) => ME.tiers[t].timeSec)} s`,
    ),
    autoRange(
      'matchBonus',
      'Match bonus',
      0,
      10,
      ME.tiers[1].matchSec,
      ' s',
      1,
      `${byTier((t) => ME.tiers[t].matchSec)} s`,
    ),
    autoRange(
      'missCost',
      'Miss cost',
      0,
      10,
      ME.tiers[1].missSec,
      ' s',
      1,
      `${byTier((t) => ME.tiers[t].missSec)} s`,
    ),
  ],
};

export const PICTURE_PUZZLE: MinigameInfo = {
  id: 'picturePuzzle',
  name: 'Picture Puzzle',
  baseGame: 'Puzzle',
  category: 'puzzle',
  description: 'Rebuild the picture from the piles. Two hikers share one tray.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    override('grid', 'Grid', [
      ['4', '4 × 4'],
      ['5', '5 × 5'],
      ['6', '6 × 6'],
    ]),
    override('thumbnail', 'Thumbnail', ON_OFF),
    autoRange(
      'secPerPiece',
      'Seconds per piece',
      1,
      6,
      PP.tiers[1].secPerPiece,
      ' s',
      0.5,
      `${byTier((t) => PP.tiers[t].secPerPiece)} s`,
    ),
    autoRange(
      'rightSpot',
      'Right-spot bonus',
      0,
      5,
      PP.tiers[1].rightSpotSec,
      ' s',
      0.5,
      `${byTier((t) => PP.tiers[t].rightSpotSec)} s`,
    ),
    {
      kind: 'pick',
      id: 'picture',
      label: 'Picture',
      options: [
        { id: 'random', label: 'Random' },
        ...PP.pictures.map((p) => ({ id: p, label: PICTURE_NAMES[p] })),
      ],
      default: 'random',
      menu: true,
      hint: 'The first hiker’s picture; a second one is always different',
    },
  ],
};

/** Thin Ice's grid sizes (columns × rows). */
export const ICE_SIZES: readonly (readonly [number, number])[] = [
  [6, 5],
  [7, 6],
  [8, 6],
  [9, 7],
  [10, 8],
  [11, 8],
  [12, 9],
];

export const THIN_ICE: MinigameInfo = {
  id: 'thinIce',
  name: 'Thin Ice',
  baseGame: 'Minefield',
  category: 'puzzle',
  description: 'Check the ice without falling in. Numbers count the holes around.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    {
      kind: 'pick',
      id: 'grid',
      label: 'Grid',
      options: [
        { id: 'auto', label: 'Auto' },
        ...ICE_SIZES.map(([c, r]) => ({ id: `${c}x${r}`, label: `${c} × ${r}` })),
      ],
      default: 'auto',
      menu: true,
      hint: `Auto (${byTier((t) => `${TI.tiers[t].cols} × ${TI.tiers[t].rows}`)})`,
    },
    {
      kind: 'range',
      id: 'holesPerHiker',
      label: 'Holes per hiker',
      min: 0,
      max: 4,
      default: TI.holesPerHiker,
      hint: `On top of ${byTier((t) => TI.tiers[t].holes)}`,
    },
    autoRange(
      'timer',
      'Timer',
      60,
      300,
      180,
      ' s',
      10,
      `${byTier((t) => TI.tiers[t].timerSec ?? 'none')} s`,
      true,
    ),
  ],
};

// ── New challenges, step 1 (docs/design/14-minigames-trail-blocks.md) ───────

export const TRAIL_BLOCKS: MinigameInfo = {
  id: 'trailBlocks',
  name: 'Trail Blocks',
  baseGame: 'Timing',
  category: 'reaction',
  description:
    'Clear the trail together: time each swing. Energy comes out of each hiker’s chunk in line order.',
  status: 'ready',
  lineUp: true,
  settings: [
    {
      kind: 'pick',
      id: 'version',
      label: 'Version',
      options: TRAIL_BLOCK_VERSIONS.map((v) => ({ id: v.id, label: v.name })),
      default: 'chop',
    },
    TIER,
    HIKERS,
    {
      kind: 'pick',
      id: 'quality',
      label: 'Show hit quality',
      options: [
        { id: 'off', label: 'Off' },
        { id: 'on', label: 'On' },
      ],
      default: 'off',
      hint: 'Floats each swing’s work, for tuning',
    },
  ],
};

export const SLEEPING_BEAR: MinigameInfo = {
  id: 'sleepingBear',
  name: 'Sleeping Bear',
  baseGame: 'Timing',
  category: 'reaction',
  description: 'Sneak past the sleeping bear one at a time. Freeze when he wakes.',
  status: 'ready',
  lineUp: true,
  settings: [TIER, HIKERS, override('fakeOuts', 'Fake-outs', ON_OFF)],
};

export const WHACKOON: MinigameInfo = {
  id: 'whackoon',
  name: 'Whackoon',
  baseGame: 'Reaction',
  category: 'reaction',
  description: 'Whack the raccoons in your color. Leave the skunks alone.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    {
      kind: 'pick',
      id: 'mode',
      label: 'Mode',
      options: [
        { id: 'colors', label: 'Colors' },
        { id: 'turns', label: 'Turns' },
      ],
      default: 'colors',
      hint: 'Colors: each hiker whacks their own color. Turns: one at a time',
    },
    override('skunks', 'Skunks', ON_OFF),
  ],
};

const soon = (
  id: string,
  name: string,
  baseGame: string,
  category: MinigameInfo['category'],
): MinigameInfo => ({
  id,
  name,
  baseGame,
  category,
  description: '',
  status: 'soon',
  settings: [],
});

export const MINIGAMES: readonly MinigameInfo[] = [
  DODGE,
  soon('antsAreMarching', 'Ants Are Marching', 'Snake', 'move'),
  soon('crackedBridge', 'Cracked Bridge', 'Platformer', 'move'),
  TRAILDLE,
  FIND_PATH,
  TRAIL_MAP,
  PICTURE_PUZZLE,
  THIN_ICE,
  REMEMBER_PATH,
  MEMORY,
  FIND_OBJECT,
  TRAIL_BLOCKS,
  SLEEPING_BEAR,
  WHACKOON,
  soon('flySwatter', 'Fly Swatter', 'Reaction', 'reaction'),
  BEARRELS,
];

/** The testing tab's list: each category with its games, in order (empty ones left out). */
export const MINIGAMES_BY_CATEGORY = CATEGORIES.map((c) => ({
  ...c,
  games: MINIGAMES.filter((m) => m.category === c.id),
})).filter((c) => c.games.length > 0);

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
    if (value === 'off' && s.off) return 'off';
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
