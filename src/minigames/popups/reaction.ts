/**
 * The pop-up content for Reaction and timing, and Guess and luck
 * (docs/design/20-challenge-popup.md, section 7): Trail Blocks, Sleeping
 * Bear, Whackoon, Trail Blazes, Firefly Catch, Size Up, Fly Swatter and
 * Raccoon Shuffle.
 */
import { BALANCE } from '../../config/balance';
import { FOOD, item, prepNumber, res } from '../prepare';
import { newRaccoonShuffle } from '../raccoonShuffle/logic';
import { VERSIONS as BLOCK_VERSIONS } from '../trailBlocks/logic';
import type { MinigameSettings } from '../types';
import {
  countBar,
  FAIL_ENERGY,
  FAIL_PASSING,
  key,
  levelBar,
  numOr,
  OR,
  P_,
  row,
  seconds,
  tapRow,
  tierIn,
  timeBar,
  mouse,
  finger,
} from './common';
import type { Bar, GamePopup } from './types';

const MG = BALANCE.minigames;
const PR = MG.prepare;

const hikerCount = (s: MinigameSettings) => (Array.isArray(s.hikers) ? s.hikers.length : 3);

/** A level bar for something bigger being easier: high at Tier I, low at Tier V; Prepare adds. */
function sizeBar(id: string, label: string, s: MinigameSettings, change: number): Bar {
  const base = PR.levels + 1 - Math.min(PR.levels, tierIn(s) + PR.levelFromTier);
  return {
    id,
    label,
    kind: 'level',
    base,
    value: Math.min(PR.levels, base + change),
    max: PR.levels,
  };
}

const slower = (label: string) =>
  row('slower', label, '−1 speed each', FOOD, { param: P_('slower'), step: 1 }, { slots: 2 });
const plusSec = (sec: number) =>
  row(
    'extraSec',
    `+${sec} S`,
    `+${sec} seconds each`,
    FOOD,
    { param: P_('extraSec'), step: sec },
    { slots: 2 },
  );

// ── Raccoon Shuffle ────────────────────────────────────────────────────────

const RS = MG.raccoonShuffle;

export const RACCOON_SHUFFLE_POPUP: GamePopup = {
  howToPlay: () => [
    {
      text: 'Watch which bins hold raccoons and what they’d steal. Then follow the shuffle and pick an empty bin. ',
    },
    { text: 'Pick a raccoon and it steals from you.', red: true },
  ],
  controls: [
    {
      action: 'PICK',
      inputs: [mouse('Click a bin'), OR, finger('Tap a bin'), OR, ...key('←', '→', 'SPACE')],
    },
  ],
  chips: (s) => ['ONE AT A TIME', ...(s.night === 'on' ? ['NIGHT'] : [])],
  ifFail: [
    { who: 'each', label: 'Each hiker who picks a raccoon:', value: 'it steals from their pack' },
  ],
  bars(s) {
    const t = RS.tiers[tierIn(s)];
    const empty = Math.min(t.bins - 1, t.empty + prepNumber(s, P_('lure')));
    return [
      countBar('bins', 'BINS', t.bins, t.bins, 8),
      countBar('empty', 'EMPTY BINS', t.empty, empty, Math.max(3, empty)),
      countBar('swaps', 'SWAPS', t.swaps, t.swaps, 15),
    ];
  },
  prepare: () => [
    row(
      'lure',
      'LURE ONE OUT',
      '+1 empty bin each',
      res('meat', 'fish'),
      { param: P_('lure'), step: 1 },
      { slots: 2 },
    ),
    row(
      'slowShuffle',
      'SLOWER SHUFFLE',
      '+0.06 s a swap each',
      res('mushroom'),
      { param: P_('slowShuffle'), step: 0.06 },
      {
        slots: 2,
      },
    ),
  ],
  // Night comes by chance from Tier III: decided by the run's seed, as the game does.
  version(s, seed): MinigameSettings {
    if (s.night === 'on' || s.night === 'off') return {};
    const night = newRaccoonShuffle(
      { tier: tierIn(s), night: 'auto', packs: {} },
      ['a'],
      seed,
    ).night;
    return { night: night ? 'on' : 'off' };
  },
};

// ── Trail Blocks ───────────────────────────────────────────────────────────

const TB = MG.trailBlocks;
const blockVersion = (s: MinigameSettings) =>
  BLOCK_VERSIONS.find((v) => v.id === s.version) ?? BLOCK_VERSIONS[0]!;

/** BRING AN AXE and the like: half the work. */
const halfWork = (id: string, label: string, thing: string, line = 'Half the work') =>
  row(id, label, line, item(thing), { param: P_('lessWork'), step: 0.5 });
/** SHARPEN and the like: bigger zones. */
const biggerZones = (id: string, label: string, thing: string, line = 'Bigger zones each') =>
  row(id, label, line, res(thing), { param: P_('zones'), step: 1 }, { slots: 2 });

export const TRAIL_BLOCKS_POPUP: GamePopup = {
  howToPlay: (s) =>
    blockVersion(s).id === 'animals'
      ? [
          { text: 'Whistle when the circle reaches the ring. The closer, the more you clear. ' },
          { text: 'Misses and weak hits cost energy.', red: true },
        ]
      : [
          {
            text: 'Tap when the marker is in a green zone. The closer to the edge, the more you clear. ',
          },
          { text: 'Misses and weak hits cost energy.', red: true },
        ],
  controls: [tapRow('TAP', 'SPACE')],
  chips: (s) => ['TAKE TURNS', blockVersion(s).name.toUpperCase()],
  ifFail: FAIL_PASSING,
  bars(s) {
    const w = TB.work[tierIn(s)];
    const total = (w.base + w.perHiker * hikerCount(s)) / TB.chunk;
    const left = total * (1 - Math.min(0.9, prepNumber(s, P_('lessWork'))));
    return [
      countBar('work', 'WORK', Math.round(total), Math.max(1, Math.round(left)), 10),
      sizeBar(
        'zones',
        blockVersion(s).id === 'animals' ? 'RING' : 'ZONES',
        s,
        prepNumber(s, P_('zones')),
      ),
    ];
  },
  prepare(s) {
    switch (blockVersion(s).id) {
      case 'chop':
        return [
          biggerZones('sharpen', 'SHARPEN', 'flint'),
          halfWork('axe', 'BRING AN AXE', 'woodcuttingAxe'),
        ];
      case 'rockslide':
        return [
          halfWork('pickaxe', 'BRING A PICKAXE', 'pickaxe'),
          biggerZones('wedges', 'WEDGES', 'metal'),
        ];
      case 'river':
        return [
          halfWork('ditch', 'DIG A DITCH', 'shovel', 'Half the water'),
          biggerZones('patch', 'PATCH THE BUCKET', 'clay'),
        ];
      case 'animals':
        return [
          row(
            'bait',
            'BAIT',
            '−1 animal each',
            res('meat', 'fish'),
            { param: P_('bait'), step: 1 },
            { slots: 2 },
          ),
          biggerZones('ring', 'BIGGER RING', 'grass', 'A bigger ring each'),
        ];
    }
  },
};

// ── Sleeping Bear, Whackoon ────────────────────────────────────────────────

const SB = MG.sleepingBear;

export const SLEEPING_BEAR_POPUP: GamePopup = {
  howToPlay: () => [
    { text: 'Sneak past the sleeping bear. Move while he’s asleep and freeze when he stirs. ' },
    { text: 'Get caught and you’re out.', red: true },
  ],
  controls: [
    { action: 'SNEAK', inputs: [mouse('Hold'), OR, finger('Hold'), OR, ...key('SPACE')] },
    { action: 'FREEZE', inputs: [mouse('Let go'), OR, finger('Let go')] },
  ],
  chips: (s) => [
    seconds(SB.tiers[tierIn(s)].secPerHiker * hikerCount(s) + prepNumber(s, P_('extraSec'))),
    'ONE AT A TIME',
  ],
  ifFail: [
    { who: 'each', label: 'Each hiker caught:', value: '−1 resource, Bleeding' },
    { who: 'everyone', label: 'Out of time:', value: '−1 Energy each' },
  ],
  bars(s) {
    const clock = SB.tiers[tierIn(s)].secPerHiker * hikerCount(s);
    return [
      timeBar('clock', 'CLOCK', clock, clock + prepNumber(s, P_('extraSec'))),
      levelBar('sleeper', 'LIGHT SLEEPER', s, -prepNumber(s, P_('quiet'))),
    ];
  },
  prepare: () => [
    row(
      'quiet',
      'QUIET STEPS',
      '−1 light sleeper each',
      res('fur'),
      { param: P_('quiet'), step: 1 },
      { slots: 2 },
    ),
    plusSec(10),
    row(
      'skip',
      'SKIP IT',
      'Sneak past without playing',
      item('bearSpray'),
      { param: P_('skip'), step: 1 },
      {
        need: 2,
        skip: true,
      },
    ),
  ],
};

const WH = MG.whackoon;

export const WHACKOON_POPUP: GamePopup = {
  howToPlay: () => [
    { text: 'Whack the raccoons in your color as they pop out of the cans. ' },
    { text: 'Leave the skunks alone!', red: true },
  ],
  controls: [tapRow('WHACK')],
  chips: (s) => [seconds(WH.secPerHiker * hikerCount(s)), 'ALL TOGETHER'],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const time = WH.secPerHiker * hikerCount(s);
    return [
      timeBar('time', 'TIME', time, time),
      levelBar('speed', 'POP-UP SPEED', s, -prepNumber(s, P_('slower'))),
    ];
  },
  prepare: () => [
    slower('SLOWER RACCOONS'),
    row(
      'noSkunks',
      'NO SKUNKS',
      'Only raccoons pop up',
      res('oil'),
      { param: P_('noSkunks'), step: 1 },
      {
        onlyIf: (s) => s.skunks === 'on' || (s.skunks !== 'off' && WH.tiers[tierIn(s)].skunks > 0),
      },
    ),
  ],
};

// ── The quick games ────────────────────────────────────────────────────────

const TBZ = MG.trailBlazes;

export const TRAIL_BLAZES_POPUP: GamePopup = {
  howToPlay: () => [
    { text: 'Two trunks scroll past each other. Tap when the two lit blazes are level. ' },
    { text: 'Misses use up your tries.', red: true },
  ],
  controls: [tapRow('TAP', 'SPACE')],
  chips: () => ['TAKE TURNS'],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const level = TBZ.tiers[tierIn(s)].level;
    return [
      levelBar('speed', 'TRUNK SPEED', s, -prepNumber(s, P_('slower'))),
      countBar('window', 'LEVEL WINDOW', level, level + prepNumber(s, P_('brighter')), 12),
    ];
  },
  prepare: () => [
    slower('SLOWER TRUNKS'),
    row(
      'brighter',
      'BRIGHTER PAINT',
      '+1 level window each',
      res('oil'),
      { param: P_('brighter'), step: 1 },
      {
        slots: 2,
      },
    ),
  ],
};

const FC = MG.fireflyCatch;

export const FIREFLY_CATCH_POPUP: GamePopup = {
  howToPlay: (s) => {
    const n = numOr(s, 'catches', FC.tiers[tierIn(s)].catches);
    return [
      { text: 'Tap when the firefly is inside your jar ring. ' },
      { text: `Catch ${n} before your time runs out.`, red: true },
    ];
  },
  controls: [tapRow('TAP', 'SPACE')],
  chips: (s) => [seconds(numOr(s, 'time', FC.tiers[tierIn(s)].timeSec)), 'TAKE TURNS'],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const t = FC.tiers[tierIn(s)];
    const time = numOr(s, 'time', t.timeSec);
    // The ring in segments of 3 units, so each Bigger Jar is one segment.
    return [
      countBar(
        'ring',
        'RING SIZE',
        Math.round(t.ring / 3),
        Math.round((t.ring + prepNumber(s, P_('ring'))) / 3),
        14,
      ),
      levelBar('speed', 'FIREFLY SPEED', s, -prepNumber(s, P_('slower'))),
      timeBar('time', 'TIME', time, time),
    ];
  },
  prepare: () => [
    row(
      'ring',
      'BIGGER JAR',
      '+3 ring each',
      res('clay'),
      { param: P_('ring'), step: 3 },
      { slots: 2 },
    ),
    slower('SLOWER FIREFLIES'),
  ],
};

const SZ = MG.sizeUp;

export const SIZE_UP_POPUP: GamePopup = {
  howToPlay: () => [
    { text: 'Grow or shrink the find on the trail until it matches the field guide’s drawing. ' },
    { text: 'Get it close enough before time runs out.', red: true },
  ],
  controls: [
    {
      action: 'GROW',
      inputs: [...key('W'), OR, ...key('↑'), OR, mouse('Click +'), OR, finger('Tap +')],
    },
    {
      action: 'SHRINK',
      inputs: [...key('S'), OR, ...key('↓'), OR, mouse('Click −'), OR, finger('Tap −')],
    },
    { action: 'LOCK IN', inputs: [...key('SPACE'), OR, mouse('Click'), OR, finger('Tap')] },
  ],
  chips: (s) => [seconds(numOr(s, 'time', SZ.tiers[tierIn(s)].timeSec)), 'TAKE TURNS'],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const t = SZ.tiers[tierIn(s)];
    const time = numOr(s, 'time', t.timeSec);
    return [
      countBar('pass', 'PASS WITHIN', t.pass, t.pass + prepNumber(s, P_('pass')), 10),
      timeBar('time', 'TIME', time, time + prepNumber(s, P_('extraSec'))),
    ];
  },
  prepare: () => [
    row(
      'pass',
      'MEASURING STICK',
      '+1% that passes each',
      res('wood'),
      { param: P_('pass'), step: 1 },
      { slots: 2 },
    ),
    plusSec(2),
  ],
};

const FSW = MG.flySwatter;

export const FLY_SWATTER_POPUP: GamePopup = {
  howToPlay: () => [
    { text: 'Circles pop up where flies are about to land. Tap each one before it shrinks away. ' },
    { text: 'Leave the bees alone.', red: true },
  ],
  controls: [tapRow('SWAT', 'SPACE')],
  chips: () => ['TAKE TURNS'],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const flies = FSW.tiers[tierIn(s)].flies;
    // Each Slower Flies is one level more shrink time.
    return [
      sizeBar('shrink', 'SHRINK TIME', s, prepNumber(s, P_('slowerShrink')) / 0.15),
      countBar('flies', 'FLIES', flies, flies, 14),
    ];
  },
  prepare: () => [
    row(
      'bigger',
      'BIGGER SWATTER',
      '+4 circle size each',
      res('grass'),
      { param: P_('bigger'), step: 4 },
      { slots: 2 },
    ),
    row(
      'slowerShrink',
      'SLOWER FLIES',
      '+0.15 s before a circle goes',
      FOOD,
      { param: P_('slowerShrink'), step: 0.15 },
      {
        slots: 2,
      },
    ),
  ],
};
