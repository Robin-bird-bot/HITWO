/**
 * The pop-up content for Movement and dodging (docs/design/20-challenge-popup.md,
 * section 7): Dodge (every animal), Camp Cleanup, Crossing, Train!, Rafting,
 * Trails and Rock Climb.
 */
import { BALANCE } from '../../config/balance';
import { ANIMALS, isAnimal, levelFor } from '../dodge/animals';
import { autoLength } from '../dodge/logic';
import { FOOD, item, prepNumber, res } from '../prepare';
import { TRAIL_TYPES } from '../trails/course';
import { VERSIONS as CROSSING_VERSIONS } from '../crossing/logic';
import type { MinigameSettings } from '../types';
import {
  ARROWS,
  countBar,
  FAIL_ENERGY,
  finger,
  key,
  levelBar,
  mouse,
  numOr,
  OR,
  P_,
  row,
  seconds,
  tierIn,
  timeBar,
  WASD,
} from './common';
import type { GamePopup } from './types';

const MG = BALANCE.minigames;
const D = MG.dodge;

/** +1 heart or life: Food, one slot in each hiker's row. */
const plusLife = (word: 'HEART' | 'LIFE') =>
  row(
    'lives',
    `+1 ${word}`,
    `+1 ${word.toLowerCase()} for that hiker`,
    FOOD,
    { param: P_('lives'), step: 1 },
    {
      perHiker: true,
      tag: '+1♥',
    },
  );

/** SLOWER …: Food, [2] slots, one level each. */
const slower = (label: string, line = '−1 speed each') =>
  row('slower', label, line, FOOD, { param: P_('slower'), step: 1 }, { slots: 2 });

/** +N S: Food, [2] slots. */
const plusSec = (sec: number) =>
  row(
    'extraSec',
    `+${sec} S`,
    `+${sec} seconds each`,
    FOOD,
    { param: P_('extraSec'), step: sec },
    { slots: 2 },
  );

const animalOf = (s: MinigameSettings) => (isAnimal(s.animal) ? s.animal : 'bees');

const ANIMAL_WORDS: Readonly<Record<string, string>> = {
  bees: 'the bees',
  bear: 'the bear',
  swordBear: 'the bear with a sword',
  bobcat: 'the bobcat',
  squirrels: 'the squirrel army',
  gunBear: 'the bear with a gun',
  ants: 'the ants',
  stampede: 'the stampede',
  monster: 'the Woods Monster',
};

/** Dodge's length after Prepare's Bear Spray. */
function dodgeLength(s: MinigameSettings): { base: number; value: number } {
  const base = numOr(s, 'length', autoLength(animalOf(s), tierIn(s)));
  return { base, value: Math.round(base * (1 - prepNumber(s, P_('bearSpray')))) };
}

/** The level a Dodge animal plays at (Auto: the tier's; 0 is Easy). */
function dodgeRank(s: MinigameSettings): 0 | 1 | 2 | 3 {
  const pick = s.level;
  if (pick === 'easy') return 0;
  if (pick === '1' || pick === '2' || pick === '3') return Number(pick) as 1 | 2 | 3;
  return levelFor(animalOf(s), tierIn(s));
}

const BEARS = ['bear', 'swordBear', 'gunBear'];

export const DODGE_POPUP: GamePopup = {
  howToPlay(s) {
    const animal = animalOf(s);
    const sw = numOr(s, 'switch', D.switchSec);
    return [
      {
        text: `Dodge ${ANIMAL_WORDS[animal]}! Steer your hiker around the box and stay out of the way. `,
      },
      {
        text: animal === 'bees' ? 'Each sting costs a heart.' : 'Each hit costs a heart.',
        red: true,
      },
      {
        text: ` Hikers take turns every ${sw} seconds. Survive for ${dodgeLength(s).value} seconds.`,
      },
    ];
  },
  controls: [
    {
      action: 'MOVE',
      inputs: [mouse('Drag'), OR, finger('Drag'), OR, ...WASD, OR, ...ARROWS],
    },
  ],
  chips: (s) => [
    seconds(dodgeLength(s).value),
    'TAKE TURNS',
    ANIMALS[animalOf(s)].name.toUpperCase(),
  ],
  ifFail: [],
  bars(s) {
    const animal = animalOf(s);
    const rank = dodgeRank(s);
    const out = [levelBar('speed', 'ATTACK SPEED', s, -prepNumber(s, P_('slower')))];
    if (animal === 'bees') {
      const base = rank === 0 ? 2 : D.bees.lane[rank].bees[1];
      out.push(
        countBar('bees', 'BEES PER WAVE', base, Math.max(1, base - prepNumber(s, P_('smoke'))), 6),
      );
    }
    if (animal === 'ants') {
      const n = D.ants.march.ants[Math.max(1, rank) as 1 | 2 | 3];
      out.push(countBar('ants', 'ANTS PER LINE', n, n, 12));
    }
    if (BEARS.includes(animal)) {
      const len = dodgeLength(s);
      out.push(timeBar('survive', 'SURVIVE', len.base, len.value));
    }
    return out;
  },
  perHiker: (s) => ({
    label: 'LIVES',
    kind: 'hearts',
    base: numOr(s, 'lives', D.lives),
    row: 'lives',
    step: 1,
  }),
  prepare(s) {
    const animal = animalOf(s);
    if (animal === 'monster') return [plusLife('HEART')];
    return [
      plusLife('HEART'),
      slower('SLOWER ATTACKS'),
      row(
        'smoke',
        'SMOKY FIRE',
        '−1 bee per wave',
        res('grass', 'moss'),
        { param: P_('smoke'), step: 1 },
        {
          need: 2,
          onlyIf: (x) => animalOf(x) === 'bees',
        },
      ),
      row(
        'bearSpray',
        'BEAR SPRAY',
        '25% shorter',
        item('bearSpray'),
        { param: P_('bearSpray'), step: 0.25 },
        {
          onlyIf: (x) => BEARS.includes(animalOf(x)),
        },
      ),
      row(
        'sandbags',
        'SANDBAGS',
        'Traps and holes last half as long',
        res('clay'),
        { param: P_('sandbags'), step: 1 },
        {
          need: 2,
          onlyIf: (x) => animalOf(x) === 'gunBear',
        },
      ),
      row(
        'salt',
        'SALT LINE',
        'Ant lines 20% slower each',
        res('salt'),
        { param: P_('salt'), step: 0.2 },
        {
          slots: 2,
          onlyIf: (x) => animalOf(x) === 'ants',
        },
      ),
    ];
  },
};

// ── Camp Cleanup ───────────────────────────────────────────────────────────

const CC = MG.campCleanup;

const campQuota = (s: MinigameSettings) => {
  const hikers = Array.isArray(s.hikers) ? s.hikers.length : 3;
  const t = CC.tiers[tierIn(s)];
  return numOr(s, 'bags', t.quota - (hikers >= CC.bigParty ? CC.bigPartyLess : 0));
};

const campObstacles = (s: MinigameSettings) =>
  s.obstacles === 'off' ? false : s.obstacles === 'on' || CC.tiers[tierIn(s)].obstacles > 0;

export const CAMP_CLEANUP_POPUP: GamePopup = {
  howToPlay(s) {
    const quota = Math.max(1, campQuota(s) - prepNumber(s, P_('fewerBags')));
    return [
      {
        text: 'You’re all one long line. Steer around the campsite and pick up the trash in your colors. Each piece adds a bag to the end of the line. ',
      },
      { text: 'Hit a wall, a rock or yourself and you lose bags.', red: true },
      { text: ` Every hiker needs ${quota} ${quota === 1 ? 'bag' : 'bags'} when time runs out.` },
    ];
  },
  controls: [
    {
      action: 'STEER',
      inputs: [...WASD, OR, ...ARROWS, OR, finger('Swipe'), OR, mouse('Click a side')],
    },
  ],
  chips: (s) => [
    seconds(numOr(s, 'time', CC.tiers[tierIn(s)].timeSec) + prepNumber(s, P_('extraSec'))),
    'ALL TOGETHER',
  ],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const time = numOr(s, 'time', CC.tiers[tierIn(s)].timeSec);
    const quota = campQuota(s);
    return [
      timeBar('time', 'TIME', time, time + prepNumber(s, P_('extraSec'))),
      levelBar('speed', 'SPEED', s, -prepNumber(s, P_('slower'))),
      countBar('bags', 'BAGS EACH', quota, Math.max(1, quota - prepNumber(s, P_('fewerBags'))), 8),
    ];
  },
  prepare: () => [
    plusSec(10),
    slower('SLOWER'),
    row('fewerBags', '−1 BAG EACH', 'Every hiker needs one fewer', item('sack'), {
      param: P_('fewerBags'),
      step: 1,
    }),
    row(
      'fewerObstacles',
      'CLEAR THE OBSTACLES',
      '2 fewer obstacles',
      item('shovel'),
      { param: P_('fewerObstacles'), step: 2 },
      {
        onlyIf: campObstacles,
      },
    ),
  ],
};

// ── Crossing, Train!, Rafting ──────────────────────────────────────────────

const CR = MG.crossing;
const crossingVersion = (s: MinigameSettings) =>
  CROSSING_VERSIONS.find((v) => v.id === s.version) ?? CROSSING_VERSIONS[0]!;

export const CROSSING_POPUP: GamePopup = {
  howToPlay: () => [
    { text: 'Get every hiker across, one at a time. ' },
    { text: 'A hit costs a life', red: true },
    { text: ' and sends the hiker back to the start.' },
  ],
  controls: [
    { action: 'HOP', inputs: [...WASD, OR, ...ARROWS, OR, finger('Swipe'), OR, mouse('Click')] },
  ],
  chips: (s) => ['ONE AT A TIME', crossingVersion(s).name.toUpperCase()],
  ifFail: FAIL_ENERGY,
  bars: (s) => [levelBar('speed', 'TRAFFIC SPEED', s, -prepNumber(s, P_('slower')))],
  perHiker: (s) => {
    const critter = crossingVersion(s).id === 'critter';
    return {
      label: 'LIVES',
      kind: 'hearts',
      base: numOr(s, 'lives', CR.tiers[tierIn(s)].lives + (critter ? CR.critter.extraLives : 0)),
      row: 'lives',
      step: 1,
    };
  },
  prepare: () => [
    plusLife('LIFE'),
    slower('SLOWER TRAFFIC'),
    row(
      'logs',
      'MORE LOGS',
      'More logs on the river',
      res('wood'),
      { param: P_('logs'), step: 1 },
      {
        need: 2,
        onlyIf: (s) => s.version === 'river' || s.version === 'mixed',
      },
    ),
  ],
};

const TR = MG.train;

export const TRAIN_POPUP: GamePopup = {
  howToPlay: () => [
    {
      text: 'Hop between the tracks as trains come through. Watch for the horn and the headlight. ',
    },
    { text: 'A hit costs a life.', red: true },
  ],
  controls: [
    {
      action: 'HOP',
      inputs: [...key('W', 'S'), OR, ...key('↑', '↓'), OR, finger('Swipe'), OR, mouse('Click')],
    },
  ],
  chips: (s) => [seconds(numOr(s, 'survive', TR.tiers[tierIn(s)].surviveSec)), 'TAKE TURNS'],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const sec = numOr(s, 'survive', TR.tiers[tierIn(s)].surviveSec);
    return [
      levelBar('speed', 'TRAIN SPEED', s, -prepNumber(s, P_('slower'))),
      timeBar('survive', 'SURVIVE', sec, sec),
    ];
  },
  perHiker: (s) => ({
    label: 'LIVES',
    kind: 'hearts',
    base: numOr(s, 'lives', TR.tiers[tierIn(s)].lives),
    row: 'lives',
    step: 1,
  }),
  prepare: () => [
    plusLife('LIFE'),
    slower('SLOWER TRAINS'),
    row(
      'brighter',
      'BRIGHTER WARNING',
      '+0.3 s warning in the fog',
      res('oil'),
      { param: P_('brighter'), step: 0.3 },
      {
        onlyIf: (s) => (s.fog === 'on' ? true : s.fog === 'off' ? false : TR.tiers[tierIn(s)].fog),
      },
    ),
  ],
};

export const RAFTING_POPUP: GamePopup = {
  howToPlay: () => [
    { text: 'Steer the raft upriver to the dock. ' },
    { text: 'Hitting rocks costs lives,', red: true },
    { text: ' and the rapids speed everything up.' },
  ],
  controls: [
    {
      action: 'STEER',
      inputs: [...key('A', 'D'), OR, ...key('←', '→'), OR, finger('Swipe'), OR, mouse('Click')],
    },
  ],
  chips: () => ['WHOLE PARTY'],
  ifFail: [{ who: 'everyone', label: 'Nobody reaches the dock:', value: 'everyone fails' }],
  bars: (s) => [levelBar('speed', 'RIVER SPEED', s, -prepNumber(s, P_('slower')))],
  perHiker: () => ({ label: 'LIVES', kind: 'hearts', base: 1, row: 'lives', step: 1 }),
  prepare: () => [
    plusLife('LIFE'),
    slower('SLOWER RIVER'),
    row(
      'sturdy',
      'STURDIER RAFT',
      'The first hit doesn’t count',
      res('wood'),
      { param: P_('sturdy'), step: 1 },
      {
        need: 2,
      },
    ),
  ],
};

// ── Trails, Rock Climb ─────────────────────────────────────────────────────

const TL = MG.trails;
const trailType = (s: MinigameSettings) =>
  TRAIL_TYPES.find((t) => t.id === s.type) ?? TRAIL_TYPES[0]!;

export const TRAILS_POPUP: GamePopup = {
  howToPlay: () => [
    { text: 'Stay on the trail as it comes down the screen. Off the trail, your bar drains. ' },
    { text: 'Empty bar and you fail.', red: true },
    { text: ' Reach your checkpoint to pass.' },
  ],
  controls: [
    {
      action: 'STEER',
      inputs: [...key('A', 'D'), OR, ...key('←', '→'), OR, mouse('Point'), OR, finger('Drag')],
    },
  ],
  chips: (s) => ['TAKE TURNS', trailType(s).name.toUpperCase()],
  ifFail: FAIL_ENERGY,
  bars(s) {
    // Trail width in segments of 4 units, so the Hiking Stick's +4 is one segment.
    const width =
      TL.tiers[tierIn(s)].width * (trailType(s).id === 'ridgeline' ? TL.ridgeNarrow : 1);
    const seg = (w: number) => Math.round(w / 4);
    return [
      levelBar('speed', 'SCROLL SPEED', s, -prepNumber(s, P_('slower'))),
      countBar('width', 'TRAIL WIDTH', seg(width), seg(width + prepNumber(s, P_('width'))), 15),
    ];
  },
  perHiker: (s) => ({
    label: 'BAR',
    kind: 'pips',
    base: numOr(s, 'bar', TL.tiers[tierIn(s)].barSec),
    row: 'bar',
    step: 0.5,
    format: (v) => `${v} S`,
  }),
  prepare: () => [
    row(
      'bar',
      '+0.5 S BAR',
      '+0.5 seconds of bar',
      FOOD,
      { param: P_('bar'), step: 1 },
      {
        perHiker: true,
        tag: '+0.5',
      },
    ),
    slower('SLOWER'),
    row('width', 'HIKING STICK', '+4 trail width', item('hikingStick'), {
      param: P_('width'),
      step: 4,
    }),
  ],
};

const RC = MG.rockClimb;

export const ROCK_CLIMB_POPUP: GamePopup = {
  howToPlay: () => [
    { text: 'Aim, hold for power, and let go to jump. Grab a hold of the active hand’s color. ' },
    { text: 'A fall fails that hand’s hiker.', red: true },
    { text: ' Reach the top in time.' },
  ],
  controls: [
    { action: 'AIM', inputs: [mouse('Point'), OR, finger('Drag')] },
    {
      action: 'JUMP',
      inputs: [mouse('Hold, let go'), OR, finger('Hold, let go'), OR, ...key('SPACE')],
    },
    { action: 'GRAB', inputs: [mouse('Click a hold'), OR, finger('Tap'), OR, ...key('SPACE')] },
  ],
  chips: (s) => [
    seconds(numOr(s, 'time', RC.tiers[tierIn(s)].timeSec) + prepNumber(s, P_('extraSec'))),
    'TAKE TURNS',
  ],
  ifFail: FAIL_ENERGY,
  bars(s) {
    const t = RC.tiers[tierIn(s)];
    const holds = numOr(s, 'holds', t.holds);
    const time = numOr(s, 'time', t.timeSec);
    // Reach in segments of 2 units, so each Chalk is one segment.
    return [
      countBar('holds', 'HOLDS', holds, holds, Math.max(holds, 14)),
      timeBar('time', 'TIME', time, time + prepNumber(s, P_('extraSec'))),
      countBar('reach', 'GRAB REACH', t.reach / 2, (t.reach + prepNumber(s, P_('chalk'))) / 2, 12),
    ];
  },
  prepare: () => [
    row(
      'chalk',
      'CHALK',
      '+2 reach each',
      res('salt'),
      { param: P_('chalk'), step: 2 },
      { slots: 2 },
    ),
    plusSec(10),
    row('harness', 'HARNESS', 'The first fall fails nobody', item('harness'), {
      param: P_('harness'),
      step: 1,
    }),
  ],
};
