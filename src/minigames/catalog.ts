/**
 * Every minigame, as data (Phase 10.8). The puzzle games
 * (docs/design/11-minigames-puzzles.md and 13-minigames-puzzles-2.md) and
 * Dodge (docs/design/12-minigames-dodge.md) are playable; the rest are listed
 * on the testing tab as "coming soon". Each has a category, which the
 * testing tab groups them by. The UI pairs each playable one with its game
 * (src/ui/minigames/runners.tsx).
 */
import { BALANCE } from '../config/balance';
import { ANIMAL_IDS, ANIMALS, attackChoices, isAnimal, rankFor } from './dodge/animals';
import type { TileThing } from './endScreen';
import { VERSIONS as CROSSING_VERSIONS } from './crossing/logic';
import { TRAIL_TYPES } from './trails/course';
import { QUESTION_TYPES } from './safari/logic';
import { FINDS } from './sizeUp/logic';
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

const B = BALANCE.minigames;
const FO = BALANCE.minigames.findObject;

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
  hint?: string,
): MinigameSetting => ({
  kind: 'pick',
  id,
  label,
  options: [
    { id: 'auto', label: 'Auto' },
    ...options.map(([oid, olabel]) => ({ id: oid, label: olabel })),
  ],
  default: 'auto',
  ...(hint ? { hint } : {}),
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
  const choices = attackChoices(animal, rank, settings.ideas !== 'off', tier);
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
      hint: 'Auto uses the tier’s. Easy is for Bees, Squirrel Army and Ants (the others play 1)',
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
      id: 'motion',
      label: 'Portrait motion',
      options: [
        { id: 'on', label: 'On' },
        { id: 'off', label: 'Off' },
      ],
      default: 'on',
      hint: 'The blink, the float and the bob',
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
const MF = BALANCE.minigames.minefield;

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

/** Minefield's grid sizes (columns × rows). */
export const FIELD_SIZES: readonly (readonly [number, number])[] = [
  [6, 5],
  [7, 6],
  [8, 6],
  [9, 7],
  [10, 8],
  [11, 8],
  [12, 9],
];

/** Minefield, the Dog Waste Zone (23-minigames-final.md, section 6): Thin Ice's old game, reskinned. */
export const MINEFIELD: MinigameInfo = {
  id: 'minefield',
  name: 'Minefield',
  baseGame: 'Minesweeper',
  category: 'puzzle',
  description: 'Mow the grass without stepping in a pile. Numbers count the piles around.',
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
        ...FIELD_SIZES.map(([c, r]) => ({ id: `${c}x${r}`, label: `${c} × ${r}` })),
      ],
      default: 'auto',
      menu: true,
      hint: `Auto (${byTier((t) => `${MF.tiers[t].cols} × ${MF.tiers[t].rows}`)})`,
    },
    {
      kind: 'range',
      id: 'holesPerHiker',
      label: 'Holes per hiker',
      min: 0,
      max: 4,
      default: MF.holesPerHiker,
      hint: `On top of ${byTier((t) => MF.tiers[t].holes)}`,
    },
    autoRange(
      'timer',
      'Timer',
      60,
      300,
      180,
      ' s',
      10,
      `${byTier((t) => MF.tiers[t].timerSec ?? 'none')} s`,
      true,
    ),
  ],
};

// ── Thin Ice, the crossing (docs/design/23-minigames-final.md, section 7) ──

const TIC = BALANCE.minigames.thinIce;

export const THIN_ICE: MinigameInfo = {
  id: 'thinIce',
  name: 'Thin Ice',
  baseGame: 'Minesweeper crossing',
  category: 'puzzle',
  description:
    'Cross the ice one at a time. Numbers count the holes around; the ice cracks behind each hiker.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    autoRange(
      'picks',
      'Picks',
      0,
      5,
      TIC.tiers[1].picks,
      '',
      1,
      byTier((t) => TIC.tiers[t].picks),
    ),
    autoRange('time', 'Time per hiker', 20, 180, 60, ' s', 10, 'no clock', true),
    {
      kind: 'pick',
      id: 'showHoles',
      label: 'Show the holes',
      options: [
        { id: 'off', label: 'Off' },
        { id: 'on', label: 'On' },
      ],
      default: 'off',
      hint: 'A faint ring on each hidden hole (testing)',
    },
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
  settings: [TIER, HIKERS, override('skunks', 'Skunks', ON_OFF)],
};

// ── New challenges, step 2: the lane games (docs/design/17-minigames-lanes.md) ──

const CR = BALANCE.minigames.crossing;
const TR = BALANCE.minigames.train;
const RF = BALANCE.minigames.rafting;

export const CROSSING: MinigameInfo = {
  id: 'crossing',
  name: 'Crossing',
  baseGame: 'Frogger',
  category: 'move',
  description:
    'Hop across the lanes one hiker at a time. A hit sends you back to the end of the line.',
  status: 'ready',
  lineUp: true,
  settings: [
    {
      kind: 'pick',
      id: 'version',
      label: 'Version',
      options: CROSSING_VERSIONS.map((v) => ({
        id: v.id,
        label: v.id === 'mixed' ? 'Mixed' : v.name,
      })),
      default: 'road',
      hint: 'Mixed (road, a bank, then river) needs Tier III; below it, Road plays',
    },
    TIER,
    HIKERS,
    autoRange(
      'lives',
      'Lives',
      1,
      3,
      CR.tiers[1].lives,
      '',
      1,
      byTier((t) => CR.tiers[t].lives),
    ),
    autoRange(
      'time',
      'Time per attempt',
      10,
      40,
      CR.tiers[1].attemptSec,
      ' s',
      1,
      `${byTier((t) => CR.tiers[t].attemptSec)} s`,
    ),
  ],
};

export const TRAIN: MinigameInfo = {
  id: 'train',
  name: 'Train!',
  baseGame: 'Dodging',
  category: 'move',
  description: 'Hop between the tracks as trains come through. Watch for the headlights.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    autoRange('lives', 'Lives', 1, 3, TR.tiers[1].lives, ''),
    autoRange(
      'survive',
      'Survive',
      10,
      60,
      TR.tiers[1].surviveSec,
      ' s',
      5,
      `${byTier((t) => TR.tiers[t].surviveSec)} s`,
    ),
    {
      kind: 'pick',
      id: 'fog',
      label: 'Fog',
      options: [
        { id: 'auto', label: 'Auto' },
        { id: 'on', label: 'On' },
        { id: 'off', label: 'Off' },
      ],
      default: 'auto',
      hint: 'Auto: on at Tiers IV and V',
    },
  ],
};

export const RAFTING: MinigameInfo = {
  id: 'rafting',
  name: 'Rafting',
  baseGame: 'Dodging',
  category: 'move',
  description: 'Steer the party’s raft upriver to the dock. Miss the rocks; rapids speed you up.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    autoRange(
      'distance',
      'Distance',
      600,
      3000,
      RF.tiers[1].distance,
      '',
      100,
      byTier((t) => RF.tiers[t].distance),
    ),
  ],
};

// ── New challenges, step 3: the quick games (docs/design/18-minigames-quick.md) ──

const TBZ = BALANCE.minigames.trailBlazes;
const FC = BALANCE.minigames.fireflyCatch;
const SZ = BALANCE.minigames.sizeUp;
const FSW = BALANCE.minigames.flySwatter;
const RSH = BALANCE.minigames.raccoonShuffle;

/** An Off/On switch for a tuning helper. */
const helper = (
  id: string,
  label: string,
  hint: string,
  start: 'on' | 'off' = 'off',
): MinigameSetting => ({
  kind: 'pick',
  id,
  label,
  options: [
    { id: 'off', label: 'Off' },
    { id: 'on', label: 'On' },
  ],
  default: start,
  hint,
});

export const TRAIL_BLAZES: MinigameInfo = {
  id: 'trailBlazes',
  name: 'Trail Blazes',
  baseGame: 'Timing',
  category: 'reaction',
  description: 'Tap when the two lit blazes are level. One hiker at a time.',
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
        { id: 'tries', label: 'Tries' },
        { id: 'clock', label: 'Clock' },
      ],
      default: 'tries',
      hint: `Clock: a miss costs ${TBZ.missCostSec} s`,
    },
    autoRange('tries', 'Tries', 1, 5, TBZ.tiers[1].tries, ''),
  ],
};

export const FIREFLY_CATCH: MinigameInfo = {
  id: 'fireflyCatch',
  name: 'Firefly Catch',
  baseGame: 'Timing',
  category: 'reaction',
  description: 'Tap when the firefly is inside your jar ring. One hiker at a time.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    autoRange('catches', 'Catches', 1, 6, FC.tiers[1].catches, ''),
    autoRange('time', 'Time', 5, 30, FC.tiers[1].timeSec, ' s'),
  ],
};

export const SIZE_UP: MinigameInfo = {
  id: 'sizeUp',
  name: 'Size Up',
  baseGame: 'Matching',
  category: 'reaction',
  description: 'Grow or shrink the find to match the field guide. One try each.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    {
      kind: 'pick',
      id: 'find',
      label: 'Find',
      options: [
        { id: 'random', label: 'Random' },
        ...FINDS.map((f) => ({ id: f.id, label: f.name })),
      ],
      default: 'random',
      hint: 'Random: four finds at Tiers I and II, all six from III',
    },
    autoRange(
      'time',
      'Time',
      4,
      20,
      SZ.tiers[1].timeSec,
      ' s',
      1,
      `${byTier((t) => SZ.tiers[t].timeSec)} s`,
    ),
    helper('live', 'Show % live', 'Shows how far off you are while playing, for tuning'),
  ],
};

export const FLY_SWATTER: MinigameInfo = {
  id: 'flySwatter',
  name: 'Fly Swatter',
  baseGame: 'Reaction',
  category: 'reaction',
  description: 'Swat each circle before the fly lands. Leave the bees alone.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    override('bees', 'Bees', ON_OFF, 'Auto: from Tier III'),
    autoRange('strikes', 'Strikes', 1, 5, FSW.tiers[1].strikes, ''),
  ],
};

export const SAFARI: MinigameInfo = {
  id: 'safari',
  name: 'Safari',
  baseGame: 'Memory',
  category: 'memory',
  description: 'Watch the animals come down the hill, then answer together.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    {
      kind: 'pick',
      id: 'version',
      label: 'Version',
      options: [
        { id: 'auto', label: 'Auto' },
        { id: 'day', label: 'Day' },
        { id: 'night', label: 'Night' },
        { id: 'fog', label: 'Fog' },
      ],
      default: 'auto',
      hint: 'Auto: night can come from Tier III, fog from Tier IV',
    },
    {
      kind: 'pick',
      id: 'questions',
      label: 'Questions',
      options: [
        { id: 'auto', label: 'Auto' },
        { id: '1', label: '1' },
        { id: '2', label: '2' },
      ],
      default: 'auto',
      hint: 'Auto: 2 with 3 or more hikers',
    },
    {
      kind: 'pick',
      id: 'bigfoot',
      label: 'Bigfoot',
      options: [
        { id: 'auto', label: 'Auto' },
        { id: 'always', label: 'Always' },
        { id: 'never', label: 'Never' },
      ],
      default: 'auto',
      hint: 'Auto: rare from Tier III',
    },
    {
      kind: 'pick',
      id: 'question',
      label: 'Question',
      options: [
        { id: 'random', label: 'Random' },
        ...QUESTION_TYPES.map((t) => ({ id: t.id, label: t.label })),
      ],
      default: 'random',
      menu: true,
      hint: 'One type every time (the run is planned to fit it)',
    },
    helper('answer', 'Show answer', 'Shows the counts in a corner, for tuning'),
  ],
};

export const RACCOON_SHUFFLE: MinigameInfo = {
  id: 'raccoonShuffle',
  name: 'Raccoon Shuffle',
  baseGame: 'Shell game',
  category: 'luck',
  description: 'Watch which bins hold raccoons, follow the shuffle, and pick an empty one.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    override(
      'night',
      'Night',
      ON_OFF,
      `Auto: a ${RSH.tiers[4].night * 100}% chance at Tiers IV and V`,
    ),
    helper('empties', 'Show the empty bins', 'Marks them through the shuffle, for tuning'),
  ],
};

// ── New challenges, step 3 (part 2): signs and trails (docs/design/19-minigames-signs-trails.md) ──

const FKS = BALANCE.minigames.fakeSigns;
const TRL = BALANCE.minigames.trails;
const CRX = BALANCE.minigames.crossroads;
const RCL = BALANCE.minigames.rockClimb;

/** A number setting that can be switched off ("Off", or a value), with no Auto. */
const offRange = (
  id: string,
  label: string,
  min: number,
  max: number,
  unit: string,
): MinigameSetting => ({
  kind: 'autoRange',
  id,
  label,
  min,
  max,
  autoValue: 0,
  hint: `Off, or ${min} to ${max}${unit}`,
  off: true,
});

export const FAKE_SIGNS: MinigameInfo = {
  id: 'fakeSigns',
  name: 'Fake Trail Signs',
  baseGame: 'Logic',
  category: 'puzzle',
  description: 'Learn the rules, then call each trail sign REAL or FAKE. Every round adds a rule.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    autoRange(
      'signs',
      'Signs per round',
      1,
      6,
      FKS.tiers[1].signs,
      '',
      1,
      byTier((t) => FKS.tiers[t].signs),
    ),
    autoRange(
      'cap',
      'Most rules',
      2,
      8,
      FKS.tiers[1].cap,
      '',
      1,
      byTier((t) => FKS.tiers[t].cap),
    ),
    {
      kind: 'pick',
      id: 'showOld',
      label: 'Show old rules',
      options: [
        { id: 'auto', label: 'Auto' },
        { id: 'always', label: 'Always' },
        { id: 'never', label: 'Never' },
      ],
      default: 'auto',
      hint: 'Auto: hidden at Tiers IV and V (they still count)',
    },
    offRange('time', 'Time per sign', 5, 20, ' s'),
    helper('answers', 'Show answers', 'Marks each sign REAL or FAKE in a corner, for tuning'),
  ],
};

export const TRAILS: MinigameInfo = {
  id: 'trails',
  name: 'Trails',
  baseGame: 'Steering',
  category: 'move',
  description:
    'Stay on the trail as it comes down the screen. Each hiker has a checkpoint to reach.',
  status: 'ready',
  lineUp: true,
  settings: [
    {
      kind: 'pick',
      id: 'type',
      label: 'Type',
      options: TRAIL_TYPES.map((t) => ({ id: t.id, label: t.name })),
      default: 'forest',
    },
    TIER,
    HIKERS,
    autoRange(
      'bar',
      'Bar',
      1,
      5,
      TRL.tiers[1].barSec,
      ' s',
      0.25,
      `${byTier((t) => TRL.tiers[t].barSec)} s`,
    ),
    autoRange(
      'section',
      'Section length',
      200,
      1500,
      TRL.tiers[1].section,
      '',
      100,
      byTier((t) => TRL.tiers[t].section),
    ),
    helper('gusts', 'Gusts', 'Ridgeline only: wind that pushes you sideways', 'on'),
    helper('scree', 'Scree', 'Ridgeline only: loose rock where steering slides', 'on'),
    helper('knives', 'Knife edges', 'Ridgeline only: stretches where the ridge pinches', 'on'),
  ],
};

export const CROSSROADS: MinigameInfo = {
  id: 'crossroads',
  name: 'Crossroads',
  baseGame: 'Memory',
  category: 'memory',
  description: 'Remember the arrows, then walk them through the trail crossings.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    autoRange(
      'arrows',
      'Arrows',
      3,
      12,
      CRX.arrows[1],
      '',
      1,
      byTier((t) => CRX.arrows[t]),
    ),
    {
      kind: 'autoRange',
      id: 'study',
      label: 'Study time',
      min: 5,
      max: 20,
      autoValue: 0,
      hint: 'No limit, or 5 to 20 s',
      off: true,
    },
    {
      kind: 'pick',
      id: 'newArrows',
      label: 'New arrows per hiker',
      options: [
        { id: 'off', label: 'Off' },
        { id: 'on', label: 'On' },
      ],
      default: 'off',
    },
    offRange('turn', 'Time per turn', 2, 6, ' s'),
  ],
};

export const ROCK_CLIMB: MinigameInfo = {
  id: 'rockClimb',
  name: 'Rock Climb',
  baseGame: 'Jumping',
  category: 'move',
  description: 'Aim, hold for power, jump, and grab a hold in the active hand’s color.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    // Up to 6 here, so the uneven 5 and 6 can be tried. TODO(wyatt): not handled yet.
    { ...HIKERS, max: 6 },
    autoRange(
      'holds',
      'Holds to the top',
      4,
      24,
      RCL.tiers[1].holds,
      '',
      1,
      byTier((t) => RCL.tiers[t].holds),
    ),
    // No timer in runs (22-minigame-revisions.md, section 2.1): the tries are the limit.
    autoRange('time', 'Time', 20, 120, RCL.testTimeSec, ' s', 5, 'no timer'),
    autoRange('triesEach', 'Tries each', 1, 5, RCL.tries, '', 1),
    {
      kind: 'pick',
      id: 'tries',
      label: 'Grab tries',
      options: [
        { id: 'auto', label: 'Auto' },
        { id: 'one', label: 'One' },
        { id: 'any', label: 'Any' },
      ],
      default: 'auto',
      hint: 'Auto: any at Tiers I and II, one from Tier III',
    },
    {
      kind: 'pick',
      id: 'reach',
      label: 'Show reach',
      options: [
        { id: 'on', label: 'On' },
        { id: 'off', label: 'Off' },
      ],
      default: 'on',
      hint: 'The reach circle and rings on holds the jump can grab',
    },
  ],
  note: (settings) => {
    const n = Array.isArray(settings.hikers) ? settings.hikers.length : 0;
    return n >= 5
      ? `With ${n} hikers the color sequence can’t give everyone the same number of turns. Wyatt hasn’t decided how to handle 5 or 6 yet.`
      : null;
  },
};

// ── Sketchy Bridge (docs/design/23-minigames-final.md, section 1) ──

const SKB = BALANCE.minigames.sketchyBridge;

export const SKETCHY_BRIDGE: MinigameInfo = {
  id: 'sketchyBridge',
  name: 'Sketchy Bridge',
  baseGame: 'Balance bar',
  category: 'move',
  description:
    'Hold to keep each hiker in the zone as they cross. Outside it, the bridge weakens, and it never recovers.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    autoRange('bridge', 'Bridge', 40, 160, SKB.integrity, '', 10),
    {
      kind: 'pick',
      id: 'showTarget',
      label: 'Show the icon’s target',
      options: [
        { id: 'off', label: 'Off' },
        { id: 'on', label: 'On' },
      ],
      default: 'off',
      hint: 'A red line where the icon is heading (testing)',
    },
  ],
};

// ── Camp Cleanup (docs/design/21-minigames-dodge-camp.md, section 4) ──

const CC = BALANCE.minigames.campCleanup;

export const CAMP_CLEANUP: MinigameInfo = {
  id: 'campCleanup',
  name: 'Camp Cleanup',
  baseGame: 'Snake',
  category: 'move',
  description: 'Steer the party in one long line. Grab trash in your color; each piece adds a bag.',
  status: 'ready',
  lineUp: true,
  settings: [
    TIER,
    HIKERS,
    autoRange(
      'time',
      'Time',
      30,
      120,
      CC.tiers[1].timeSec,
      ' s',
      5,
      `${byTier((t) => CC.tiers[t].timeSec)} s`,
    ),
    autoRange(
      'bags',
      'Bags each',
      1,
      8,
      CC.tiers[1].quota,
      '',
      1,
      byTier((t) => CC.tiers[t].quota),
    ),
    autoRange(
      'speed',
      'Speed',
      3,
      12,
      CC.tiers[1].speed,
      ' cells a second',
      1,
      `${byTier((t) => CC.tiers[t].speed)} cells a second`,
    ),
    override(
      'obstacles',
      'Obstacles',
      [
        ['off', 'Off'],
        ['on', 'On'],
      ],
      'Auto: from Tier III',
    ),
  ],
};

export const MINIGAMES: readonly MinigameInfo[] = [
  DODGE,
  CROSSING,
  TRAIN,
  RAFTING,
  TRAILS,
  ROCK_CLIMB,
  CAMP_CLEANUP,
  SKETCHY_BRIDGE,
  TRAILDLE,
  FIND_PATH,
  FAKE_SIGNS,
  TRAIL_MAP,
  PICTURE_PUZZLE,
  MINEFIELD,
  THIN_ICE,
  REMEMBER_PATH,
  MEMORY,
  SAFARI,
  CROSSROADS,
  FIND_OBJECT,
  TRAIL_BLOCKS,
  SLEEPING_BEAR,
  WHACKOON,
  TRAIL_BLAZES,
  FIREFLY_CATCH,
  SIZE_UP,
  FLY_SWATTER,
  RACCOON_SHUFFLE,
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

/** What stands on the tile for each Crossing version, for the end screen's tile line. */
const CROSSING_THINGS: Readonly<Record<string, TileThing>> = {
  road: { name: 'traffic' },
  river: { name: 'river' },
  critter: { name: 'critters', plural: true },
  mixed: { name: 'crossing' },
};

/** What stands on the tile for each Trail Block, for the end screen's tile line. */
const TRAIL_BLOCK_THINGS: Readonly<Record<string, TileThing>> = {
  chop: { name: 'tree' },
  rockslide: { name: 'rockslide' },
  river: { name: 'flood' },
  animals: { name: 'animals', plural: true },
};

/**
 * What the end screen says about a game (16-challenge-end-screen.md): its
 * name (the version or the animal where there is one) and tier, "CHOP TREE ·
 * TIER II", and what stands on the tile for a passing challenge.
 */
export function endInfo(
  info: MinigameInfo,
  settings: MinigameSettings,
): { subtitle: string; thing: TileThing } {
  let name = info.name;
  let thing: TileThing = { name: info.name };
  if (info.id === 'trailBlocks') {
    const v =
      TRAIL_BLOCK_VERSIONS.find((x) => x.id === settings.version) ?? TRAIL_BLOCK_VERSIONS[0]!;
    name = v.name;
    thing = TRAIL_BLOCK_THINGS[v.id] ?? thing;
  }
  if (info.id === 'dodge')
    name = ANIMALS[isAnimal(settings.animal) ? settings.animal : 'bees'].name;
  if (info.id === 'sleepingBear') thing = { name: 'bear' };
  if (info.id === 'crossing') {
    const v = CROSSING_VERSIONS.find((x) => x.id === settings.version) ?? CROSSING_VERSIONS[0]!;
    name = v.id === 'mixed' ? 'Road and River Crossing' : v.name;
    thing = CROSSING_THINGS[v.id] ?? thing;
  }
  if (info.id === 'train') thing = { name: 'trains', plural: true };
  if (info.id === 'trails') {
    const t = TRAIL_TYPES.find((x) => x.id === settings.type) ?? TRAIL_TYPES[0]!;
    name = t.name;
    thing = { name: 'trail' };
  }
  if (info.id === 'rockClimb') thing = { name: 'wall' };
  if (info.id === 'rafting') thing = { name: 'rapids', plural: true };
  if (info.id === 'campCleanup') thing = { name: 'campsite' };
  const tier = isTier(settings.tier) ? ` · Tier ${TIER_LABELS[settings.tier]}` : '';
  return { subtitle: `${name}${tier}`.toUpperCase(), thing };
}
